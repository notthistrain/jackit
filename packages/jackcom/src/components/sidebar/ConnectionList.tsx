import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { connectionList } from './connection-list.variants'

export function ConnectionList() {
  const { t } = useT()
  const { connections, activePortId, setActivePortId } = useMainStore()
  const connList = Object.values(connections)
  const { empty, list, item, row, statusDot, portName, baudRate } = connectionList()

  if (connList.length === 0) {
    return (
      <div className={empty()}>
        {t('sidebar.noConnections')}
      </div>
    )
  }

  return (
    <div className={list()}>
      {connList.map(conn => (
        <div
          key={conn.portName}
          onClick={() => setActivePortId(conn.portName)}
          data-active={activePortId === conn.portName}
          data-online={conn.online}
          className={item()}
        >
          <div className={row()}>
            <span
              className={statusDot()}
              style={{ color: conn.online ? 'var(--color-online)' : 'var(--color-text-secondary)' }}
            >
              {conn.online ? '●' : '○'}
            </span>
            <span className={portName()}>{conn.portName}</span>
            <span className={baudRate()}>
              {conn.baudRate.toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
