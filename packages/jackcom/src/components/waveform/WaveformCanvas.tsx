import { useEffect, useRef, useState } from 'react'
import { WaveformRenderer } from './WaveformRenderer'
import { waveformCanvas } from './waveform-canvas.variants'

const CHANNEL_COLORS = [
  '#4EC9B0', '#569CD6', '#CE9178', '#DCDCAA',
  '#C586C0', '#6A9955', '#007ACC', '#F4A540',
]

interface WaveformCanvasProps {
  channels: Record<string, number[]>
  paused: boolean
}

interface TooltipData {
  x: number
  y: number
  index: number
  values: { channel: string, value: number, channelIndex: number }[]
}

export function WaveformCanvas({ channels, paused }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WaveformRenderer | null>(null)
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [viewportRange, setViewportRange] = useState({ start: 0, end: 0 })

  const syncViewportRange = () => {
    const renderer = rendererRef.current
    if (!renderer || !renderer.isReady()) return
    const range = renderer.getVisibleRange()
    setViewportRange(prev => {
      if (prev.start === range.startIndex && prev.end === range.endIndex) return prev
      return { start: range.startIndex, end: range.endIndex }
    })
  }

  // 初始化渲染器
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    const renderer = new WaveformRenderer()
    rendererRef.current = renderer

    renderer.init(canvas).then(success => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      setWebgpuAvailable(success)
      if (success) {
        renderer.startRenderLoop()
        syncViewportRange()
      }
    })

    return () => {
      cancelled = true
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  // ResizeObserver: 同步 canvas 渲染分辨率与 CSS 显示尺寸
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
      }
    })

    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  // 更新数据
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateData(channels)
      syncViewportRange()
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

  // 鼠标滚轮缩放（使用原生事件监听器，需 passive:false 才能 preventDefault）
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      if (!rendererRef.current) return
      e.preventDefault()
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1
      rendererRef.current.setZoom(
        rendererRef.current.getEffectiveZoom() * zoomDelta
      )
      syncViewportRange()
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [])

  // 鼠标拖拽平移 + tooltip
  const isDragging = useRef(false)
  const lastX = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    lastX.current = e.clientX
    canvasRef.current.style.cursor = 'grabbing'
    setTooltip(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (!canvas || !renderer) return

    if (isDragging.current) {
      const dx = e.clientX - lastX.current
      lastX.current = e.clientX
      const dpr = window.devicePixelRatio || 1
      const offsetDelta = (dx * dpr) / canvas.width
      renderer.setOffset(renderer.getOffset() - offsetDelta)
      syncViewportRange()
      setTooltip(null)
    } else {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const screenX = (e.clientX - rect.left) * dpr
      const data = renderer.getDataAtScreenX(screenX, canvas.width)
      if (data && data.values.length > 0) {
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          index: data.index,
          values: data.values,
        })
      } else {
        setTooltip(null)
      }
    }
  }

  const handleMouseUp = () => {
    isDragging.current = false
    canvasRef.current.style.cursor = 'crosshair'
  }

  const handleMouseLeave = () => {
    isDragging.current = false
    canvasRef.current.style.cursor = 'crosshair'
    setTooltip(null)
  }

  // 双击重置视图（恢复 autoFit）
  const handleDoubleClick = () => {
    rendererRef.current?.resetView()
    syncViewportRange()
  }

  const { error, errorDetail, canvas } = waveformCanvas()
  const channelNames = Object.keys(channels)

  // WebGPU 不可用提示
  if (webgpuAvailable === false) {
    return (
      <div className={error()}>
        WebGPU is not available in this environment.
        <br />
        <span className={errorDetail()}>
          Waveform rendering requires a WebGPU-capable browser.
        </span>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        className={canvas()}
        style={{ cursor: 'crosshair' }}
      />

      {/* 网格线 + 坐标标签 */}
      {webgpuAvailable && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {/* Y 轴网格线 + 标签 */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <div key={ratio} style={{ position: 'absolute', left: 0, right: 0, top: `${ratio * 100}%` }}>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
              {ratio < 1 && (
                <span style={{
                  position: 'absolute',
                  left: 4,
                  top: 2,
                  fontSize: '9px',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'monospace',
                }}>
                  {Math.round((1 - ratio) * 255)}
                </span>
              )}
            </div>
          ))}

          {/* X 轴网格线 + 标签 */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const index = Math.round(viewportRange.start + (viewportRange.end - viewportRange.start) * ratio)
            return (
              <div key={`x-${ratio}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${ratio * 100}%` }}>
                <div style={{ height: '100%', borderLeft: '1px solid rgba(255,255,255,0.06)' }} />
                <span style={{
                  position: 'absolute',
                  bottom: 2,
                  ...(ratio === 1 ? { right: 3 } : { left: 3 }),
                  fontSize: '9px',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'monospace',
                }}>
                  {index}
                </span>
              </div>
            )
          })}

          {/* 通道图例 */}
          {channelNames.length > 0 && (
            <div style={{ position: 'absolute', right: 4, top: 4, display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {channelNames.slice(0, 8).map((name, i) => (
                <span key={name} style={{ fontSize: '9px', color: CHANNEL_COLORS[i % 8], fontFamily: 'monospace' }}>
                  {name}
                </span>
              ))}
              {channelNames.length > 8 && (
                <span style={{ fontSize: '9px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                  +{channelNames.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 悬浮数据提示 */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltip.x + 12, (canvasRef.current?.clientWidth ?? 200) - 160),
          top: Math.max(tooltip.y - 60, 4),
          background: 'rgba(30, 30, 30, 0.95)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '10px',
          fontFamily: 'monospace',
          color: 'var(--color-text)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          <div style={{ color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
            #{tooltip.index}
          </div>
          {tooltip.values.slice(0, 8).map(v => (
            <div key={v.channel} style={{ color: CHANNEL_COLORS[v.channelIndex % CHANNEL_COLORS.length] }}>
              {v.channel}: {Math.round(v.value * 255)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
