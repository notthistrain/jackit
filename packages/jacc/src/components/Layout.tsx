import { useAppStore } from '@/stores/useAppStore'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'
import { EmptyState } from './EmptyState'
import { open } from '@tauri-apps/plugin-dialog'
import { useProjects } from '@/hooks/useProjects'
import { General } from '@/pages/General'
import { EnvVars } from '@/pages/EnvVars'
import { Permissions } from '@/pages/Permissions'
import { McpServers } from '@/pages/McpServers'
import { Models } from '@/pages/Models'
import { Skills } from '@/pages/Skills'
import { Agents } from '@/pages/Agents'

export function Layout() {
  const { currentPage, currentProject, setProject } = useAppStore()
  const { add, open: openProject } = useProjects()

  async function handleSelectProject() {
    const selected = await open({ directory: true })
    if (selected) {
      await add(selected)
      await openProject(selected)
      setProject(selected)
    }
  }

  function renderPage() {
    if (!currentProject) {
      return <EmptyState onSelectProject={handleSelectProject} />
    }

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
        return <Skills />
      case 'agents':
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
