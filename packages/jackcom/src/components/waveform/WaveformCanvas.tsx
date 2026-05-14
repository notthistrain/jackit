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
      rendererRef.current.getZoom() * zoomDelta
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
      rendererRef.current.getOffset() - offsetDelta
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
