import {
  Bot,
  Key,
  Plug,
  Puzzle,
  Settings,
  Shield,
  Brain,
  Moon,
  Sun,
} from 'lucide-react'
import { useAppStore, type Page } from '@/stores/useAppStore'
import { usePreferences } from '@/hooks/usePreferences'
import { ProjectSwitcher } from './ProjectSwitcher'
import { cn } from '@/lib/utils'

interface NavItem {
  id: Page
  label: string
  icon: React.ReactNode
}

const settingsNav: NavItem[] = [
  { id: 'general', label: '通用', icon: <Settings size={14} /> },
  { id: 'envvars', label: '环境变量', icon: <Key size={14} /> },
  { id: 'permissions', label: '权限', icon: <Shield size={14} /> },
  { id: 'mcp', label: 'MCP 服务器', icon: <Plug size={14} /> },
  { id: 'models', label: '模型库', icon: <Brain size={14} /> },
]

const extensionsNav: NavItem[] = [
  { id: 'skills', label: 'Skills', icon: <Puzzle size={14} /> },
  { id: 'agents', label: 'Agents', icon: <Bot size={14} /> },
]

export function Sidebar() {
  const { currentPage, setPage, theme, setTheme } = useAppStore()
  const { set: setPreference } = usePreferences()

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
    setPreference('theme', next)
  }

  return (
    <div className="w-[180px] bg-sidebar border-r border-border flex flex-col h-full">
      <ProjectSwitcher />

      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wider">配置</div>
        {settingsNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={cn(
              'w-full text-left px-4 py-[7px] mx-2 text-xs flex items-center gap-2 rounded-[4px] cursor-pointer',
              currentPage === item.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}
            style={{ width: 'calc(100% - 16px)' }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        <div className="px-3 py-1 mt-3 text-[10px] text-muted uppercase tracking-wider">扩展</div>
        {extensionsNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={cn(
              'w-full text-left px-4 py-[7px] mx-2 text-xs flex items-center gap-2 rounded-[4px] cursor-pointer',
              currentPage === item.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}
            style={{ width: 'calc(100% - 16px)' }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted">
        <button onClick={toggleTheme} className="cursor-pointer hover:text-foreground flex items-center gap-1">
          {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          <span>{theme === 'system' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}</span>
        </button>
        <span>v0.1.0</span>
      </div>
    </div>
  )
}
