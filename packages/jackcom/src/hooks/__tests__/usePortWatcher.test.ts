import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Track listeners and allow simulating events
let registeredCallbacks: Record<string, (payload: any) => void> = {}

vi.mock('@/lib/tauri-events', () => ({
  on: vi.fn().mockImplementation((event: string, callback: (payload: any) => void) => {
    registeredCallbacks[event] = callback
    return Promise.resolve(vi.fn()) // unlisten
  }),
}))

describe('usePortWatcher', () => {
  beforeEach(() => {
    registeredCallbacks = {}
  })

  it('calls onChange when port:change event fires', async () => {
    const onChange = vi.fn()

    const { usePortWatcher } = await import('../usePortWatcher')
    renderHook(() => usePortWatcher(onChange))

    // Simulate port:change event
    const testPayload = { port: 'COM3', action: 'connected' }
    if (registeredCallbacks['port:change']) {
      registeredCallbacks['port:change'](testPayload)
    }

    expect(onChange).toHaveBeenCalledWith(testPayload)
  })
})
