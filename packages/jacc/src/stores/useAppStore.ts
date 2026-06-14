import { create } from 'zustand'

export type Page
  = | 'general'
    | 'envvars'
    | 'permissions'
    | 'mcp'
    | 'models'
    | 'skills'
    | 'agents'

export type Theme = 'light' | 'dark' | 'system'

export type ConfigScope = 'global' | 'project'

interface AppState {
  currentPage: Page
  currentProject: string | null
  configScope: ConfigScope
  theme: Theme
  setPage: (page: Page) => void
  setProject: (path: string | null) => void
  setConfigScope: (scope: ConfigScope) => void
  setTheme: (theme: Theme) => void
}

export const useAppStore = create<AppState>(set => ({
  currentPage: 'general',
  currentProject: null,
  configScope: 'global',
  theme: 'system',
  setPage: page => set({ currentPage: page }),
  setProject: path => set({ currentProject: path }),
  setConfigScope: scope => set({ configScope: scope }),
  setTheme: theme => set({ theme }),
}))
