import { useT } from '@/i18n'
import { formatBytes } from '@/lib/formatters'
import { useMainStore } from '@/lib/store'
import { statusBar } from './status-bar.variants'

export function StatusBar() {
  const { t } = useT()
  const { connections, activePortId, stats } = useMainStore()
  const activeConn = activePortId ? connections[activePortId] : null
  const portStats = activePortId ? stats[activePortId] : null

  const { root, stats: statsSlot, encoding } = statusBar()

  return (
    <div className={root()}>
      <span>⚡ {t('statusbar.app')}</span>
      {activeConn && (
        <>
          <span>{activeConn.portName}</span>
          {portStats && (
            <span className={statsSlot()}>
              RX:
              {' '}
              {formatBytes(portStats.rx)}
              {' '}
              | TX:
              {' '}
              {formatBytes(portStats.tx)}
            </span>
          )}
        </>
      )}
      <span className={portStats ? encoding() : statsSlot()}>UTF-8 · 8N1</span>
    </div>
  )
}
