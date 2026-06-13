import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useModelNode } from './useModelNode'

describe('useModelNode', () => {
  it('toggles confirmDelete', () => {
    const { result } = renderHook(() => useModelNode())
    expect(result.current.confirmDelete).toBe(false)
    act(() => result.current.setConfirmDelete(true))
    expect(result.current.confirmDelete).toBe(true)
  })
})
