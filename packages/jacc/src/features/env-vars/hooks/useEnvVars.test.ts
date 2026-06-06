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
      key: 'env',
      value: { MY_VAR: 'a', ANTHROPIC_MODEL: 'opus' },
      scope: 'global',
    }],
  }
  mocks.writeConfig.mockClear()
})

describe('useEnvVars', () => {
  it('splits regular vs model entries', async () => {
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    expect(result.current.regularEntries).toEqual([['MY_VAR', 'a']])
    expect(result.current.modelEntries).toEqual([['ANTHROPIC_MODEL', 'opus']])
    expect(result.current.scope).toBe('global')
  })

  it('add merges and writes', async () => {
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    await act(async () => {
      await result.current.add('NEW_KEY', 'v')
    })
    expect(mocks.writeConfig).toHaveBeenCalledWith('global', 'env', {
      MY_VAR: 'a',
      ANTHROPIC_MODEL: 'opus',
      NEW_KEY: 'v',
    })
  })

  it('remove deletes and writes', async () => {
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    await act(async () => {
      await result.current.remove('MY_VAR')
    })
    expect(mocks.writeConfig).toHaveBeenCalledWith('global', 'env', { ANTHROPIC_MODEL: 'opus' })
  })

  it('update overrides and writes', async () => {
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    await act(async () => {
      await result.current.update('MY_VAR', 'b')
    })
    expect(mocks.writeConfig).toHaveBeenCalledWith('global', 'env', {
      MY_VAR: 'b',
      ANTHROPIC_MODEL: 'opus',
    })
  })
})
