import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'

export function ConnectionList() {
  const { t } = useT()
  const { connections, activePortId, setActivePortId } = useMainStore()
  const connList = Object.values(connections)

  if (connList.length === 0) {
    return (
      <div style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
        {t('sidebar.noConnections')}
      </div>
    )
  }

  return (
    <div style={{ padding: '4px' }}>
      {connList.map(conn => (
        <div
          key={conn.portName}
          onClick={() => setActivePortId(conn.portName)}
          style={{
            padding: '6px 8px',
            marginBottom: '2px',
            borderRadius: '3px',
            cursor: 'pointer',
            background: activePortId === conn.portName
              ? 'var(--color-border)'
              : 'transparent',
            borderLeft: conn.online
              ? '3px solid var(--color-online)'
              : '3px solid transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              color: conn.online ? 'var(--color-online)' : 'var(--color-text-secondary)',
              fontSize: '8px',
            }}
            >
              {conn.online ? '●' : '○'}
            </span>
            <span style={{ fontWeight: 600, fontSize: '12px' }}>{conn.portName}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)', fontSize: '10px' }}>
              {conn.baudRate.toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
