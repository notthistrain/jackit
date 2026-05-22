import type { TooltipData } from './useWaveformInteraction'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWaveformInteraction } from './useWaveformInteraction'
import { waveformCanvas } from './waveform-canvas.variants'
import { WaveformOverlay } from './WaveformOverlay'
import { WaveformRenderer } from './WaveformRenderer'

interface WaveformCanvasProps {
  channels: Record<string, number[]>
  paused: boolean
}

export function WaveformCanvas({ channels, paused }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WaveformRenderer | null>(null)
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [viewportRange, setViewportRange] = useState({ start: 0, end: 0 })
  const [canvasWidth, setCanvasWidth] = useState(200)

  const syncViewportRange = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer || !renderer.isReady())
      return
    const range = renderer.getVisibleRange()
    setViewportRange((prev) => {
      if (prev.start === range.startIndex && prev.end === range.endIndex)
        return prev
      return { start: range.startIndex, end: range.endIndex }
    })
  }, [])

  // 初始化渲染器
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas)
      return

    let cancelled = false
    const renderer = new WaveformRenderer({
      onDeviceLost: () => {
        setWebgpuAvailable(null)
      },
    })
    rendererRef.current = renderer

    renderer.init(canvas).then((success) => {
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
  }, [syncViewportRange])

  // ResizeObserver: 同步 canvas 渲染分辨率与 CSS 显示尺寸
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas)
      return

    const dpr = window.devicePixelRatio || 1
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
        setCanvasWidth(Math.floor(width))
        rendererRef.current?.markDirty()
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
  }, [channels, syncViewportRange])

  // 暂停/恢复渲染循环
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !renderer.isReady())
      return

    if (paused) {
      renderer.stopRenderLoop()
    }
    else {
      renderer.startRenderLoop()
    }
  }, [paused])

  // 鼠标滚轮缩放
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas)
      return

    const handleWheel = (e: WheelEvent) => {
      if (!rendererRef.current)
        return
      e.preventDefault()
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1
      rendererRef.current.setZoom(rendererRef.current.getEffectiveZoom() * zoomDelta)
      syncViewportRange()
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [syncViewportRange])

  const { handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleDoubleClick, cursor } = useWaveformInteraction({
    canvasRef,
    rendererRef,
    onViewportChange: syncViewportRange,
    onTooltipChange: setTooltip,
  })

  const { error, errorDetail, canvas, container } = waveformCanvas()
  const channelNames = Object.keys(channels)

  if (webgpuAvailable === false) {
    return (
      <div className={error()}>
        WebGPU is not available in this environment.
        <br />
        <span className={errorDetail()}>Waveform rendering requires a WebGPU-capable browser.</span>
      </div>
    )
  }

  return (
    <div className={container()}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        className={canvas()}
        style={{ cursor }}
      />

      {webgpuAvailable && (
        <WaveformOverlay
          channelNames={channelNames}
          viewportRange={viewportRange}
          tooltip={tooltip}
          canvasWidth={canvasWidth}
        />
      )}
    </div>
  )
}
