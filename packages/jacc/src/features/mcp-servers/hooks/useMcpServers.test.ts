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
  mocks.config = { items: [{ key: 'mcpServers', value: { a: { command: 'x' } }, origin: 'global' }] }
  mocks.writeConfig.mockClear()
})

describe('useMcpServers', () => {
  it('exposes servers and origin', async () => {
    const { useMcpServers } = await import('./useMcpServers')
    const { result } = renderHook(() => useMcpServers())
    expect(result.current.servers).toEqual({ a: { command: 'x' } })
    expect(result.current.origin).toBe('global')
  })

  it('save calls writeConfig with merged servers', async () => {
    const { useMcpServers } = await import('./useMcpServers')
    const { result } = renderHook(() => useMcpServers())
    await act(async () => {
      await result.current.save('b', { command: 'y' })
    })
    expect(mocks.writeConfig).toHaveBeenCalledWith('mcpServers', { a: { command: 'x' }, b: { command: 'y' } }, false)
  })

  it('remove calls writeConfig with server deleted', async () => {
    const { useMcpServers } = await import('./useMcpServers')
    const { result } = renderHook(() => useMcpServers())
    await act(async () => {
      await result.current.remove('a')
    })
    expect(mocks.writeConfig).toHaveBeenCalledWith('mcpServers', {}, false)
  })

  it('add calls writeConfig with new server and parses args', async () => {
    const { useMcpServers } = await import('./useMcpServers')
    const { result } = renderHook(() => useMcpServers())
    await act(async () => {
      await result.current.add('c', 'cmd', 'arg1 arg2')
    })
    expect(mocks.writeConfig).toHaveBeenCalledWith('mcpServers', {
      a: { command: 'x' },
      c: { command: 'cmd', args: ['arg1', 'arg2'] },
    }, false)
  })

  it('add sets args to undefined when argsString is empty', async () => {
    const { useMcpServers } = await import('./useMcpServers')
    const { result } = renderHook(() => useMcpServers())
    await act(async () => {
      await result.current.add('d', 'cmd2', '')
    })
    expect(mocks.writeConfig).toHaveBeenCalledWith('mcpServers', {
      a: { command: 'x' },
      d: { command: 'cmd2', args: undefined },
    }, false)
  })
})
