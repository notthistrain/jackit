import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { activityBar } from './activity-bar.variants'

const ICONS = [
  { id: 'connections' as const, icon: '🔌', titleKey: 'sidebar.connections' },
  { id: 'snippets' as const, icon: '📝', titleKey: 'sidebar.quickSend' },
] as const

export function ActivityBar() {
  const sidebarTab = useMainStore(s => s.sidebarTab)
  const setSidebarTab = useMainStore(s => s.setSidebarTab)
  const sidebarVisible = useMainStore(s => s.sidebarVisible)
  const toggleSidebar = useMainStore(s => s.toggleSidebar)
  const { t } = useT()

  const { root, item } = activityBar()

  return (
    <div className={root()}>
      {ICONS.map(({ id, icon, titleKey }) => (
        <div
          key={id}
          title={t(titleKey)}
          data-active={sidebarVisible && sidebarTab === id}
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
          className={item()}
        >
          {icon}
        </div>
      ))}
    </div>
  )
}
