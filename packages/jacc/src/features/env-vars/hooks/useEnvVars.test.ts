import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  store: { configScope: 'project' as 'global' | 'project', currentProject: '/proj' as string | null },
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))
vi.mock('@/providers/ToastProvider', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}))

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.store.configScope = 'project'
  mocks.store.currentProject = '/proj'
})

describe('useEnvVars per-var routing', () => {
  it('reads env layer on mount', async () => {
    mocks.invoke.mockResolvedValue({ vars: [{ key: 'FOO', value: 'bar', origin: 'shared' }] })
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    await waitFor(() => expect(result.current.entries.length).toBe(1))
    expect(mocks.invoke).toHaveBeenCalledWith('read_env_layer', { scope: 'project', projectPath: '/proj' })
  })

  it('add a known sensitive var routes sensitive=true', async () => {
    mocks.invoke.mockImplementation((cmd: string) =>
      cmd === 'set_env_var'
        ? Promise.resolve({ wrote_local: true, gitignore_updated: false })
        : Promise.resolve({ vars: [] }),
    )
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    await act(async () => {
      await result.current.setVar('ANTHROPIC_API_KEY', 'sk-x')
    })
    expect(mocks.invoke).toHaveBeenCalledWith('set_env_var', {
      scope: 'project', projectPath: '/proj', key: 'ANTHROPIC_API_KEY', value: 'sk-x', sensitive: true,
    })
  })

  it('add a custom var routes sensitive=false', async () => {
    mocks.invoke.mockImplementation((cmd: string) =>
      cmd === 'set_env_var'
        ? Promise.resolve({ wrote_local: false, gitignore_updated: false })
        : Promise.resolve({ vars: [] }),
    )
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    await act(async () => {
      await result.current.setVar('MY_CUSTOM', 'v')
    })
    expect(mocks.invoke).toHaveBeenCalledWith('set_env_var',
      expect.objectContaining({ key: 'MY_CUSTOM', sensitive: false }))
  })
})
