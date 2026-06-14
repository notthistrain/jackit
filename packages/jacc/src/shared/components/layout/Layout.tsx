import { invoke } from '@tauri-apps/api/core'
import { useEffect } from 'react'
import { Agents } from '@/pages/Agents'
import { EnvVars } from '@/pages/EnvVars'
import { General } from '@/pages/General'
import { McpServers } from '@/pages/McpServers'
import { Models } from '@/pages/Models'
import { Permissions } from '@/pages/Permissions'
import { Skills } from '@/pages/Skills'
import { Sidebar } from '@/shared/components/layout/Sidebar'
import { TitleBar } from '@/shared/components/layout/TitleBar'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { useSelectProject } from '@/shared/hooks/useSelectProject'
import { useAppStore } from '@/stores/useAppStore'
import { layout } from './layout.variants'

export function Layout() {
  const { currentPage, currentProject } = useAppStore()
  const { root, body, main } = layout()
  const handleSelectProject = useSelectProject()

  // 同步当前激活项目到后端 settings watcher（项目变化时切换监听目标）
  useEffect(() => {
    invoke('set_active_project', { path: currentProject ?? null }).catch(() => {
      // watcher 非关键路径，失败静默
    })
  }, [currentProject])

  function renderPage() {
    switch (currentPage) {
      case 'general':
        return <General />
      case 'envvars':
        return <EnvVars />
      case 'permissions':
        return <Permissions />
      case 'mcp':
        return <McpServers />
      case 'models':
        return <Models />
      case 'skills':
        if (!currentProject)
          return <EmptyState onSelectProject={handleSelectProject} />
        return <Skills />
      case 'agents':
        if (!currentProject)
          return <EmptyState onSelectProject={handleSelectProject} />
        return <Agents />
      default:
        return null
    }
  }

  return (
    <div className={root()}>
      <TitleBar />
      <div className={body()}>
        <Sidebar />
        <main className={main()}>{renderPage()}</main>
      </div>
    </div>
  )
}
