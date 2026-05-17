import { renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock toast (stable references to avoid infinite re-renders)
const mockToast = { success: vi.fn(), error: vi.fn() }
vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => mockToast,
}))

import { invoke } from '@tauri-apps/api/core'
import { useAllModels } from './useAllModels'

describe('useAllModels', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('fetches providers → keys → models and flattens', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([
        { id: 1, name: 'Anthropic', base_url: 'https://api.anthropic.com', notes: null, created_at: '', updated_at: '' },
        { id: 2, name: 'OpenRouter', base_url: 'https://openrouter.ai', notes: null, created_at: '', updated_at: '' },
      ])
      .mockResolvedValueOnce([
        { id: 10, provider_id: 1, name: 'Main Key', api_key_masked: 'sk-***', notes: null, created_at: '', updated_at: '' },
      ])
      .mockResolvedValueOnce([
        { id: 100, api_key_id: 10, model_name: 'claude-opus-4-6', context_size: '200k', created_at: '', updated_at: '' },
        { id: 101, api_key_id: 10, model_name: 'claude-sonnet-4-6', context_size: null, created_at: '', updated_at: '' },
      ])
      .mockResolvedValueOnce([
        { id: 20, provider_id: 2, name: 'router', api_key_masked: 'sk-or-***', notes: null, created_at: '', updated_at: '' },
      ])
      .mockResolvedValueOnce([
        { id: 200, api_key_id: 20, model_name: 'gpt-4o', context_size: null, created_at: '', updated_at: '' },
      ])

    const { result } = renderHook(() => useAllModels())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.models).toEqual([
      { modelId: 100, modelName: 'claude-opus-4-6', providerName: 'Anthropic', keyName: 'Main Key' },
      { modelId: 101, modelName: 'claude-sonnet-4-6', providerName: 'Anthropic', keyName: 'Main Key' },
      { modelId: 200, modelName: 'gpt-4o', providerName: 'OpenRouter', keyName: 'router' },
    ])
  })

  test('returns empty array when no providers', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([])

    const { result } = renderHook(() => useAllModels())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.models).toEqual([])
  })

  test('refresh re-fetches all data', async () => {
    vi.mocked(invoke)
      // initial: empty
      .mockResolvedValueOnce([])
      // refresh: one provider
      .mockResolvedValueOnce([{ id: 1, name: 'P', base_url: '', notes: null, created_at: '', updated_at: '' }])
      .mockResolvedValueOnce([{ id: 10, provider_id: 1, name: 'K', api_key_masked: '', notes: null, created_at: '', updated_at: '' }])
      .mockResolvedValueOnce([{ id: 100, api_key_id: 10, model_name: 'm1', context_size: null, created_at: '', updated_at: '' }])

    const { result } = renderHook(() => useAllModels())
    await waitFor(() => expect(result.current.models).toEqual([]))

    const { act } = await import('@testing-library/react')
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.models).toEqual([
      { modelId: 100, modelName: 'm1', providerName: 'P', keyName: 'K' },
    ])
  })
})
