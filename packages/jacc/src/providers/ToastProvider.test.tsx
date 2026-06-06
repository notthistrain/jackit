import { act, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './ToastProvider'

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

describe('toastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders success toast and auto-dismisses after 2s', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => {
      result.current.success('saved')
    })
    expect(screen.getByText('saved')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('saved')).toBeNull()
  })

  it('renders error toast and auto-dismisses after 4s', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => {
      result.current.error('boom')
    })
    expect(screen.getByText('boom')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('boom')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('boom')).toBeNull()
  })

  it('close button removes toast immediately', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => {
      result.current.success('hello')
    })
    const closeBtn = screen.getByRole('button')
    act(() => {
      closeBtn.click()
    })
    expect(screen.queryByText('hello')).toBeNull()
  })

  it('throws when useToast called outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useToast())).toThrow(/useToast must be used within ToastProvider/)
    spy.mockRestore()
  })
})
