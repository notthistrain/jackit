import type { DisplayFrame } from './TerminalLine'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMainStore } from '@/lib/store'
import { TerminalLine } from './TerminalLine'

interface TerminalViewProps {
  frames: DisplayFrame[]
}

export function TerminalView({ frames }: TerminalViewProps) {
  const hexDisplay = useMainStore(s => s.hexDisplay)
  const parentRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

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
    if (!parentRef.current)
      return
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30
    setAutoScroll(isAtBottom)
  }, [])

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--color-editor-bg)',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const frame = frames[virtualRow.index]
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
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
