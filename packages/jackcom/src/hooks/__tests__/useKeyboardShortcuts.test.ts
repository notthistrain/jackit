import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls handler on matching shortcut', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', ctrl: true, handler },
    ]))

    fireEvent.keyDown(document, { key: 'n', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not call handler without ctrl', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', ctrl: true, handler },
    ]))

    fireEvent.keyDown(document, { key: 'n' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('supports ctrl+shift combinations', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts([
      { key: 'w', ctrl: true, shift: true, handler },
    ]))

    fireEvent.keyDown(document, { key: 'w', ctrlKey: true, shiftKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('calls preventDefault on matched shortcut', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', ctrl: true, handler },
    ]))

    const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true })
    const spy = vi.spyOn(event, 'preventDefault')
    document.dispatchEvent(event)
    expect(spy).toHaveBeenCalled()
  })

  it('unregisters on unmount', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcuts([
      { key: 'n', ctrl: true, handler },
    ]))

    unmount()
    fireEvent.keyDown(document, { key: 'n', ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })
})
