import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'

// Mock tauri invoke
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

import { useModels, useSlotBindings } from './useModels'

describe('useModels', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  test('useModels calls list_models on mount', async () => {
    const fakeModels = [
      {
        id: 1,
        alias: 'test-model',
        base_url: 'http://localhost',
        api_key_masked: 'sk-***',
        model_name: 'gpt-4',
        context_size: '4096',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]
    mockInvoke.mockResolvedValue(fakeModels)

    const { result } = renderHook(() => useModels())

    await waitFor(() => {
      expect(result.current.models).toEqual(fakeModels)
    })

    expect(mockInvoke).toHaveBeenCalledWith('list_models')
    expect(result.current.loading).toBe(false)
  })

  test('useModels.add calls add_model invoke', async () => {
    const input = {
      alias: 'new-model',
      base_url: 'http://localhost',
      api_key: 'sk-test',
      model_name: 'gpt-4',
      context_size: '4096',
    }

    // mount: list_models, then add_model, then refresh list_models
    mockInvoke.mockResolvedValueOnce([]) // list_models (mount)
    mockInvoke.mockResolvedValueOnce(undefined) // add_model
    mockInvoke.mockResolvedValueOnce([]) // list_models (refresh after add)

    const { result } = renderHook(() => useModels())

    // Wait for initial mount refresh
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_models')
    })

    await act(async () => {
      await result.current.add(input)
    })

    expect(mockInvoke).toHaveBeenCalledWith('add_model', { input })
  })

  test('useModels.remove calls delete_model invoke', async () => {
    mockInvoke.mockResolvedValueOnce([]) // list_models (mount)
    mockInvoke.mockResolvedValueOnce(undefined) // delete_model
    mockInvoke.mockResolvedValueOnce([]) // list_models (refresh)

    const { result } = renderHook(() => useModels())

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_models')
    })

    await act(async () => {
      await result.current.remove(42)
    })

    expect(mockInvoke).toHaveBeenCalledWith('delete_model', { id: 42 })
  })

  test('useModels.test calls test_model invoke', async () => {
    mockInvoke.mockResolvedValueOnce([]) // list_models (mount)
    mockInvoke.mockResolvedValueOnce('ok') // test_model

    const { result } = renderHook(() => useModels())

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_models')
    })

    let testResult: string | undefined
    await act(async () => {
      testResult = await result.current.test(7)
    })

    expect(mockInvoke).toHaveBeenCalledWith('test_model', { id: 7 })
    expect(testResult).toBe('ok')
  })
})

describe('useSlotBindings', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  test('useSlotBindings calls get_slot_bindings on mount', async () => {
    const fakeBindings = [
      {
        slot: 'default',
        model_id: 1,
        alias: 'test-model',
        base_url: 'http://localhost',
        model_name: 'gpt-4',
        context_size: '4096',
      },
    ]
    mockInvoke.mockResolvedValue(fakeBindings)

    const { result } = renderHook(() => useSlotBindings())

    await waitFor(() => {
      expect(result.current.bindings).toEqual(fakeBindings)
    })

    expect(mockInvoke).toHaveBeenCalledWith('get_slot_bindings')
    expect(result.current.loading).toBe(false)
  })

  test('useSlotBindings.bind calls bind_slot invoke', async () => {
    mockInvoke.mockResolvedValueOnce([]) // get_slot_bindings (mount)
    mockInvoke.mockResolvedValueOnce(undefined) // bind_slot
    mockInvoke.mockResolvedValueOnce([]) // get_slot_bindings (refresh)

    const { result } = renderHook(() => useSlotBindings())

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_slot_bindings')
    })

    await act(async () => {
      await result.current.bind('default', 5)
    })

    expect(mockInvoke).toHaveBeenCalledWith('bind_slot', {
      slot: 'default',
      modelId: 5,
    })
  })

  test('useSlotBindings.unbind calls unbind_slot invoke', async () => {
    mockInvoke.mockResolvedValueOnce([]) // get_slot_bindings (mount)
    mockInvoke.mockResolvedValueOnce(undefined) // unbind_slot
    mockInvoke.mockResolvedValueOnce([]) // get_slot_bindings (refresh)

    const { result } = renderHook(() => useSlotBindings())

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_slot_bindings')
    })

    await act(async () => {
      await result.current.unbind('default')
    })

    expect(mockInvoke).toHaveBeenCalledWith('unbind_slot', { slot: 'default' })
  })

  test('useSlotBindings.setCurrentModel calls set_current_model invoke', async () => {
    mockInvoke.mockResolvedValueOnce([]) // get_slot_bindings (mount)
    mockInvoke.mockResolvedValueOnce(undefined) // set_current_model

    const { result } = renderHook(() => useSlotBindings())

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_slot_bindings')
    })

    await act(async () => {
      await result.current.setCurrentModel('default', '8192')
    })

    expect(mockInvoke).toHaveBeenCalledWith('set_current_model', {
      slot: 'default',
      contextSize: '8192',
    })
  })
})
