import { useMainStore } from '@/lib/store'
import { ConnectionList } from './ConnectionList'

export function Sidebar() {
  const { sidebarVisible, sidebarTab } = useMainStore()

  if (!sidebarVisible) return null

  return (
    <div style={{
      width: '200px',
      background: 'var(--color-sidebar-bg)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 10px',
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.5px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {sidebarTab === 'connections' ? 'CONNECTIONS' : 'QUICK SEND'}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sidebarTab === 'connections' && <ConnectionList />}
        {sidebarTab === 'snippets' && (
          <div style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            Quick send snippets will appear here
          </div>
        )}
      </div>
    </div>
  )
}
