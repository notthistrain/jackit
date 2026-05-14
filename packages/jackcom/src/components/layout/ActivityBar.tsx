import { useMainStore } from '@/lib/store'
import { useT } from '@/i18n'
import { activityBar } from './activity-bar.variants'

const ICONS = [
  { id: 'connections' as const, icon: '🔌', titleKey: 'sidebar.connections' },
  { id: 'snippets' as const, icon: '📝', titleKey: 'sidebar.quickSend' },
] as const

export function ActivityBar() {
  const { sidebarTab, setSidebarTab, sidebarVisible, toggleSidebar } = useMainStore()
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
