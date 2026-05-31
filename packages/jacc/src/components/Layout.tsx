import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useEffect } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { Agents } from '@/pages/Agents'
import { EnvVars } from '@/pages/EnvVars'
import { General } from '@/pages/General'
import { McpServers } from '@/pages/McpServers'
import { Models } from '@/pages/Models'
import { Permissions } from '@/pages/Permissions'
import { Skills } from '@/pages/Skills'
import { useAppStore } from '@/stores/useAppStore'
import { EmptyState } from './EmptyState'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'

export function Layout() {
  const { currentPage, currentProject, setProject } = useAppStore()
  const { add, open: openProject } = useProjects()

  // 同步当前激活项目到后端 settings watcher（项目变化时切换监听目标）
  useEffect(() => {
    invoke('set_active_project', { path: currentProject ?? null }).catch(() => {
      // watcher 非关键路径，失败静默
    })
  }, [currentProject])

  async function handleSelectProject() {
    const selected = await open({ directory: true })
    if (selected) {
      await add(selected)
      await openProject(selected)
      setProject(selected)
    }
  }

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
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative">{renderPage()}</main>
      </div>
    </div>
  )
}
