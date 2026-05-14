import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}))

import { useHistory } from '../useHistory'

describe('useHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads sessions', async () => {
    const sessions = [{ id: 1, port_name: 'COM3', baud_rate: 115200, created_at: '2026-05-14' }]
    mockInvoke.mockResolvedValueOnce({ sessions })

    const { result } = renderHook(() => useHistory())

    await act(async () => {
      await result.current.loadSessions()
    })

    expect(mockInvoke).toHaveBeenCalledWith('list_recent_sessions', { request: { limit: 20 } })
    expect(result.current.store.sessions).toHaveLength(1)
  })

  it('loads frames for session', async () => {
    const frames = [{ id: 1, timestamp: '2026-05-14', direction: 'rx', raw_hex: 'AA', formatted: 'test', protocol: 'raw', summary: '1 byte' }]
    mockInvoke.mockResolvedValueOnce({ frames, total: 1 })

    const { result } = renderHook(() => useHistory())

    await act(async () => {
      await result.current.loadFrames(1)
    })

    expect(mockInvoke).toHaveBeenCalledWith('query_history', {
      request: {
        session_id: 1,
        direction: undefined,
        protocol: null,
        limit: 50,
        offset: 0,
      },
    })
    expect(result.current.store.frames).toHaveLength(1)
  })
})
