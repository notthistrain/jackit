import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getPref = vi.fn()
const setTheme = vi.fn()
const setLocale = vi.fn()
const storeState = { theme: 'system' as string, setTheme }

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ show: vi.fn() }),
}))
vi.mock('@/providers/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/shared/components/layout/Layout', () => ({ Layout: () => <div>LAYOUT</div> }))
vi.mock('@/shared/hooks/usePreferences', () => ({ usePreferences: () => ({ get: getPref }) }))
vi.mock('@/i18n', () => ({ useT: () => ({ setLocale }) }))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => storeState }))

async function importApp() {
  const mod = await import('./App')
  return mod.App
}

describe('app', () => {
  beforeEach(() => {
    getPref.mockResolvedValue(undefined)
    storeState.theme = 'system'
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('removes data-theme attribute when theme is system', async () => {
    storeState.theme = 'system'
    const App = await importApp()
    render(<App />)
    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    })
  })

  it('sets data-theme attribute when theme is dark', async () => {
    storeState.theme = 'dark'
    const App = await importApp()
    render(<App />)
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })

  it('hydrates saved theme preference into store on mount', async () => {
    getPref.mockImplementation((key: string) =>
      Promise.resolve(key === 'theme' ? 'dark' : undefined))
    const App = await importApp()
    render(<App />)
    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith('dark')
    })
  })

  it('hydrates saved locale preference into i18n on mount', async () => {
    getPref.mockImplementation((key: string) =>
      Promise.resolve(key === 'locale' ? 'en' : undefined))
    const App = await importApp()
    render(<App />)
    await waitFor(() => {
      expect(setLocale).toHaveBeenCalledWith('en')
    })
  })
})
