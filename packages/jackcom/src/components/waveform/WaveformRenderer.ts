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

    // 创建 render pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: this.device.createShaderModule({ code: WAVEFORM_SHADER }),
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
        module: this.device.createShaderModule({ code: WAVEFORM_SHADER }),
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
    this.zoom = Math.max(0.1, Math.min(level, 100))
  }

  setOffset(x: number): void {
    this.offsetX = x
  }

  render(): void {
    if (!this.device || !this.context || !this.pipeline || !this.uniformBuffer || !this.bindGroup || !this.canvas) return

    const width = this.canvas.width
    const height = this.canvas.height

    // 更新 uniforms
    const uniformData = new Float32Array([
      width, height,             // resolution
      10.0,                      // time_window
      this.channels.length,      // num_channels
      this.offsetX,              // offset_x
      this.zoom,                 // zoom
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

    // 创建/写入顶点 buffer
    const vertexData = new Float32Array(vertices)
    const vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexData)

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
    if (vertices.length > 0) {
      passEncoder.setVertexBuffer(0, vertexBuffer)
      passEncoder.draw(vertices.length / 3)
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
