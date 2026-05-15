import { WAVEFORM_SHADER } from './shaders.wgsl'

interface ChannelData {
  name: string
  values: number[]
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

  isReady(): boolean {
    return this.device !== null && this.pipeline !== null
  }

  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    // 检查 WebGPU 支持
    if (!navigator.gpu) return false

    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) return false

    this.device = await adapter.requestDevice()
    this.canvas = canvas

    // 配置 canvas context
    this.context = canvas.getContext('webgpu') as GPUCanvasContext | null
    if (!this.context) return false

    this.format = navigator.gpu.getPreferredCanvasFormat()
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    })

    // 创建 uniform buffer（16 个 float = 64 bytes，满足 16 字节对齐）
    this.uniformBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // 创建 bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    })

    // 创建 shader module（vertex 和 fragment 共用）
    const shaderModule = this.device.createShaderModule({ code: WAVEFORM_SHADER })

    // 创建 render pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'line_vertex',
        buffers: [{
          arrayStride: 12, // 3 x f32
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32' as GPUVertexFormat },   // point_index
            { shaderLocation: 1, offset: 4, format: 'float32' as GPUVertexFormat },   // value
            { shaderLocation: 2, offset: 8, format: 'float32' as GPUVertexFormat },   // channel_id
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
    })

    // 创建 bind group
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
  }

  setZoom(level: number): void {
    this.autoFit = false
    this.zoom = Math.max(0.1, Math.min(level, 100))
  }

  setOffset(x: number): void {
    this.offsetX = x
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
  }

  private getEffectiveZoom(): number {
    if (this.autoFit && this.channels.length > 0 && this.canvas) {
      const maxLen = this.channels.reduce((max, ch) => Math.max(max, ch.values.length), 1)
      return this.canvas.width / maxLen
    }
    return this.zoom
  }

  getDataAtScreenX(screenX: number, canvasWidth: number): { index: number, values: { channel: string, value: number, channelIndex: number }[] } | null {
    if (this.channels.length === 0) return null
    const effectiveZoom = this.getEffectiveZoom()
    const maxPoints = canvasWidth / effectiveZoom
    const offsetX = this.autoFit ? 0 : this.offsetX
    const xClip = (screenX / canvasWidth) * 2 - 1
    const xNorm = (xClip + 1) / 2
    const pointIndex = Math.round((xNorm - offsetX) * maxPoints)
    if (pointIndex < 0) return null
    const values = this.channels
      .map((ch, idx) => ({ channel: ch.name, value: ch.values[pointIndex], channelIndex: idx }))
      .filter((v): v is { channel: string, value: number, channelIndex: number } => v.value !== undefined)
    if (values.length === 0) return null
    return { index: pointIndex, values }
  }

  render(): void {
    if (!this.device || !this.context || !this.pipeline || !this.uniformBuffer || !this.bindGroup || !this.canvas) return

    const width = this.canvas.width
    const height = this.canvas.height

    const effectiveZoom = this.getEffectiveZoom()
    // 更新 uniforms
    const uniformData = new Float32Array([
      width, height,             // resolution
      10.0,                      // time_window
      this.channels.length,      // num_channels
      this.autoFit ? 0 : this.offsetX, // offset_x
      effectiveZoom,             // zoom
      0, 0, 0, 0,               // padding
    ])
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)

    // 构建顶点数据
    const vertices: number[] = []
    for (let ch = 0; ch < this.channels.length; ch++) {
      const { values } = this.channels[ch]
      for (let i = 0; i < values.length; i++) {
        vertices.push(i, values[i], ch)
      }
    }

    // 创建/复用顶点 buffer
    const vertexData = new Float32Array(vertices)
    const neededSize = vertexData.byteLength
    if (!this.vertexBuffer || this.vertexBufferSize < neededSize) {
      this.vertexBuffer?.destroy()
      this.vertexBuffer = this.device.createBuffer({
        size: neededSize || 4, // 至少 4 bytes 避免 0 size
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      })
      this.vertexBufferSize = neededSize || 4
    }
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexData)

    // 渲染
    const textureView = this.context.getCurrentTexture().createView()
    const commandEncoder = this.device.createCommandEncoder()
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.118, g: 0.118, b: 0.118, a: 1.0 }, // --color-editor-bg
        loadOp: 'clear',
        storeOp: 'store',
      }],
    })

    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(0, this.bindGroup)
    if (vertices.length > 0 && this.vertexBuffer) {
      passEncoder.setVertexBuffer(0, this.vertexBuffer)
      // 分通道绘制，避免通道间出现连接线
      let firstVertex = 0
      for (const ch of this.channels) {
        const count = ch.values.length
        if (count >= 2) {
          passEncoder.draw(count, 1, firstVertex)
        }
        firstVertex += count
      }
    }
    passEncoder.end()

    this.device.queue.submit([commandEncoder.finish()])
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
    this.device?.destroy()
    this.device = null
    this.context = null
    this.pipeline = null
    this.uniformBuffer = null
    this.bindGroup = null
    this.channels = []
    this.canvas = null
  }
}
