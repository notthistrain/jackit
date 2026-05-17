import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { useProviders } from './useProviders'
import { useApiKeys } from './useApiKeys'
import { useModels } from './useModels'
import { useSlotBindings } from './useSlotBindings'

// -- useProviders tests --

describe('useProviders', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('mounts and calls list_providers', async () => {
    const mockProviders = [
      { id: 1, name: 'Anthropic', base_url: 'https://api.anthropic.com', notes: null, created_at: '', updated_at: '' },
    ]
    vi.mocked(invoke).mockResolvedValueOnce(mockProviders)

    const { result } = renderHook(() => useProviders())

    await waitFor(() => {
      expect(result.current.providers).toEqual(mockProviders)
    })
    expect(invoke).toHaveBeenCalledWith('list_providers')
  })

  test('.add() calls add_provider then refreshes', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial list
      .mockResolvedValueOnce({ id: 1, name: 'New', base_url: 'https://new.com', notes: null, created_at: '', updated_at: '' }) // add
      .mockResolvedValueOnce([{ id: 1, name: 'New', base_url: 'https://new.com', notes: null, created_at: '', updated_at: '' }]) // refresh

    const { result } = renderHook(() => useProviders())
    await waitFor(() => expect(result.current.providers).toEqual([]))

    await act(async () => {
      await result.current.add({ name: 'New', base_url: 'https://new.com', notes: null })
    })

    expect(invoke).toHaveBeenCalledWith('add_provider', {
      input: { name: 'New', base_url: 'https://new.com', notes: null },
    })
  })

  test('.remove() calls delete_provider then refreshes', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial list
      .mockResolvedValueOnce(undefined) // delete
      .mockResolvedValueOnce([]) // refresh

    const { result } = renderHook(() => useProviders())
    await waitFor(() => expect(result.current.providers).toEqual([]))

    await act(async () => {
      await result.current.remove(1)
    })

    expect(invoke).toHaveBeenCalledWith('delete_provider', { id: 1 })
  })
})

// -- useApiKeys tests --

describe('useApiKeys', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('calls list_api_keys with provider_id on mount', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { id: 1, provider_id: 10, name: 'Main', api_key_masked: 'sk-ant-1***', notes: null, created_at: '', updated_at: '' },
    ])

    const { result } = renderHook(() => useApiKeys(10))

    await waitFor(() => {
      expect(result.current.apiKeys).toHaveLength(1)
    })
    expect(invoke).toHaveBeenCalledWith('list_api_keys', { provider_id: 10 })
  })

  test('.add() calls add_api_key then refreshes', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial
      .mockResolvedValueOnce(undefined) // add
      .mockResolvedValueOnce([]) // refresh

    const { result } = renderHook(() => useApiKeys(10))
    await waitFor(() => expect(result.current.apiKeys).toEqual([]))

    await act(async () => {
      await result.current.add({ provider_id: 10, name: 'Key', api_key: 'sk-test', notes: null })
    })

    expect(invoke).toHaveBeenCalledWith('add_api_key', {
      input: { provider_id: 10, name: 'Key', api_key: 'sk-test', notes: null },
    })
  })
})

// -- useModels tests --

describe('useModels', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('calls list_models with api_key_id on mount', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { id: 1, api_key_id: 5, model_name: 'claude-opus-4-6', context_size: '200k', created_at: '', updated_at: '' },
    ])

    const { result } = renderHook(() => useModels(5))

    await waitFor(() => {
      expect(result.current.models).toHaveLength(1)
    })
    expect(invoke).toHaveBeenCalledWith('list_models', { api_key_id: 5 })
  })

  test('.add() calls add_model then refreshes', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial
      .mockResolvedValueOnce(undefined) // add
      .mockResolvedValueOnce([]) // refresh

    const { result } = renderHook(() => useModels(5))
    await waitFor(() => expect(result.current.models).toEqual([]))

    await act(async () => {
      await result.current.add({ api_key_id: 5, model_name: 'test', context_size: null })
    })

    expect(invoke).toHaveBeenCalledWith('add_model', {
      input: { api_key_id: 5, model_name: 'test', context_size: null },
    })
  })

  test('.test() calls test_model and returns result', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial list
      .mockResolvedValueOnce('CONNECTION_SUCCESS')

    const { result } = renderHook(() => useModels(5))
    await waitFor(() => expect(result.current.models).toEqual([]))

    let res: string = ''
    await act(async () => {
      res = await result.current.test(1)
    })
    expect(res).toBe('CONNECTION_SUCCESS')
    expect(invoke).toHaveBeenCalledWith('test_model', { id: 1 })
  })
})

// -- useSlotBindings tests --

describe('useSlotBindings', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('calls get_slot_bindings on mount', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { slot: 'opus', model_id: 1, model_name: 'claude-opus-4-6', context_size: null, api_key: 'sk-ant-aaa', base_url: 'https://api.anthropic.com', provider_name: 'Anthropic' },
    ])

    const { result } = renderHook(() => useSlotBindings())

    await waitFor(() => {
      expect(result.current.bindings).toHaveLength(1)
    })
    expect(invoke).toHaveBeenCalledWith('get_slot_bindings')
  })

  test('.bind() calls bind_slot with slot + modelId', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial
      .mockResolvedValueOnce(undefined) // bind
      .mockResolvedValueOnce([]) // refresh

    const { result } = renderHook(() => useSlotBindings())
    await waitFor(() => expect(result.current.bindings).toEqual([]))

    await act(async () => {
      await result.current.bind('opus', 1)
    })

    expect(invoke).toHaveBeenCalledWith('bind_slot', { slot: 'opus', modelId: 1 })
  })

  test('.setCurrentModel() calls set_current_model with slot + contextSize', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial
      .mockResolvedValueOnce(undefined) // set_current_model

    const { result } = renderHook(() => useSlotBindings())
    await waitFor(() => expect(result.current.bindings).toEqual([]))

    await act(async () => {
      await result.current.setCurrentModel('opus', '1m')
    })

    expect(invoke).toHaveBeenCalledWith('set_current_model', { slot: 'opus', contextSize: '1m' })
  })
})
