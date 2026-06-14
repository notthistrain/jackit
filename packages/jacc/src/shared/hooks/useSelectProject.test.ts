import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  add: vi.fn().mockResolvedValue(undefined),
  openProject: vi.fn().mockResolvedValue(undefined),
  setProject: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }))
vi.mock('@/shared/hooks/useProjects', () => ({
  useProjects: () => ({ add: mocks.add, open: mocks.openProject }),
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => ({ setProject: mocks.setProject }) }))

beforeEach(() => {
  mocks.open.mockReset()
  mocks.add.mockReset().mockResolvedValue(undefined)
  mocks.openProject.mockReset().mockResolvedValue(undefined)
  mocks.setProject.mockReset()
})

describe('useSelectProject', () => {
  it('adds, opens and sets project when a folder is chosen', async () => {
    mocks.open.mockResolvedValue('/picked/proj')
    const { useSelectProject } = await import('./useSelectProject')
    const { result } = renderHook(() => useSelectProject())
    await act(async () => {
      await result.current()
    })
    expect(mocks.add).toHaveBeenCalledWith('/picked/proj')
    expect(mocks.openProject).toHaveBeenCalledWith('/picked/proj')
    expect(mocks.setProject).toHaveBeenCalledWith('/picked/proj')
  })

  it('does nothing when dialog is cancelled', async () => {
    mocks.open.mockResolvedValue(null)
    const { useSelectProject } = await import('./useSelectProject')
    const { result } = renderHook(() => useSelectProject())
    await act(async () => {
      await result.current()
    })
    expect(mocks.setProject).not.toHaveBeenCalled()
  })
})
