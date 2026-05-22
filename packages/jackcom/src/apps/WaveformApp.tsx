import { useCallback, useEffect, useRef } from 'react'
import { waveformApp } from '@/components/waveform/waveform-app.variants'
import { WaveformCanvas } from '@/components/waveform/WaveformCanvas'
import { useDataFeed } from '@/hooks/useDataFeed'
import { getPortFromUrl } from '@/lib/window'
import { useWaveformStore } from '@/stores/waveform-store'

export function WaveformApp() {
  const portId = useWaveformStore(s => s.portId)
  const setPortId = useWaveformStore(s => s.setPortId)
  const channels = useWaveformStore(s => s.channels)
  const paused = useWaveformStore(s => s.paused)
  const togglePause = useWaveformStore(s => s.togglePause)
  const clear = useWaveformStore(s => s.clear)
  const addDataBatch = useWaveformStore(s => s.addDataBatch)
  const { frames } = useDataFeed({ portId })

  const { root, waveformArea, emptyState, toolbar, pauseBtn, clearBtn, frameCount } = waveformApp({ paused })

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
    <div className={root()}>
      {/* 波形区 */}
      <div className={waveformArea()}>
        {!hasData && !portId && (
          <div className={emptyState()}>
            No port specified. Open from main window toolbar.
          </div>
        )}
        {!hasData && portId && (
          <div className={emptyState()}>
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
      <div className={toolbar()}>
        <button className={pauseBtn()} onClick={togglePause}>
          {paused ? '\u25B6 Resume' : '\u23F8 Pause'}
        </button>
        <button className={clearBtn()} onClick={handleClear}>
          Clear
        </button>
        <span className={frameCount()}>
          {frames.length}
          {' '}
          frames
        </span>
      </div>
    </div>
  )
}
