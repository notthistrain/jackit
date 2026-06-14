import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null },
  error: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/providers/ToastProvider', () => ({
  useToast: () => ({ error: mocks.error }),
}))

beforeEach(() => {
  mocks.invoke.mockReset().mockResolvedValue([])
  mocks.store.configScope = 'global'
  mocks.store.currentProject = null
})

describe('useSlotBindings scope', () => {
  it('reads bindings with global scope on mount', async () => {
    const { useSlotBindings } = await import('./useSlotBindings')
    renderHook(() => useSlotBindings())
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('get_slot_bindings', { scope: 'global', projectPath: null }))
  })

  it('does not read when project scope without currentProject', async () => {
    mocks.store.configScope = 'project'
    const { useSlotBindings } = await import('./useSlotBindings')
    renderHook(() => useSlotBindings())
    await waitFor(() => {})
    expect(mocks.invoke).not.toHaveBeenCalledWith('get_slot_bindings', expect.anything())
  })

  it('bind passes scope + projectPath', async () => {
    mocks.store.configScope = 'project'
    mocks.store.currentProject = '/proj'
    const { useSlotBindings } = await import('./useSlotBindings')
    const { result } = renderHook(() => useSlotBindings())
    await act(async () => {
      await result.current.bind('opus', 7)
    })
    expect(mocks.invoke).toHaveBeenCalledWith('bind_slot', {
      slot: 'opus',
      modelId: 7,
      scope: 'project',
      projectPath: '/proj',
    })
  })

  it('setCurrentModel refreshes bindings after apply (so UI updates without relying on fs watcher)', async () => {
    mocks.store.configScope = 'project'
    mocks.store.currentProject = '/proj'
    const { useSlotBindings } = await import('./useSlotBindings')
    const { result } = renderHook(() => useSlotBindings())
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('get_slot_bindings', expect.anything()))
    const readsBefore = mocks.invoke.mock.calls.filter(c => c[0] === 'get_slot_bindings').length

    await act(async () => {
      await result.current.setCurrentModel('opus', null)
    })

    expect(mocks.invoke).toHaveBeenCalledWith('set_current_model', expect.objectContaining({ slot: 'opus' }))
    const readsAfter = mocks.invoke.mock.calls.filter(c => c[0] === 'get_slot_bindings').length
    expect(readsAfter).toBeGreaterThan(readsBefore)
  })
})
