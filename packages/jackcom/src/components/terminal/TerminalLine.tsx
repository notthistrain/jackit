import { bytesToAscii, formatTimestamp } from '@/lib/formatters'
import type { DisplayFrame } from '@/lib/tauri-events'
import { terminalLine } from './terminal-line.variants'

export type { DisplayFrame }

interface TerminalLineProps {
  frame: DisplayFrame
  hexMode: boolean
}

export function TerminalLine({ frame, hexMode }: TerminalLineProps) {
  const isRx = frame.direction === 'rx'
  const dirColor = isRx ? 'var(--color-rx)' : 'var(--color-tx)'
  const dirLabel = isRx ? 'RX' : 'TX'
  const timeStr = formatTimestamp(frame.timestamp)
  const { root, timestamp, direction, data } = terminalLine()

  return (
    <div className={root()}>
      <span className={timestamp()}>{timeStr}</span>
      <span className={direction()} style={{ color: dirColor }}>{dirLabel}</span>
      <span className={data()}>
        {hexMode ? frame.raw_hex : bytesToAscii(frame.raw_hex.split(' ').map((h) => parseInt(h, 16)))}
      </span>
    </div>
  )
}
