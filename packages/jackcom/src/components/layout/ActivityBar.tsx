import { useMainStore } from '@/lib/store'
import { useT } from '@/i18n'

const ICONS = [
  { id: 'connections' as const, icon: '🔌', titleKey: 'sidebar.connections' },
  { id: 'snippets' as const, icon: '📝', titleKey: 'sidebar.quickSend' },
] as const

export function ActivityBar() {
  const { sidebarTab, setSidebarTab, sidebarVisible, toggleSidebar } = useMainStore()
  const { t } = useT()

  return (
    <div style={{
      width: '40px',
      background: 'var(--color-titlebar-bg)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '4px',
      gap: '2px',
    }}
    >
      {ICONS.map(({ id, icon, titleKey }) => (
        <div
          key={id}
          title={t(titleKey)}
          onClick={() => {
            if (sidebarTab === id && sidebarVisible) {
              toggleSidebar()
            }
            else {
              setSidebarTab(id)
              if (!sidebarVisible)
                toggleSidebar()
            }
          }}
          style={{
            fontSize: '18px',
            padding: '6px',
            cursor: 'pointer',
            borderLeft: sidebarVisible && sidebarTab === id
              ? '2px solid var(--color-accent)'
              : '2px solid transparent',
            opacity: sidebarVisible && sidebarTab === id ? 1 : 0.6,
          }}
        >
          {icon}
        </div>
      ))}
    </div>
  )
}
