import { useCallback, useEffect, useRef } from 'react'
import { WaveformCanvas } from '@/components/waveform/WaveformCanvas'
import { useDataFeed } from '@/hooks/useDataFeed'
import { getPortFromUrl } from '@/lib/window'
import { useWaveformStore } from '@/stores/waveform-store'

export default function WaveformApp() {
  const { portId, setPortId, channels, paused, togglePause, clear, addDataBatch } = useWaveformStore()
  const { frames } = useDataFeed({ portId })

  // 从 URL 获取端口名
  useEffect(() => {
    const port = getPortFromUrl()
    if (port)
      setPortId(port)
  }, [setPortId])

  // 将收到的帧数据解析为波形通道
  const lastProcessedId = useRef(0)
  useEffect(() => {
    if (paused)
      return
    const batch: [string, number][] = []
    for (const frame of frames) {
      if (frame.id <= lastProcessedId.current)
        continue
      lastProcessedId.current = frame.id
      const bytes = frame.raw_hex.trim().split(/\s+/).map(h => Number.parseInt(h, 16))
      for (let i = 0; i < bytes.length; i++) {
        if (!Number.isNaN(bytes[i]))
          batch.push([`Byte ${i}`, bytes[i] / 255])
      }
    }
    if (batch.length > 0)
      addDataBatch(batch)
  }, [frames, paused, addDataBatch])

  const handleClear = useCallback(() => {
    lastProcessedId.current = 0
    clear()
  }, [clear])

  const hasData = Object.keys(channels).length > 0

  return (
    <div style={{
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
    }}
    >
      {/* 标题栏 — 系统窗口已自带标题，此处省略 */}

      {/* 波形区 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!hasData && !portId && (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            No port specified. Open from main window toolbar.
          </div>
        )}
        {!hasData && portId && (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            Waiting for data from
            {' '}
            {portId}
            ...
          </div>
        )}
        {hasData && (
          <WaveformCanvas channels={channels} paused={paused} />
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
      }}
      >
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
          onClick={handleClear}
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
        <span style={{ marginLeft: 'auto', fontSize: '10px' }}>
          {frames.length}
          {' '}
          frames
        </span>
      </div>
    </div>
  )
}
