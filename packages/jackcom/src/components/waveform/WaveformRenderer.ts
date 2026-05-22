import { WAVEFORM_SHADER } from './shaders.wgsl'

interface ChannelData {
  name: string
  values: number[]
}

export interface WaveformRendererOptions {
  onDeviceLost?: (reason: string) => void
}

export class WaveformRenderer {
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private format: GPUTextureFormat = 'rgba8unorm'
  private pipeline: GPURenderPipeline | null = null
  private uniformBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private channels: ChannelData[] = []
  private zoom = 1.0
  private offsetX = 0.0
  private autoFit = true
  private vertexBuffer: GPUBuffer | null = null
  private vertexBufferSize = 0
  private animationId: number | null = null
  private canvas: HTMLCanvasElement | null = null
  private msaaTexture: GPUTexture | null = null
  private msaaView: GPUTextureView | null = null
  private msaaSampleCount: number = 4

  // Pre-allocated CPU-side vertex buffer to avoid per-frame GC
  private _cpuVertices: Float32Array = new Float32Array(0)
  private _cpuVertexFloats = 0
  // Dirty flag: skip render when nothing changed
  private _dirty = true
  private _onDeviceLost?: (reason: string) => void

  constructor(options?: WaveformRendererOptions) {
    this._onDeviceLost = options?.onDeviceLost
  }

  isReady(): boolean {
    return this.device !== null && this.pipeline !== null
  }

  /** Mark renderer as needing re-render. Call after canvas resize. */
  markDirty(): void {
    this._dirty = true
  }

  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!navigator.gpu)
      return false

    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter)
      return false

    // DPR-aware MSAA: high-DPI screens already render at high resolution
    const dpr = window.devicePixelRatio || 1
    this.msaaSampleCount = dpr > 1 ? 2 : 4

    this.device = await adapter.requestDevice({
      requiredLimits: {
        maxBufferSize: adapter.limits.maxBufferSize,
      },
    })

    // Handle GPU device loss (driver crash, sleep/wake, GPU switch)
    this.device.lost.then((info) => {
      this.destroy()
      this._onDeviceLost?.(info.message)
    })

    this.canvas = canvas

    this.context = canvas.getContext('webgpu')
    if (!this.context)
      return false

    this.format = navigator.gpu.getPreferredCanvasFormat()
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    })

    // Uniform buffer: resolution(2f) + num_channels + offset_x + zoom = 5 floats, padded to 32 bytes
    this.uniformBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    })

    // Shader compilation with diagnostics
    const shaderModule = this.device.createShaderModule({ code: WAVEFORM_SHADER })
    const compilationInfo = await shaderModule.getCompilationInfo()
    for (const msg of compilationInfo.messages) {
      if (msg.type === 'error') {
        console.error(`[WebGPU] Shader compile error at line ${msg.lineNum}:${msg.linePos} — ${msg.message}`)
        return false
      }
    }

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'line_vertex',
        buffers: [{
          arrayStride: 12,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32' as GPUVertexFormat },
            { shaderLocation: 1, offset: 4, format: 'float32' as GPUVertexFormat },
            { shaderLocation: 2, offset: 8, format: 'float32' as GPUVertexFormat },
          ],
        }],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'line_fragment',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'line-strip',
      },
      multisample: {
        count: this.msaaSampleCount,
      },
    })

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer },
      }],
    })

    return true
  }

  updateData(channels: Record<string, number[]>): void {
    this.channels = Object.entries(channels).map(([name, values]) => ({
      name,
      values,
    }))
    this._dirty = true
  }

  setZoom(level: number): void {
    this.autoFit = false
    this.zoom = Math.max(0.1, Math.min(level, 100))
    this._dirty = true
  }

  setOffset(x: number): void {
    if (!this.canvas || this.channels.length === 0) {
      this.offsetX = x
      this._dirty = true
      return
    }
    const maxLen = this.channels.reduce((max, ch) => Math.max(max, ch.values.length), 1)
    const effectiveZoom = this.getEffectiveZoom()
    const maxPoints = this.canvas.width / effectiveZoom
    const minOffset = Math.min(0, 1 - maxLen / maxPoints)
    const maxOffset = Math.max(0, 1 - maxLen / maxPoints)
    this.offsetX = Math.max(minOffset, Math.min(x, maxOffset))
    this._dirty = true
  }

  getZoom(): number {
    return this.zoom
  }

  getOffset(): number {
    return this.offsetX
  }

  resetView(): void {
    this.autoFit = true
    this.offsetX = 0
    this._dirty = true
  }

  getEffectiveZoom(): number {
    if (this.autoFit && this.channels.length > 0 && this.canvas) {
      const maxLen = this.channels.reduce((max, ch) => Math.max(max, ch.values.length), 1)
      return this.canvas.width / maxLen
    }
    return this.zoom
  }

  getVisibleRange(): { startIndex: number, endIndex: number } {
    if (!this.canvas || this.channels.length === 0)
      return { startIndex: 0, endIndex: 0 }
    const maxLen = this.channels.reduce((max, ch) => Math.max(max, ch.values.length), 1)
    const effectiveZoom = this.getEffectiveZoom()
    const maxPoints = this.canvas.width / effectiveZoom
    const offset = this.autoFit ? 0 : this.offsetX
    return {
      startIndex: Math.max(0, Math.round(-offset * maxPoints)),
      endIndex: Math.min(maxLen, Math.round((1 - offset) * maxPoints)),
    }
  }

  getDataAtScreenX(screenX: number, canvasWidth: number): { index: number, values: { channel: string, value: number, channelIndex: number }[] } | null {
    if (this.channels.length === 0)
      return null
    const effectiveZoom = this.getEffectiveZoom()
    const maxPoints = canvasWidth / effectiveZoom
    const offsetX = this.autoFit ? 0 : this.offsetX
    const xNorm = screenX / canvasWidth
    const pointIndex = Math.round((xNorm - offsetX) * maxPoints)
    if (pointIndex < 0)
      return null
    const values = this.channels
      .map((ch, idx) => ({ channel: ch.name, value: ch.values[pointIndex], channelIndex: idx }))
      .filter((v): v is { channel: string, value: number, channelIndex: number } => v.value !== undefined)
    if (values.length === 0)
      return null
    return { index: pointIndex, values }
  }

  /** Fill pre-allocated CPU vertex buffer. No per-frame allocation. */
  private buildVertexData(): void {
    let totalFloats = 0
    for (const ch of this.channels)
      totalFloats += ch.values.length * 3

    // Grow CPU buffer with power-of-2 doubling
    if (totalFloats > this._cpuVertices.length) {
      let newSize = Math.max(256, this._cpuVertices.length)
      while (newSize < totalFloats)
        newSize *= 2
      this._cpuVertices = new Float32Array(newSize)
    }

    let offset = 0
    for (let ch = 0; ch < this.channels.length; ch++) {
      const { values } = this.channels[ch]
      for (let i = 0; i < values.length; i++) {
        this._cpuVertices[offset++] = i
        this._cpuVertices[offset++] = values[i]
        this._cpuVertices[offset++] = ch
      }
    }
    this._cpuVertexFloats = offset
  }

  render(): void {
    if (!this.device || !this.context || !this.pipeline || !this.uniformBuffer || !this.bindGroup || !this.canvas)
      return

    if (!this._dirty)
      return

    const width = this.canvas.width
    const height = this.canvas.height

    // Ensure MSAA texture size matches canvas
    if (!this.msaaTexture || this.msaaTexture.width !== width || this.msaaTexture.height !== height) {
      this.msaaTexture?.destroy()
      this.msaaTexture = this.device.createTexture({
        size: [width, height],
        sampleCount: this.msaaSampleCount,
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
      this.msaaView = this.msaaTexture.createView()
    }

    const effectiveZoom = this.getEffectiveZoom()

    // Update uniforms (5 floats = 20 bytes, buffer is 32 bytes)
    const uniformData = new Float32Array([
      width,
      height, // resolution
      this.channels.length, // num_channels
      this.autoFit ? 0 : this.offsetX, // offset_x
      effectiveZoom, // zoom
    ])
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)

    // Build vertex data into pre-allocated buffer
    this.buildVertexData()
    const neededBytes = this._cpuVertexFloats * 4

    // Grow GPU vertex buffer with power-of-2 doubling, capped at 16 MB
    if (!this.vertexBuffer || this.vertexBufferSize < neededBytes) {
      this.vertexBuffer?.destroy()
      let gpuSize = Math.max(64, this.vertexBufferSize)
      while (gpuSize < neededBytes)
        gpuSize *= 2
      gpuSize = Math.min(gpuSize, 16 * 1024 * 1024)
      this.vertexBuffer = this.device.createBuffer({
        size: gpuSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      })
      this.vertexBufferSize = gpuSize
    }

    if (this._cpuVertexFloats > 0) {
      this.device.queue.writeBuffer(this.vertexBuffer, 0, this._cpuVertices.buffer as ArrayBuffer, this._cpuVertices.byteOffset, this._cpuVertexFloats * 4)
    }

    // Render pass
    const textureView = this.context.getCurrentTexture().createView()
    const commandEncoder = this.device.createCommandEncoder()
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.msaaView!,
        resolveTarget: textureView,
        clearValue: { r: 0.118, g: 0.118, b: 0.118, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'discard',
      }],
    })

    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(0, this.bindGroup)
    if (this._cpuVertexFloats > 0 && this.vertexBuffer) {
      passEncoder.setVertexBuffer(0, this.vertexBuffer)
      let firstVertex = 0
      for (const ch of this.channels) {
        const count = ch.values.length
        if (count >= 2)
          passEncoder.draw(count, 1, firstVertex)
        firstVertex += count
      }
    }
    passEncoder.end()

    this.device.queue.submit([commandEncoder.finish()])
    this._dirty = false
  }

  startRenderLoop(): void {
    const loop = () => {
      this.render()
      this.animationId = requestAnimationFrame(loop)
    }
    loop()
  }

  stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  destroy(): void {
    this.stopRenderLoop()
    this.vertexBuffer?.destroy()
    this.vertexBuffer = null
    this.vertexBufferSize = 0
    this.msaaTexture?.destroy()
    this.msaaTexture = null
    this.msaaView = null
    this.device?.destroy()
    this.device = null
    this.context = null
    this.pipeline = null
    this.uniformBuffer = null
    this.bindGroup = null
    this.channels = []
    this.canvas = null
    this._cpuVertices = new Float32Array(0)
    this._cpuVertexFloats = 0
  }
}
