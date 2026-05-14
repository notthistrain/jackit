import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { useSerialPort } from '@/hooks/useSerialPort'
import { openDecoderWindow, openWaveformWindow } from '@/lib/window'
import { toolbar } from './toolbar.variants'

interface ToolbarProps {
  onOpenConnectionDialog: () => void
}

export function Toolbar({ onOpenConnectionDialog }: ToolbarProps) {
  const { t } = useT()
  const { connections, activePortId, toggleSidebar } = useMainStore()
  const { close } = useSerialPort()
  const activeConn = activePortId ? connections[activePortId] : null
  const isOnline = activeConn?.online ?? false

  const { root, connectBtn, connInfo, separator, toolBtn, windowBtn, onlineIndicator, spacer } = toolbar()

  return (
    <div className={root()}>
      <button
        onClick={() => {
          if (isOnline && activePortId) {
            close(activePortId).catch(() => {})
          } else {
            onOpenConnectionDialog()
          }
        }}
        title={isOnline ? t('toolbar.disconnect') : t('toolbar.connect')}
        className={connectBtn({ online: isOnline })}
      >
        {isOnline ? `\u23F9 ${t('toolbar.disconnect')}` : `\u26A1 ${t('toolbar.connect')}`}
      </button>
      {activeConn && (
        <span className={connInfo()}>
          {activeConn.portName}
          {' '}
          ·
          {activeConn.baudRate.toLocaleString()}
          {' '}
          · 8N1
        </span>
      )}
      <span className={separator()}>|</span>
      <button
        onClick={toggleSidebar}
        title={t('toolbar.toggleSidebar')}
        className={toolBtn()}
      >
        ☰
      </button>
      <button
        onClick={() => activePortId && openWaveformWindow(activePortId)}
        disabled={!activePortId}
        title={t('toolbar.wave')}
        className={windowBtn({ active: !!activePortId })}
      >
        📊 {t('toolbar.wave')}
      </button>
      <button
        onClick={() => activePortId && openDecoderWindow(activePortId)}
        disabled={!activePortId}
        title={t('toolbar.decode')}
        className={windowBtn({ active: !!activePortId })}
      >
        🔬 {t('toolbar.decode')}
      </button>
      <span className={spacer()}>
        {isOnline && (
          <span className={onlineIndicator()}>
            ● {t('toolbar.online')}
          </span>
        )}
      </span>
    </div>
  )
}
