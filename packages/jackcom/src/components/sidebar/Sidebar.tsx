import { useMainStore } from '@/lib/store'
import { useT } from '@/i18n'
import { ConnectionList } from './ConnectionList'
import { QuickSendPanel } from './QuickSendPanel'
import { sidebar } from './sidebar.variants'

export function Sidebar() {
  const { sidebarVisible, sidebarTab } = useMainStore()
  const { t } = useT()
  const { root, header, content } = sidebar()

  if (!sidebarVisible)
    return null

  return (
    <div className={root()}>
      <div className={header()}>
        {sidebarTab === 'connections' ? t('sidebar.connections') : t('sidebar.quickSend')}
      </div>
      <div className={content()}>
        {sidebarTab === 'connections' && <ConnectionList />}
        {sidebarTab === 'snippets' && <QuickSendPanel />}
      </div>
    </div>
  )
}
