import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { useSerialPort } from '@/hooks/useSerialPort'
import { openDecoderWindow, openWaveformWindow } from '@/lib/window'

interface ToolbarProps {
  onOpenConnectionDialog: () => void
}

export function Toolbar({ onOpenConnectionDialog }: ToolbarProps) {
  const { t } = useT()
  const { connections, activePortId, toggleSidebar } = useMainStore()
  const { close } = useSerialPort()
  const activeConn = activePortId ? connections[activePortId] : null
  const isOnline = activeConn?.online ?? false

  return (
    <div style={{
      background: 'var(--color-titlebar-bg)',
      borderBottom: '1px solid var(--color-border)',
      padding: '4px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '12px',
    }}
    >
      <button
        onClick={() => {
          if (isOnline && activePortId) {
            close(activePortId).catch(() => {})
          } else {
            onOpenConnectionDialog()
          }
        }}
        title={isOnline ? t('toolbar.disconnect') : t('toolbar.connect')}
        style={{
          background: isOnline ? 'var(--color-accent)' : 'var(--color-border)',
          color: '#fff',
          border: 'none',
          padding: '3px 14px',
          borderRadius: '3px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '11px',
        }}
      >
        {isOnline ? `\u23F9 ${t('toolbar.disconnect')}` : `\u26A1 ${t('toolbar.connect')}`}
      </button>
      {activeConn && (
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
          {activeConn.portName}
          {' '}
          ·
          {activeConn.baudRate.toLocaleString()}
          {' '}
          · 8N1
        </span>
      )}
      <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>|</span>
      <button
        onClick={toggleSidebar}
        title={t('toolbar.toggleSidebar')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          fontSize: '11px',
          padding: '2px 6px',
        }}
      >
        ☰
      </button>
      <button
        onClick={() => activePortId && openWaveformWindow(activePortId)}
        disabled={!activePortId}
        title={t('toolbar.wave')}
        style={{
          background: 'transparent',
          border: 'none',
          color: activePortId ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          cursor: activePortId ? 'pointer' : 'not-allowed',
          fontSize: '11px',
          padding: '2px 6px',
          opacity: activePortId ? 1 : 0.5,
        }}
      >
        📊 {t('toolbar.wave')}
      </button>
      <button
        onClick={() => activePortId && openDecoderWindow(activePortId)}
        disabled={!activePortId}
        title={t('toolbar.decode')}
        style={{
          background: 'transparent',
          border: 'none',
          color: activePortId ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          cursor: activePortId ? 'pointer' : 'not-allowed',
          fontSize: '11px',
          padding: '2px 6px',
          opacity: activePortId ? 1 : 0.5,
        }}
      >
        🔬 {t('toolbar.decode')}
      </button>
      <span style={{ marginLeft: 'auto' }}>
        {isOnline && (
          <span style={{ color: 'var(--color-online)', fontSize: '11px', fontWeight: 600 }}>
            ● {t('toolbar.online')}
          </span>
        )}
      </span>
    </div>
  )
}
