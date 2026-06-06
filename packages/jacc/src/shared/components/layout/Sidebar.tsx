import type { Page } from '@/stores/useAppStore'
import {
  Bot,
  Brain,
  Key,
  Moon,
  Plug,
  Puzzle,
  Settings,
  Shield,
  Sun,
} from 'lucide-react'
import { useT } from '@/i18n'
import { ProjectSwitcher } from '@/shared/components/ui/ProjectSwitcher'
import { usePreferences } from '@/shared/hooks/usePreferences'
import { useAppStore } from '@/stores/useAppStore'
import { sidebar } from './sidebar.variants'

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
  const { root, nav, sectionTitle, sectionTitleSpaced, navItem, footer, themeButton } = sidebar()

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
    <div className={root()}>
      <ProjectSwitcher />

      <nav className={nav()}>
        <div className={sectionTitle()}>{t('sidebar.config')}</div>
        {settingsNav.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={navItem({ active: currentPage === item.id })}
          >
            {item.icon}
            {t(item.labelKey)}
          </button>
        ))}

        <div className={sectionTitleSpaced()}>
          {t('sidebar.extensions')}
        </div>
        {extensionsNav.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={navItem({ active: currentPage === item.id })}
          >
            {item.icon}
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className={footer()}>
        <button onClick={toggleTheme} className={themeButton()}>
          {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          <span>{themeLabel}</span>
        </button>
        <span>v0.1.0</span>
      </div>
    </div>
  )
}
