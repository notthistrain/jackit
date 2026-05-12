import { useEffect } from 'react'
import { getPortFromUrl } from '@/lib/window'
import { useDecoderStore } from '@/stores/decoder-store'
import { useDataFeed } from '@/hooks/useDataFeed'

export default function DecoderApp() {
  const { portId, setPortId, pinnedFrame, pinFrame } = useDecoderStore()
  const { frames } = useDataFeed({ portId })

  useEffect(() => {
    const port = getPortFromUrl()
    if (port) setPortId(port)
  }, [setPortId])

  // 使用最新帧作为当前帧
  const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null
  const displayFrame = pinnedFrame ?? latestFrame

  return (
    <div style={{
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Consolas', 'Courier New', monospace",
    }}>
      {/* 标题栏 */}
      <div style={{
        background: 'var(--color-titlebar-bg)',
        padding: '4px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--color-border)',
        fontSize: '12px',
      }}>
        <span style={{ color: 'var(--color-accent)' }}>&#x1F52C;</span>
        <span style={{ fontWeight: 600 }}>Decoder — {portId ?? 'No Port'}</span>
      </div>

      {/* 帧详情 */}
      <div style={{ flex: 1, padding: '10px', overflow: 'auto', fontSize: '12px' }}>
        {!displayFrame && (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            {portId ? `Waiting for data from ${portId}...` : 'No port specified.'}
          </div>
        )}
        {displayFrame && (
          <>
            <div style={{ marginBottom: '8px' }}>
              <span style={{
                color: 'var(--color-accent)',
                fontWeight: 600,
                fontSize: '14px',
              }}>
                {displayFrame.protocol.toUpperCase()} Frame
              </span>
            </div>
            <div style={{ color: 'var(--color-text)', lineHeight: '1.8' }}>
              <div>
                <span style={{ color: 'var(--color-timestamp)' }}>Direction</span>{' '}
                <span style={{ color: displayFrame.direction === 'rx' ? 'var(--color-rx)' : 'var(--color-tx)' }}>
                  {displayFrame.direction.toUpperCase()}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--color-timestamp)' }}>Time</span>{' '}
                <span>{displayFrame.timestamp}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-timestamp)' }}>Protocol</span>{' '}
                <span style={{ color: 'var(--color-accent)' }}>{displayFrame.protocol}</span>
              </div>
              {displayFrame.formatted && (
                <div>
                  <span style={{ color: 'var(--color-timestamp)' }}>Parsed</span>{' '}
                  <span style={{ color: 'var(--color-string)' }}>{displayFrame.formatted}</span>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--color-timestamp)' }}>RAW HEX</span>{' '}
                <span>{displayFrame.raw_hex}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 工具栏 */}
      <div style={{
        background: 'var(--color-sidebar-bg)',
        borderTop: '1px solid var(--color-border)',
        padding: '4px 10px',
        display: 'flex',
        gap: '12px',
        fontSize: '10px',
        color: 'var(--color-text-secondary)',
      }}>
        <button
          onClick={() => pinFrame(latestFrame ?? null)}
          style={{
            background: pinnedFrame ? 'var(--color-accent)' : 'transparent',
            color: pinnedFrame ? '#fff' : 'var(--color-text-secondary)',
            border: 'none',
            padding: '2px 8px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          {pinnedFrame ? 'Unpin' : 'Pin Current'}
        </button>
        <button
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '10px',
          }}
        >
          Copy Frame
        </button>
      </div>
    </div>
  )
}
