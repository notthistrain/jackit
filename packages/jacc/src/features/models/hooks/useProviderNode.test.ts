import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addMock: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/toast/ToastProvider', () => ({ useToast: () => mocks.toast }))

vi.mock('../api/models-api', () => ({
  apiKeysApi: {
    list: vi.fn().mockResolvedValue([]),
    create: mocks.addMock,
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('useProviderNode', () => {
  it('returns sane defaults for state flags', async () => {
    const { useProviderNode } = await import('./useProviderNode')
    const { result } = renderHook(() => useProviderNode(1))
    expect(result.current.expanded).toBe(false)
    expect(result.current.showAddKey).toBe(false)
    expect(result.current.showEditProvider).toBe(false)
    expect(result.current.confirmDeleteProvider).toBe(false)
  })

  it('toggles expanded via setExpanded', async () => {
    const { useProviderNode } = await import('./useProviderNode')
    const { result } = renderHook(() => useProviderNode(1))
    act(() => result.current.setExpanded(true))
    expect(result.current.expanded).toBe(true)
    act(() => result.current.setExpanded(false))
    expect(result.current.expanded).toBe(false)
  })

  it('toggles showAddKey via setShowAddKey', async () => {
    const { useProviderNode } = await import('./useProviderNode')
    const { result } = renderHook(() => useProviderNode(1))
    act(() => result.current.setShowAddKey(true))
    expect(result.current.showAddKey).toBe(true)
    act(() => result.current.setShowAddKey(false))
    expect(result.current.showAddKey).toBe(false)
  })

  it('toggles showEditProvider via setShowEditProvider', async () => {
    const { useProviderNode } = await import('./useProviderNode')
    const { result } = renderHook(() => useProviderNode(1))
    act(() => result.current.setShowEditProvider(true))
    expect(result.current.showEditProvider).toBe(true)
    act(() => result.current.setShowEditProvider(false))
    expect(result.current.showEditProvider).toBe(false)
  })

  it('toggles confirmDeleteProvider via setConfirmDeleteProvider', async () => {
    const { useProviderNode } = await import('./useProviderNode')
    const { result } = renderHook(() => useProviderNode(1))
    act(() => result.current.setConfirmDeleteProvider(true))
    expect(result.current.confirmDeleteProvider).toBe(true)
    act(() => result.current.setConfirmDeleteProvider(false))
    expect(result.current.confirmDeleteProvider).toBe(false)
  })

  it('handleAddKey closes add form after add succeeds', async () => {
    mocks.addMock.mockResolvedValueOnce(undefined)
    const { useProviderNode } = await import('./useProviderNode')
    const { result } = renderHook(() => useProviderNode(1))
    act(() => result.current.setShowAddKey(true))
    expect(result.current.showAddKey).toBe(true)
    await act(async () => {
      await result.current.handleAddKey({ provider_id: 1, name: 'k', api_key: 'x', notes: null })
    })
    expect(result.current.showAddKey).toBe(false)
  })
})
