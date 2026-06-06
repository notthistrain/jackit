import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  testMock: vi.fn(),
  updateMock: vi.fn(),
  addMock: vi.fn(),
  toast: { error: vi.fn() },
}))

vi.mock('@/providers/ToastProvider', () => ({ useToast: () => mocks.toast }))

vi.mock('../api/models-api', () => ({
  modelsApi: {
    list: vi.fn().mockResolvedValue([]),
    create: mocks.addMock,
    update: mocks.updateMock,
    delete: vi.fn().mockResolvedValue(undefined),
    test: mocks.testMock,
  },
}))

const t = (k: string, p?: Record<string, string>) => (p ? `${k}:${JSON.stringify(p)}` : k)

describe('useApiKeyNode', () => {
  it('formats CONNECTION_SUCCESS as testSuccess key', async () => {
    mocks.testMock.mockResolvedValueOnce('CONNECTION_SUCCESS')
    const { useApiKeyNode } = await import('./useApiKeyNode')
    const { result } = renderHook(() => useApiKeyNode(1, t))
    await act(async () => {
      await result.current.handleTestModel(5)
    })
    await waitFor(() => expect(result.current.testResult).toEqual({ id: 5, msg: 'models.testSuccess', ok: true }))
  })

  it('formats CONNECTION_FAILED:xxx using slice(18)', async () => {
    mocks.testMock.mockResolvedValueOnce('CONNECTION_FAILED:boom')
    const { useApiKeyNode } = await import('./useApiKeyNode')
    const { result } = renderHook(() => useApiKeyNode(1, t))
    await act(async () => {
      await result.current.handleTestModel(7)
    })
    await waitFor(() => expect(result.current.testResult).toEqual({
      id: 7,
      msg: `models.testFailed:${JSON.stringify({ error: 'boom' })}`,
      ok: true,
    }))
  })

  it('formats HTTP_ERROR:xxx using slice(11)', async () => {
    mocks.testMock.mockResolvedValueOnce('HTTP_ERROR:500')
    const { useApiKeyNode } = await import('./useApiKeyNode')
    const { result } = renderHook(() => useApiKeyNode(1, t))
    await act(async () => {
      await result.current.handleTestModel(9)
    })
    await waitFor(() => expect(result.current.testResult).toEqual({
      id: 9,
      msg: `models.testFailed:${JSON.stringify({ error: '500' })}`,
      ok: true,
    }))
  })

  it('returns raw message for other formats', async () => {
    mocks.testMock.mockResolvedValueOnce('weird raw')
    const { useApiKeyNode } = await import('./useApiKeyNode')
    const { result } = renderHook(() => useApiKeyNode(1, t))
    await act(async () => {
      await result.current.handleTestModel(11)
    })
    await waitFor(() => expect(result.current.testResult).toEqual({ id: 11, msg: 'weird raw', ok: true }))
  })

  it('marks ok=false on rejection and formats error', async () => {
    mocks.testMock.mockRejectedValueOnce('CONNECTION_FAILED:nope')
    const { useApiKeyNode } = await import('./useApiKeyNode')
    const { result } = renderHook(() => useApiKeyNode(1, t))
    await act(async () => {
      await result.current.handleTestModel(13)
    })
    await waitFor(() => expect(result.current.testResult).toEqual({
      id: 13,
      msg: `models.testFailed:${JSON.stringify({ error: 'nope' })}`,
      ok: false,
    }))
    expect(result.current.testing).toBeNull()
  })

  it('handleAddModel closes showAddModel', async () => {
    mocks.addMock.mockResolvedValueOnce(undefined)
    const { useApiKeyNode } = await import('./useApiKeyNode')
    const { result } = renderHook(() => useApiKeyNode(1, t))
    act(() => result.current.setShowAddModel(true))
    expect(result.current.showAddModel).toBe(true)
    await act(async () => {
      await result.current.handleAddModel({ api_key_id: 1, model_name: 'm', context_size: '8k' })
    })
    expect(result.current.showAddModel).toBe(false)
  })

  it('handleEditModel calls update with editingModel.id and clears it; null context becomes undefined', async () => {
    mocks.updateMock.mockResolvedValueOnce(undefined)
    const { useApiKeyNode } = await import('./useApiKeyNode')
    const { result } = renderHook(() => useApiKeyNode(1, t))
    act(() => result.current.setEditingModel({
      id: 42,
      api_key_id: 1,
      model_name: 'old',
      context_size: '4k',
      created_at: '',
      updated_at: '',
    }))
    await act(async () => {
      await result.current.handleEditModel({ api_key_id: 1, model_name: 'new', context_size: null })
    })
    expect(mocks.updateMock).toHaveBeenCalledWith(42, { model_name: 'new', context_size: undefined })
    expect(result.current.editingModel).toBeNull()
  })
})
