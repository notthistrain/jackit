import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  config: null as any,
  writeConfig: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/shared/hooks/useConfig', () => ({
  useConfig: () => ({ config: mocks.config, writeConfig: mocks.writeConfig }),
}))

beforeEach(() => {
  mocks.config = {
    items: [{
      key: 'permissions',
      value: { allow: [{ tool: 'Bash', pattern: 'ls' }], deny: [] },
      scope: 'global',
    }],
  }
  mocks.writeConfig.mockClear()
})

describe('usePermissions', () => {
  it('exposes allowRules/denyRules and scope', async () => {
    const { usePermissions } = await import('./usePermissions')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.allowRules).toEqual([{ tool: 'Bash', pattern: 'ls' }])
    expect(result.current.denyRules).toEqual([])
    expect(result.current.scope).toBe('global')
  })

  it('add uses form scope, not permScope', async () => {
    const { usePermissions } = await import('./usePermissions')
    const { result } = renderHook(() => usePermissions())
    await act(async () => {
      await result.current.add('deny', { tool: 'Bash', pattern: 'rm' }, 'project')
    })
    expect(mocks.writeConfig).toHaveBeenCalledWith('project', 'permissions', {
      allow: [{ tool: 'Bash', pattern: 'ls' }],
      deny: [{ tool: 'Bash', pattern: 'rm' }],
    })
  })

  it('remove uses scope', async () => {
    const { usePermissions } = await import('./usePermissions')
    const { result } = renderHook(() => usePermissions())
    await act(async () => {
      await result.current.remove('allow', 0)
    })
    expect(mocks.writeConfig).toHaveBeenCalledWith('global', 'permissions', { allow: [], deny: [] })
  })

  it('handles null config with defaults', async () => {
    mocks.config = null
    const { usePermissions } = await import('./usePermissions')
    const { result } = renderHook(() => usePermissions())
    expect(result.current.allowRules).toEqual([])
    expect(result.current.denyRules).toEqual([])
    expect(result.current.scope).toBe('global')
  })
})
