import { create } from 'zustand'

export type Page =
  | 'general'
  | 'envvars'
  | 'permissions'
  | 'mcp'
  | 'models'
  | 'skills'
  | 'agents'

export type Theme = 'light' | 'dark' | 'system'

interface AppState {
  currentPage: Page
  currentProject: string | null
  theme: Theme
  setPage: (page: Page) => void
  setProject: (path: string | null) => void
  setTheme: (theme: Theme) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'general',
  currentProject: null,
  theme: 'system',
  setPage: (page) => set({ currentPage: page }),
  setProject: (path) => set({ currentProject: path }),
  setTheme: (theme) => set({ theme }),
}))
