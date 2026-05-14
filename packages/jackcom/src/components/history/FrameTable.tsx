import type { DisplayFrame } from '@/lib/tauri-events'
import { FrameDetail } from './FrameDetail'

interface FrameTableProps {
  frames: DisplayFrame[]
  expandedFrameId: number | null
  onToggleExpand: (id: number) => void
}

const dirColor = (dir: string) => dir === 'rx' ? 'var(--color-rx)' : 'var(--color-tx)'
const protoColor = (proto: string) => {
  switch (proto.toLowerCase()) {
    case 'modbus': return '#569CD6'
    case 'at': return '#CE9178'
    case 'json': return '#DCDCAA'
    default: return 'var(--color-text)'
  }
}

export function FrameTable({ frames, expandedFrameId, onToggleExpand }: FrameTableProps) {
  if (frames.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: '11px',
      }}>
        选择左侧会话以查看帧数据
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-editor-bg)' }}>
      {/* 表头 */}
      <div style={{
        display: 'flex',
        padding: '4px 10px',
        background: 'var(--color-sidebar-bg)',
        color: 'var(--color-text-secondary)',
        fontSize: '10px',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}>
        <span style={{ width: '90px' }}>Time</span>
        <span style={{ width: '30px' }}>Dir</span>
        <span style={{ width: '60px' }}>Protocol</span>
        <span style={{ flex: 1 }}>Data</span>
      </div>
      {/* 数据行 */}
      {frames.map(frame => {
        const isExpanded = frame.id === expandedFrameId
        const timeStr = new Date(frame.timestamp).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        })
        return (
          <div key={frame.id}>
            <div
              onClick={() => onToggleExpand(frame.id)}
              style={{
                display: 'flex',
                padding: '3px 10px',
                borderBottom: '1px solid #2d2d2d',
                cursor: 'pointer',
                background: isExpanded ? '#2a2d2e' : 'transparent',
              }}
            >
              <span style={{ width: '90px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                {timeStr}
              </span>
              <span style={{ width: '30px', color: dirColor(frame.direction), fontSize: '11px', fontWeight: 600 }}>
                {frame.direction.toUpperCase()}
              </span>
              <span style={{ width: '60px', color: protoColor(frame.protocol), fontSize: '11px' }}>
                {frame.protocol}
              </span>
              <span style={{ flex: 1, color: 'var(--color-text)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {frame.raw_hex.substring(0, 30)}{frame.raw_hex.length > 30 ? ' ...' : ''}
                {frame.summary && (
                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    {frame.summary.substring(0, 40)}
                  </span>
                )}
              </span>
            </div>
            {isExpanded && <FrameDetail frame={frame} />}
          </div>
        )
      })}
    </div>
  )
}
