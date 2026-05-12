import { useMainStore } from '@/lib/store'

export function Toolbar() {
  const { connections, activePortId, toggleSidebar } = useMainStore()
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
    }}>
      <button
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
        {isOnline ? '\u25B6 Connected' : '\u26A1 Connect'}
      </button>
      {activeConn && (
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
          {activeConn.portName} · {activeConn.baudRate.toLocaleString()} · 8N1
        </span>
      )}
      <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>|</span>
      <button
        onClick={toggleSidebar}
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
      <button style={{
        background: 'transparent', border: 'none',
        color: 'var(--color-accent)', cursor: 'pointer', fontSize: '11px', padding: '2px 6px',
      }}>
        📊 Wave
      </button>
      <button style={{
        background: 'transparent', border: 'none',
        color: 'var(--color-accent)', cursor: 'pointer', fontSize: '11px', padding: '2px 6px',
      }}>
        🔬 Decode
      </button>
      <span style={{ marginLeft: 'auto' }}>
        {isOnline && (
          <span style={{ color: 'var(--color-online)', fontSize: '11px', fontWeight: 600 }}>
            ● Online
          </span>
        )}
      </span>
    </div>
  )
}
