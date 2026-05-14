import { useRef, useState, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TerminalLine, type DisplayFrame } from './TerminalLine'
import { useMainStore } from '@/lib/store'
import { terminalView } from './terminal-view.variants'

interface TerminalViewProps {
  frames: DisplayFrame[]
}

export function TerminalView({ frames }: TerminalViewProps) {
  const hexDisplay = useMainStore((s) => s.hexDisplay)
  const parentRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const { root, inner, row } = terminalView()

  const virtualizer = useVirtualizer({
    count: frames.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 20,
  })

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && frames.length > 0) {
      virtualizer.scrollToIndex(frames.length - 1, { align: 'end' })
    }
  }, [frames.length, autoScroll, virtualizer])

  const handleScroll = useCallback(() => {
    if (!parentRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30
    setAutoScroll(isAtBottom)
  }, [])

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className={root()}
    >
      <div
        className={inner()}
        style={{ height: virtualizer.getTotalSize() + 'px' }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const frame = frames[virtualRow.index]
          return (
            <div
              key={virtualRow.index}
              className={row()}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <TerminalLine frame={frame} hexMode={hexDisplay} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { DisplayFrame }
