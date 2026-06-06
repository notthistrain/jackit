import { invoke } from '@tauri-apps/api/core'
import { act, renderHook, waitFor } from '@testing-library/react'

import { vi } from 'vitest'
import { useSlotBindings } from './useSlotBindings'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock Tauri event (useSlotBindings subscribes to settings-changed)
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}))

// Mock toast (stable references to avoid infinite re-renders)
const mockToast = { success: vi.fn(), error: vi.fn() }
vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => mockToast,
}))

describe('useSlotBindings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls get_slot_bindings on mount', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        intent: {
          slot: 'opus',
          model_id: 1,
          model_name: 'claude-opus-4-6',
          provider_id: 1,
          provider_name: 'Anthropic',
          base_url: 'https://api.anthropic.com',
          api_key_masked: 'sk-ant-***',
          context_size: null,
        },
        actual: {
          model_name: 'claude-opus-4-6',
          base_url: 'https://api.anthropic.com',
          api_key_masked: 'sk-ant-***',
        },
        matches: {
          model_name: true,
          base_url: true,
          api_key: true,
        },
      },
    ])

    const { result } = renderHook(() => useSlotBindings())

    await waitFor(() => {
      expect(result.current.bindings).toHaveLength(1)
    })
    expect(invoke).toHaveBeenCalledWith('get_slot_bindings')
  })

  it('.bind() calls bind_slot with slot + modelId', async () => {
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

  it('.setCurrentModel() calls set_current_model with slot + contextSize', async () => {
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
