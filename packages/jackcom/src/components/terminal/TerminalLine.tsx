import { bytesToAscii, formatTimestamp } from '@/lib/formatters'

export interface DisplayFrame {
  id: number
  timestamp: string
  direction: 'rx' | 'tx'
  raw_hex: string
  formatted: string
  protocol: string
  summary: string
}

interface TerminalLineProps {
  frame: DisplayFrame
  hexMode: boolean
}

export function TerminalLine({ frame, hexMode }: TerminalLineProps) {
  const isRx = frame.direction === 'rx'
  const dirColor = isRx ? 'var(--color-rx)' : 'var(--color-tx)'
  const dirLabel = isRx ? 'RX' : 'TX'
  const timeStr = formatTimestamp(frame.timestamp)

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '1px 6px',
      fontSize: '12px',
      fontFamily: "'Consolas', 'Courier New', monospace",
      lineHeight: '1.5',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: 'var(--color-timestamp)', minWidth: '100px' }}>{timeStr}</span>
      <span style={{ color: dirColor, fontWeight: 700, minWidth: '20px' }}>{dirLabel}</span>
      <span style={{ color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {hexMode ? frame.raw_hex : bytesToAscii(frame.raw_hex.split(' ').map((h) => parseInt(h, 16)))}
      </span>
    </div>
  )
}
