import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null },
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
  mocks.success.mockReset()
  mocks.store.configScope = 'global'
  mocks.store.currentProject = null
})

describe('useConfig', () => {
  it('reads layer with global scope on mount', async () => {
    mocks.invoke.mockResolvedValue({ items: [{ key: 'model', value: 'opus', origin: 'global' }] })
    const { useConfig } = await import('./useConfig')
    const { result } = renderHook(() => useConfig())
    await waitFor(() => expect(result.current.config?.items.length).toBe(1))
    expect(mocks.invoke).toHaveBeenCalledWith('read_config_layer', { scope: 'global', projectPath: null })
  })

  it('needsProject when project scope without currentProject', async () => {
    mocks.store.configScope = 'project'
    const { useConfig } = await import('./useConfig')
    const { result } = renderHook(() => useConfig())
    await waitFor(() => expect(result.current.needsProject).toBe(true))
    expect(mocks.invoke).not.toHaveBeenCalledWith('read_config_layer', expect.anything())
  })

  it('writeConfig passes sensitive and toasts on wrote_local', async () => {
    mocks.store.configScope = 'project'
    mocks.store.currentProject = '/proj'
    mocks.invoke.mockImplementation((cmd: string) =>
      cmd === 'write_config'
        ? Promise.resolve({ wrote_local: true, gitignore_updated: true })
        : Promise.resolve({ items: [] }),
    )
    const { useConfig } = await import('./useConfig')
    const { result } = renderHook(() => useConfig())
    await act(async () => {
      await result.current.writeConfig('ANTHROPIC_AUTH_TOKEN', 'sk-x', true)
    })
    expect(mocks.invoke).toHaveBeenCalledWith('write_config', {
      scope: 'project',
      projectPath: '/proj',
      key: 'ANTHROPIC_AUTH_TOKEN',
      value: 'sk-x',
      sensitive: true,
    })
    expect(mocks.success).toHaveBeenCalled()
  })
})
