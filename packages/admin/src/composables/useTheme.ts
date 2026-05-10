import { computed, reactive } from 'vue'

type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  resolved: 'light' | 'dark'
}

const state = reactive<ThemeState>({
  theme: 'light',
  resolved: 'light',
})

let initialized = false

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined')
    return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  state.resolved = resolved

  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }
}

function init() {
  if (initialized || typeof window === 'undefined')
    return
  initialized = true

  const stored = localStorage.getItem('theme')
  if (stored) {
    state.theme = stored as Theme
  }
  applyTheme(state.theme)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') {
      applyTheme('system')
    }
  })
}

export function useTheme() {
  init()

  function setTheme(theme: Theme) {
    state.theme = theme
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', theme)
    }
    applyTheme(theme)
  }

  function toggleTheme() {
    setTheme(state.theme === 'light' ? 'dark' : 'light')
  }

  return {
    theme: computed(() => state.theme),
    resolved: computed(() => state.resolved),
    isDark: computed(() => state.resolved === 'dark'),
    toggleTheme,
    setTheme,
  }
}
