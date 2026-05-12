import { useEffect } from 'react'
import { getPortFromUrl } from '@/lib/window'
import { useWaveformStore } from '@/stores/waveform-store'
import { useDataFeed } from '@/hooks/useDataFeed'

export default function WaveformApp() {
  const { portId, setPortId, channels, paused, togglePause, clear } = useWaveformStore()
  const { frames } = useDataFeed({ portId })

  useEffect(() => {
    const port = getPortFromUrl()
    if (port) setPortId(port)
  }, [setPortId])

  const channelNames = Object.keys(channels)
  const hasData = channelNames.length > 0

  return (
    <div style={{
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* 标题栏 */}
      <div style={{
        background: 'var(--color-titlebar-bg)',
        padding: '4px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <span style={{ color: 'var(--color-accent)' }}>&#x1F4CA;</span>
        <span style={{ fontSize: '12px', fontWeight: 600 }}>
          Waveform — {portId ?? 'No Port'}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)', fontSize: '10px' }}>
          {frames.length} frames received
        </span>
      </div>

      {/* 波形区 */}
      <div style={{ flex: 1, padding: '10px', overflow: 'auto' }}>
        {!hasData && !portId && (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            No port specified. Open from main window toolbar.
          </div>
        )}
        {!hasData && portId && (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            Waiting for data from {portId}...
          </div>
        )}
        {hasData && (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            {channelNames.map((ch) => (
              <div key={ch} style={{ marginBottom: '8px' }}>
                <div style={{ color: 'var(--color-rx)', fontWeight: 600 }}>{ch}</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>
                  {channels[ch].length} points · latest: {channels[ch][channels[ch].length - 1]?.toFixed(2) ?? 'N/A'}
                </div>
                <div style={{
                  height: '80px',
                  background: 'var(--color-sidebar-bg)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: '10px',
                }}>
                  Canvas waveform rendering — coming soon
                </div>
              </div>
            ))}
          </div>
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
          onClick={togglePause}
          style={{
            background: paused ? 'var(--color-accent)' : 'transparent',
            color: paused ? '#fff' : 'var(--color-text-secondary)',
            border: 'none',
            padding: '2px 8px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          {paused ? '\u25B6 Resume' : '\u23F8 Pause'}
        </button>
        <button
          onClick={clear}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
