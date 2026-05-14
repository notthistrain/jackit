import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDataFeed } from '../useDataFeed'

// Track listeners registered via Tauri
let listeners: Record<string, (payload: any) => void> = {}
let listenResolve: (() => void) | null = null

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockImplementation((event: string, callback: (e: any) => void) => {
    listeners[event] = (payload: any) => callback({ payload })
    // Signal that listener is registered
    if (listenResolve)
      listenResolve()
    return Promise.resolve(vi.fn()) // unlisten
  }),
}))

// Helper to emit event to registered listeners
function emitEvent(event: string, payload: any) {
  if (listeners[event]) {
    listeners[event](payload)
  }
}

// Wait for listener to be registered
function waitForListener(): Promise<void> {
  if (listeners['port:data'])
    return Promise.resolve()
  return new Promise((resolve) => {
    listenResolve = resolve
  })
}

// Sample frame data matching Rust DisplayFrame serde output
const sampleFrame = {
  id: 1,
  timestamp: '2025-01-15T10:30:00Z',
  direction: 'rx' as const,
  raw_hex: '01 03 00 00 00 0A C5 CD',
  formatted: 'Modbus RTU Read',
  protocol: 'modbus',
  summary: 'Slave 1 Func 3',
}

const sampleFrame2 = {
  id: 2,
  timestamp: '2025-01-15T10:30:01Z',
  direction: 'tx' as const,
  raw_hex: '01 03 14',
  formatted: 'Raw data',
  protocol: 'raw',
  summary: '3 bytes',
}

describe('useDataFeed', () => {
  beforeEach(() => {
    listeners = {}
    listenResolve = null
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('receives and batches frames from port:data events', async () => {
    const { result } = renderHook(() => useDataFeed({ flushInterval: 100 }))

    await waitForListener()

    emitEvent('port:data', { port_id: 'COM3', frames: [sampleFrame] })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.frames).toHaveLength(1)
    expect(result.current.frames[0]).toEqual(sampleFrame)
    expect(result.current.totalCount).toBe(1)
  })

  it('filters frames by portId', async () => {
    const { result } = renderHook(() => useDataFeed({ portId: 'COM3', flushInterval: 100 }))

    await waitForListener()

    // Emit for different port — should be filtered out
    emitEvent('port:data', { port_id: 'COM5', frames: [sampleFrame] })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.frames).toHaveLength(0)
    expect(result.current.totalCount).toBe(0)

    // Emit for correct port — should pass through
    emitEvent('port:data', { port_id: 'COM3', frames: [sampleFrame2] })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.frames).toHaveLength(1)
    expect(result.current.frames[0]).toEqual(sampleFrame2)
    expect(result.current.totalCount).toBe(1)
  })

  it('batches multiple events before flush', async () => {
    renderHook(() => useDataFeed({ flushInterval: 100 }))

    await waitForListener()

    emitEvent('port:data', { port_id: 'COM3', frames: [sampleFrame] })
    emitEvent('port:data', { port_id: 'COM3', frames: [sampleFrame2] })

    act(() => {
      vi.advanceTimersByTime(150)
    })
  })

  it('clear() resets state', async () => {
    const { result } = renderHook(() => useDataFeed({ flushInterval: 100 }))

    await waitForListener()

    emitEvent('port:data', { port_id: 'COM3', frames: [sampleFrame] })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    act(() => {
      result.current.clear()
    })

    expect(result.current.frames).toHaveLength(0)
    expect(result.current.totalCount).toBe(0)
  })
})
