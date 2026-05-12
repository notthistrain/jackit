import { useMainStore } from '@/lib/store'
import { formatBytes } from '@/lib/formatters'

export function StatusBar() {
  const { connections, activePortId, stats } = useMainStore()
  const activeConn = activePortId ? connections[activePortId] : null
  const portStats = activePortId ? stats[activePortId] : null

  return (
    <div style={{
      background: 'var(--color-accent)',
      padding: '2px 12px',
      display: 'flex',
      gap: '16px',
      fontSize: '11px',
      color: '#fff',
    }}>
      <span>⚡ JackCom</span>
      {activeConn && (
        <>
          <span>{activeConn.portName}</span>
          {portStats && (
            <span style={{ marginLeft: 'auto' }}>
              RX: {formatBytes(portStats.rx)} | TX: {formatBytes(portStats.tx)}
            </span>
          )}
        </>
      )}
      <span style={{ marginLeft: portStats ? 0 : 'auto' }}>UTF-8 · 8N1</span>
    </div>
  )
}
