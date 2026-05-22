import type { WaveformRenderer } from './WaveformRenderer'
import { useCallback, useRef, useState } from 'react'

interface TooltipData {
  x: number
  y: number
  index: number
  values: { channel: string, value: number, channelIndex: number }[]
}

interface UseWaveformInteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  rendererRef: React.MutableRefObject<WaveformRenderer | null>
  onViewportChange: () => void
  onTooltipChange: (tooltip: TooltipData | null) => void
}

export function useWaveformInteraction({
  canvasRef,
  rendererRef,
  onViewportChange,
  onTooltipChange,
}: UseWaveformInteractionOptions) {
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const [cursor, setCursor] = useState('crosshair')

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    lastX.current = e.clientX
    setCursor('grabbing')
    onTooltipChange(null)
  }, [onTooltipChange])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (!canvas || !renderer)
      return

    if (isDragging.current) {
      const dx = e.clientX - lastX.current
      lastX.current = e.clientX
      const dpr = window.devicePixelRatio || 1
      const offsetDelta = (dx * dpr) / canvas.width
      renderer.setOffset(renderer.getOffset() - offsetDelta)
      onViewportChange()
      onTooltipChange(null)
    }
    else {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const screenX = (e.clientX - rect.left) * dpr
      const data = renderer.getDataAtScreenX(screenX, canvas.width)
      if (data && data.values.length > 0) {
        onTooltipChange({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          index: data.index,
          values: data.values,
        })
      }
      else {
        onTooltipChange(null)
      }
    }
  }, [canvasRef, rendererRef, onViewportChange, onTooltipChange])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    setCursor('crosshair')
  }, [])

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false
    setCursor('crosshair')
    onTooltipChange(null)
  }, [onTooltipChange])

  const handleDoubleClick = useCallback(() => {
    rendererRef.current?.resetView()
    onViewportChange()
  }, [rendererRef, onViewportChange])

  return { handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleDoubleClick, cursor }
}

export type { TooltipData }
