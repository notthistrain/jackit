import { useT } from '@/i18n'
import type { DisplayFrame } from '@/lib/tauri-events'
import { FrameDetail } from './FrameDetail'
import { frameTable } from './frame-table.variants'

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
  const { t } = useT()
  const { empty, root, header, headerTime, headerDir, headerProto, headerData, row, cellTime, cellDir, cellProto, cellData, cellSummary } = frameTable()

  if (frames.length === 0) {
    return (
      <div className={empty()}>
        {t('history.noFrames')}
      </div>
    )
  }

  return (
    <div className={root()}>
      {/* 表头 */}
      <div className={header()}>
        <span className={headerTime()}>Time</span>
        <span className={headerDir()}>Dir</span>
        <span className={headerProto()}>Protocol</span>
        <span className={headerData()}>Data</span>
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
              data-expanded={isExpanded}
              className={row()}
            >
              <span className={cellTime()}>
                {timeStr}
              </span>
              <span className={cellDir()} style={{ color: dirColor(frame.direction) }}>
                {frame.direction.toUpperCase()}
              </span>
              <span className={cellProto()} style={{ color: protoColor(frame.protocol) }}>
                {frame.protocol}
              </span>
              <span className={cellData()}>
                {frame.raw_hex.substring(0, 30)}{frame.raw_hex.length > 30 ? ' ...' : ''}
                {frame.summary && (
                  <span className={cellSummary()}>
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
