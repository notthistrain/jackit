import { useMainStore } from '@/lib/store'
import { useT } from '@/i18n'
import { ConnectionList } from './ConnectionList'
import { QuickSendPanel } from './QuickSendPanel'

export function Sidebar() {
  const { sidebarVisible, sidebarTab } = useMainStore()
  const { t } = useT()

  if (!sidebarVisible)
    return null

  return (
    <div style={{
      width: '200px',
      background: 'var(--color-sidebar-bg)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}
    >
      <div style={{
        padding: '8px 10px',
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.5px',
        borderBottom: '1px solid var(--color-border)',
      }}
      >
        {sidebarTab === 'connections' ? t('sidebar.connections') : t('sidebar.quickSend')}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sidebarTab === 'connections' && <ConnectionList />}
        {sidebarTab === 'snippets' && <QuickSendPanel />}
      </div>
    </div>
  )
}
