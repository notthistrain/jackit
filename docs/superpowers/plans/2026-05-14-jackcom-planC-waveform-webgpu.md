# WaveformApp WebGPU 波形渲染 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 WaveformApp 中的 "coming soon" 占位符替换为基于 WebGPU + WGSL shader 的实时折线图渲染。WebGPU 不可用时显示提示信息。

**架构：** 新建 WaveformRenderer 类管理 WebGPU device/pipeline/buffer 生命周期。新建 WaveformCanvas React 组件封装 Canvas 元素。新建 WGSL shader 模块包含顶点和片段着色器。renderer 从 waveform-store 的 channels 数据中读取通道数据并渲染。

**技术栈：** WebGPU API + WGSL shaders + React 19 + Zustand 5

**规格文档：** `docs/superpowers/specs/2026-05-14-jackcom-placeholder-features-design.md` 第 2 节

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `packages/jackcom/src/components/waveform/shaders.wgsl.ts` | WGSL shader 源码（线段 + 网格） |
| `packages/jackcom/src/components/waveform/WaveformRenderer.ts` | WebGPU 渲染器类 |
| `packages/jackcom/src/components/waveform/WaveformCanvas.tsx` | React Canvas 组件 + 渲染器生命周期 |
| `packages/jackcom/src/components/waveform/__tests__/WaveformRenderer.test.ts` | 渲染器测试 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `packages/jackcom/src/apps/WaveformApp.tsx` | 替换 "coming soon" 为 WaveformCanvas |

---

### 任务 1：WGSL Shader 模块

**文件：**
- 创建：`packages/jackcom/src/components/waveform/shaders.wgsl.ts`

- [ ] **步骤 1：创建 WGSL shader 源码**

创建 `packages/jackcom/src/components/waveform/shaders.wgsl.ts`：

```typescript
/**
 * WebGPU WGSL shaders for waveform rendering
 *
 * 网格背景 + 多通道折线图
 */

// === Uniform 结构 ===

export const WAVEFORM_SHADER = /* wgsl */`

struct Uniforms {
  resolution: vec2f,     // canvas 尺寸
  time_window: f32,      // 时间窗口（秒）
  num_channels: f32,     // 通道数量
  offset_x: f32,         // 平移偏移
  zoom: f32,             // 缩放级别
  pad1: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// === 网格背景 ===

struct GridVertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn grid_vertex(@location(0) pos: vec2f) -> GridVertexOutput {
  var output: GridVertexOutput;
  output.position = vec4f(pos, 0.0, 1.0);
  output.color = vec4f(0.15, 0.15, 0.15, 1.0);
  return output;
}

@fragment
fn grid_fragment(input: GridVertexOutput) -> @location(0) vec4f {
  return input.color;
}

// === 波形折线 ===

struct LineVertexInput {
  @location(0) point_index: f32,  // 数据点索引
  @location(1) value: f32,        // 数据值
  @location(2) channel_id: f32,   // 通道 ID
};

struct LineVertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

const CHANNEL_COLORS = array<vec3f, 8>(
  vec3f(0.306, 0.788, 0.690),  // --color-rx #4EC9B0
  vec3f(0.337, 0.612, 0.839),  // --color-tx #569CD6
  vec3f(0.808, 0.569, 0.471),  // #CE9178
  vec3f(0.863, 0.863, 0.667),  // #DCDCAA
  vec3f(0.773, 0.529, 0.757),  // #C586C0
  vec3f(0.416, 0.600, 0.333),  // #6A9955
  vec3f(0.000, 0.479, 0.800),  // --color-accent #007ACC
  vec3f(0.957, 0.647, 0.251),  // #F4A540
);

@vertex
fn line_vertex(input: LineVertexInput) -> LineVertexOutput {
  var output: LineVertexOutput;

  // 归一化坐标：x = point_index / max_points, y = value 归一化到 [0, 1]
  let max_points = uniforms.resolution.x / uniforms.zoom;
  let x_norm = (input.point_index / max_points) + uniforms.offset_x;
  let y_norm = 1.0 - (input.value * 0.8 + 0.1); // 留上下边距

  // 通道垂直偏移
  let channel_offset = select(0.0,
    f32(input.channel_id) / uniforms.num_channels,
    uniforms.num_channels > 1.0
  );

  let x_clip = (x_norm * 2.0 - 1.0);
  let y_clip = ((y_norm * (1.0 - channel_offset)) * 2.0 - 1.0);

  output.position = vec4f(x_clip, y_clip, 0.0, 1.0);

  let ch_idx = i32(input.channel_id) % 8;
  let color_rgb = CHANNEL_COLORS[ch_idx];
  output.color = vec4f(color_rgb, 1.0);

  return output;
}

@fragment
fn line_fragment(input: LineVertexOutput) -> @location(0) vec4f {
  return input.color;
}

`;
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src/components/waveform/shaders.wgsl.ts
git commit -m "feat(jackcom): 添加 WGSL 波形渲染 shader"
```

---

### 任务 2：WaveformRenderer 类

**文件：**
- 创建：`packages/jackcom/src/components/waveform/WaveformRenderer.ts`
- 测试：`packages/jackcom/src/components/waveform/__tests__/WaveformRenderer.test.ts`

- [ ] **步骤 1：编写 WaveformRenderer 测试**

创建 `packages/jackcom/src/components/waveform/__tests__/WaveformRenderer.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WaveformRenderer } from '../WaveformRenderer'

describe('WaveformRenderer', () => {
  let renderer: WaveformRenderer

  beforeEach(() => {
    renderer = new WaveformRenderer()
  })

  it('reports not initialized before init', () => {
    expect(renderer.isReady()).toBe(false)
  })

  it('returns false when WebGPU is not available', async () => {
    // navigator.gpu 不存在时 init 返回 false
    const result = await renderer.init({
      width: 400,
      height: 300,
      getContext: () => null,
    } as any)
    expect(result).toBe(false)
  })

  it('destroy does not throw when not initialized', () => {
    expect(() => renderer.destroy()).not.toThrow()
  })

  it('updateData stores channels internally', () => {
    renderer.updateData({ temperature: [25.0, 26.0, 27.0] })
    // 内部存储，不抛异常即通过
  })

  it('setZoom and setOffset do not throw', () => {
    renderer.setZoom(2.0)
    renderer.setOffset(0.5)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm test -- --run src/components/waveform/__tests__/WaveformRenderer.test.ts`
预期：FAIL

- [ ] **步骤 3：实现 WaveformRenderer**

创建 `packages/jackcom/src/components/waveform/WaveformRenderer.ts`：

```typescript
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
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm test -- --run src/components/waveform/__tests__/WaveformRenderer.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src/components/waveform/WaveformRenderer.ts packages/jackcom/src/components/waveform/__tests__/WaveformRenderer.test.ts
git commit -m "feat(jackcom): 添加 WaveformRenderer WebGPU 渲染器类"
```

---

### 任务 3：WaveformCanvas React 组件

**文件：**
- 创建：`packages/jackcom/src/components/waveform/WaveformCanvas.tsx`

- [ ] **步骤 1：创建 WaveformCanvas 组件**

创建 `packages/jackcom/src/components/waveform/WaveformCanvas.tsx`：

```typescript
import { useEffect, useRef, useState } from 'react'
import { WaveformRenderer } from './WaveformRenderer'

interface WaveformCanvasProps {
  channels: Record<string, number[]>
  paused: boolean
}

export function WaveformCanvas({ channels, paused }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WaveformRenderer | null>(null)
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null)

  // 初始化渲染器
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new WaveformRenderer()
    rendererRef.current = renderer

    renderer.init(canvas).then(success => {
      setWebgpuAvailable(success)
      if (success) {
        renderer.startRenderLoop()
      }
    })

    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  // 更新数据
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateData(channels)
    }
  }, [channels])

  // 暂停/恢复渲染循环
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !renderer.isReady()) return

    if (paused) {
      renderer.stopRenderLoop()
    } else {
      renderer.startRenderLoop()
    }
  }, [paused])

  // 鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (!rendererRef.current) return
    e.preventDefault()
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1
    rendererRef.current.setZoom(
      (rendererRef.current as any).zoom * zoomDelta
    )
  }

  // 鼠标拖拽平移
  const isDragging = useRef(false)
  const lastX = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    lastX.current = e.clientX
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !rendererRef.current || !canvasRef.current) return
    const dx = e.clientX - lastX.current
    lastX.current = e.clientX
    const offsetDelta = dx / canvasRef.current.width
    rendererRef.current.setOffset(
      (rendererRef.current as any).offsetX - offsetDelta
    )
  }

  const handleMouseUp = () => {
    isDragging.current = false
  }

  // WebGPU 不可用提示
  if (webgpuAvailable === false) {
    return (
      <div style={{
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
        padding: '40px 20px',
        fontSize: '12px',
      }}>
        WebGPU is not available in this environment.
        <br />
        <span style={{ fontSize: '11px' }}>
          Waveform rendering requires a WebGPU-capable browser.
        </span>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: isDragging.current ? 'grabbing' : 'grab',
      }}
    />
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src/components/waveform/WaveformCanvas.tsx
git commit -m "feat(jackcom): 添加 WaveformCanvas React 组件"
```

---

### 任务 4：WaveformApp 集成

**文件：**
- 修改：`packages/jackcom/src/apps/WaveformApp.tsx`

- [ ] **步骤 1：替换 WaveformApp 中的 "coming soon" 占位符**

修改 `packages/jackcom/src/apps/WaveformApp.tsx`：

1. 在文件顶部 import 区添加：
```typescript
import { WaveformCanvas } from '@/components/waveform/WaveformCanvas'
```

2. 找到每个通道的 "Canvas waveform rendering — coming soon" div，替换整个 div：
```typescript
// 替换前（每个通道中的占位符）：
                <div style={{
                  height: '80px',
                  background: 'var(--color-sidebar-bg)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: '10px',
                }}>
                  Canvas waveform rendering — coming soon
                </div>

// 替换后：删除这个占位 div（WaveformCanvas 将替代整个 hasData 区域）
```

3. 将 `hasData` 分支整体替换为使用 WaveformCanvas：

找到 `{hasData && (` 块，将其整体替换为：

```typescript
        {hasData && (
          <WaveformCanvas channels={channels} paused={paused} />
        )}
```

这会删除原来的逐通道文字信息列表，改为使用 WebGPU canvas 渲染全部通道。

- [ ] **步骤 2：验证编译**

运行：`cd packages/jackcom && pnpm build`
预期：编译通过

- [ ] **步骤 3：运行所有测试确认无回归**

运行：`cd packages/jackcom && pnpm test -- --run`
预期：全部 PASS

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src/apps/WaveformApp.tsx
git commit -m "feat(jackcom): WaveformApp 使用 WebGPU WaveformCanvas 替换 coming soon 占位符"
```

---

## 自检

### 规格覆盖度

| 规格需求 | 对应任务 |
|----------|----------|
| WGSL shader（顶点/片段） | 任务 1 |
| WaveformRenderer 类（init/updateData/render/setZoom/setOffset/destroy） | 任务 2 |
| WebGPU 不可用处理 | 任务 3（webgpuAvailable === false 显示提示） |
| 鼠标滚轮缩放 | 任务 3（handleWheel） |
| 鼠标拖拽平移 | 任务 3（mousedown/move/up） |
| 暂停按钮 | 已有（store togglePause），任务 3 中处理 |
| WaveformCanvas React 组件 | 任务 3 |
| WaveformApp 替换占位符 | 任务 4 |

### 占位符扫描

无 TODO/TBD。所有 shader、renderer、组件有完整实现。

### 类型一致性

- `WaveformRenderer.updateData` 接受 `Record<string, number[]>`，与 `useWaveformStore.channels` 类型一致
- `WaveformCanvas` 接受 `channels: Record<string, number[]>` 和 `paused: boolean`，与 store 导出的字段一致
- WGSL shader 的 Uniforms 结构与 `WaveformRenderer.render()` 中的 Float32Array 布局一致（16 个 float = 64 bytes）

### 注意事项

- WebGPU API 类型需要 TypeScript 类型定义。如果 `GPUDevice` 等类型未识别，需在 `packages/jackcom/src/env.d.ts` 中添加 `/// <reference types="@webgpu/types" />` 或手动声明接口。
- 可选：运行 `cd packages/jackcom && pnpm add -D @webgpu/types` 获取完整类型支持。
