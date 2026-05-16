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
import { useT } from '@/i18n'

interface NavItem {
  id: Page
  labelKey: string
  icon: React.ReactNode
}

const settingsNav: NavItem[] = [
  { id: 'general', labelKey: 'sidebar.general', icon: <Settings size={14} /> },
  { id: 'envvars', labelKey: 'sidebar.envvars', icon: <Key size={14} /> },
  { id: 'permissions', labelKey: 'sidebar.permissions', icon: <Shield size={14} /> },
  { id: 'mcp', labelKey: 'sidebar.mcp', icon: <Plug size={14} /> },
  { id: 'models', labelKey: 'sidebar.models', icon: <Brain size={14} /> },
]

const extensionsNav: NavItem[] = [
  { id: 'skills', labelKey: 'sidebar.skills', icon: <Puzzle size={14} /> },
  { id: 'agents', labelKey: 'sidebar.agents', icon: <Bot size={14} /> },
]

export function Sidebar() {
  const { t } = useT()
  const { currentPage, setPage, theme, setTheme } = useAppStore()
  const { set: setPreference } = usePreferences()

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
    setPreference('theme', next)
  }

  const themeLabel = theme === 'system'
    ? t('sidebar.theme.system')
    : theme === 'light'
      ? t('sidebar.theme.light')
      : t('sidebar.theme.dark')

  return (
    <div className="w-[180px] bg-sidebar border-r border-border flex flex-col h-full">
      <ProjectSwitcher />

      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wider">{t('sidebar.config')}</div>
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
            {t(item.labelKey)}
          </button>
        ))}

        <div className="px-3 py-1 mt-3 text-[10px] text-muted uppercase tracking-wider">{t('sidebar.extensions')}</div>
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
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted">
        <button onClick={toggleTheme} className="cursor-pointer hover:text-foreground flex items-center gap-1">
          {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          <span>{themeLabel}</span>
        </button>
        <span>v0.1.0</span>
      </div>
    </div>
  )
}
