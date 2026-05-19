import { useCallback, useEffect, useMemo } from 'react'
import { useDataFeed } from '@/hooks/useDataFeed'
import { bytesToAscii, hexToBytes } from '@/lib/formatters'
import { getPortFromUrl } from '@/lib/window'
import { useDecoderStore } from '@/stores/decoder-store'

/** 协议对应的标签颜色 */
const PROTOCOL_COLORS: Record<string, string> = {
  json: '#DCDCAA',
  modbus: '#569CD6',
  at: '#CE9178',
  raw: '#858585',
}

/** 数据区块样式 */
const sectionStyle: React.CSSProperties = {
  borderRadius: '3px',
  padding: '6px 8px',
  marginTop: '6px',
  wordBreak: 'break-all',
  whiteSpace: 'pre-wrap',
  lineHeight: '1.5',
}

/** 区块标签样式 */
function labelStyle(color: string): React.CSSProperties {
  return {
    color,
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '2px',
  }
}

export default function DecoderApp() {
  const { portId, setPortId, pinnedFrame, pinFrame } = useDecoderStore()
  const { frames } = useDataFeed({ portId })

  useEffect(() => {
    const port = getPortFromUrl()
    if (port)
      setPortId(port)
  }, [setPortId])

  const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null
  const displayFrame = pinnedFrame ?? latestFrame

  // 从 raw_hex 派生 ASCII 视图
  const asciiView = useMemo(() => {
    if (!displayFrame?.raw_hex)
      return ''
    const bytes = hexToBytes(displayFrame.raw_hex)
    return bytes ? bytesToAscii(bytes) : ''
  }, [displayFrame?.raw_hex])

  // 协议专属色
  const protoColor = displayFrame
    ? PROTOCOL_COLORS[displayFrame.protocol] ?? '#858585'
    : '#858585'

  const handleCopyFrame = useCallback(() => {
    if (!displayFrame)
      return
    const text = [
      `Protocol: ${displayFrame.protocol}`,
      `Direction: ${displayFrame.direction}`,
      `Time: ${displayFrame.timestamp}`,
      `HEX: ${displayFrame.raw_hex}`,
      `ASCII: ${asciiView}`,
      displayFrame.formatted ? `Parsed: ${displayFrame.formatted}` : null,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }, [displayFrame, asciiView])

  return (
    <div style={{
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '\'Consolas\', \'Courier New\', monospace',
    }}
    >
      {/* 标题栏 */}
      <div style={{
        background: 'var(--color-titlebar-bg)',
        padding: '4px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--color-border)',
        fontSize: '12px',
      }}
      >
        <span style={{ color: 'var(--color-accent)' }}>&#x1F52C;</span>
        <span style={{ fontWeight: 600 }}>
          Decoder —
          {portId ?? 'No Port'}
        </span>
      </div>

      {/* 帧详情 */}
      <div style={{ flex: 1, padding: '8px 10px', overflow: 'auto', fontSize: '12px' }}>
        {!displayFrame && (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            {portId ? `Waiting for data from ${portId}...` : 'No port specified.'}
          </div>
        )}
        {displayFrame && (
          <>
            {/* 帧头：协议标签 + 元信息 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{
                background: protoColor,
                color: '#1E1E1E',
                padding: '1px 6px',
                borderRadius: '2px',
                fontWeight: 700,
                fontSize: '11px',
              }}
              >
                {displayFrame.protocol.toUpperCase()}
              </span>
              <span style={{
                color: displayFrame.direction === 'rx' ? 'var(--color-rx)' : 'var(--color-tx)',
                fontWeight: 600,
              }}
              >
                {displayFrame.direction.toUpperCase()}
              </span>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                {displayFrame.timestamp}
              </span>
            </div>

            {/* ASCII 区块：绿色调背景 */}
            <div style={{ ...sectionStyle, background: 'rgba(78, 201, 176, 0.08)', borderLeft: '2px solid var(--color-rx)' }}>
              <div style={labelStyle('var(--color-rx)')}>ASCII</div>
              <div style={{ color: '#B5CEA8' }}>
                {asciiView || '(empty)'}
              </div>
            </div>

            {/* HEX 区块：蓝色调背景 */}
            <div style={{ ...sectionStyle, background: 'rgba(86, 156, 214, 0.08)', borderLeft: '2px solid var(--color-tx)' }}>
              <div style={labelStyle('var(--color-tx)')}>HEX</div>
              <div style={{ color: '#9CDCFE' }}>
                {displayFrame.raw_hex || '(empty)'}
              </div>
            </div>

            {/* 协议解析区块（非 Raw 协议时显示） */}
            {displayFrame.formatted && displayFrame.protocol !== 'raw' && (
              <div style={{ ...sectionStyle, background: 'rgba(204, 217, 170, 0.08)', borderLeft: `2px solid ${protoColor}` }}>
                <div style={labelStyle(protoColor)}>PARSED</div>
                <div style={{ color: protoColor }}>
                  {displayFrame.formatted}
                </div>
              </div>
            )}
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
      }}
      >
        <button
          onClick={() => pinFrame(pinnedFrame ? null : (latestFrame ?? null))}
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
          onClick={handleCopyFrame}
          disabled={!displayFrame}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: '10px',
            opacity: displayFrame ? 1 : 0.4,
          }}
        >
          Copy Frame
        </button>
      </div>
    </div>
  )
}
