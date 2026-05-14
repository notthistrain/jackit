import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

import { useSerialConfig } from '../useSerialConfig'

describe('useSerialConfig', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('returns default config when localStorage is empty', () => {
    const { result } = renderHook(() => useSerialConfig())
    expect(result.current.config.baudRate).toBe(115200)
    expect(result.current.config.dataBits).toBe(8)
    expect(result.current.config.stopBits).toBe(1)
    expect(result.current.config.parity).toBe('none')
    expect(result.current.config.flowControl).toBe('none')
  })

  it('updates config with setConfig', () => {
    const { result } = renderHook(() => useSerialConfig())
    act(() => {
      result.current.setConfig({ baudRate: 9600 })
    })
    expect(result.current.config.baudRate).toBe(9600)
  })

  it('saves to recent configs via saveAsRecent', () => {
    const { result } = renderHook(() => useSerialConfig())
    act(() => {
      result.current.setConfig({ portName: 'COM3', baudRate: 115200 })
    })
    act(() => {
      result.current.saveAsRecent()
    })
    expect(result.current.recentConfigs).toHaveLength(1)
    expect(result.current.recentConfigs[0].portName).toBe('COM3')
  })

  it('keeps at most 5 recent configs', () => {
    const { result } = renderHook(() => useSerialConfig())
    for (let i = 0; i < 7; i++) {
      act(() => {
        result.current.setConfig({ portName: `COM${i}`, baudRate: 9600 + i })
      })
      act(() => {
        result.current.saveAsRecent()
      })
    }
    expect(result.current.recentConfigs).toHaveLength(5)
    expect(result.current.recentConfigs[0].portName).toBe('COM6')
  })
})
