import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './useAppStore'

describe('useAppStore', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.setState({ currentPage: 'general', currentProject: null, theme: 'system' })
    })
  })

  it('setTheme updates theme', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setTheme('dark'))
    expect(result.current.theme).toBe('dark')
  })

  it('setPage updates currentPage', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setPage('models'))
    expect(result.current.currentPage).toBe('models')
  })

  it('setProject updates currentProject', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setProject('/p'))
    expect(result.current.currentProject).toBe('/p')
  })
})
