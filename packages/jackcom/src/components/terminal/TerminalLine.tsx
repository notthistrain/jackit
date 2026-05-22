import type { DisplayFrame } from '@/lib/tauri-events'
import { bytesToAscii, formatTimestamp } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { terminalLine } from './terminal-line.variants'

export type { DisplayFrame }

interface TerminalLineProps {
  frame: DisplayFrame
  hexMode: boolean
}

export function TerminalLine({ frame, hexMode }: TerminalLineProps) {
  const isRx = frame.direction === 'rx'
  const dirColor = isRx ? 'text-rx' : 'text-tx'
  const dirLabel = isRx ? 'RX' : 'TX'
  const timeStr = formatTimestamp(frame.timestamp)

  const { root, timestamp, direction, data } = terminalLine()

  return (
    <div className={root()}>
      <span className={timestamp()}>{timeStr}</span>
      <span className={cn(direction(), dirColor)}>{dirLabel}</span>
      <span className={data()}>
        {hexMode ? frame.raw_hex : bytesToAscii(frame.raw_hex.split(' ').map(h => Number.parseInt(h, 16)))}
      </span>
    </div>
  )
}
