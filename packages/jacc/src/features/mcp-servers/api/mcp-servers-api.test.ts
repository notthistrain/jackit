import type { MergedConfig } from '@/shared/hooks/useConfig'
import { describe, expect, it } from 'vitest'
import { extractMcpServers, removeServer, upsertServer } from './mcp-servers-api'

describe('extractMcpServers', () => {
  it('extracts servers and scope when mcpServers item exists', () => {
    const config: MergedConfig = {
      items: [
        { key: 'mcpServers', value: { a: { command: 'x' }, b: { command: 'y' } }, scope: 'project' },
      ],
    }
    const result = extractMcpServers(config)
    expect(result.servers).toEqual({ a: { command: 'x' }, b: { command: 'y' } })
    expect(result.scope).toBe('project')
  })

  it('returns empty servers and global scope when mcpServers item does not exist', () => {
    const config: MergedConfig = { items: [{ key: 'other', value: {}, scope: 'global' }] }
    const result = extractMcpServers(config)
    expect(result.servers).toEqual({})
    expect(result.scope).toBe('global')
  })

  it('returns empty servers and global scope when config is null', () => {
    const result = extractMcpServers(null)
    expect(result.servers).toEqual({})
    expect(result.scope).toBe('global')
  })
})

describe('upsertServer', () => {
  it('adds a new server', () => {
    const servers = { a: { command: 'x' } }
    const result = upsertServer(servers, 'b', { command: 'y' })
    expect(result).toEqual({ a: { command: 'x' }, b: { command: 'y' } })
  })

  it('overwrites an existing server', () => {
    const servers = { a: { command: 'x' } }
    const result = upsertServer(servers, 'a', { command: 'z' })
    expect(result).toEqual({ a: { command: 'z' } })
  })

  it('does not mutate the original servers object', () => {
    const servers = { a: { command: 'x' } }
    const result = upsertServer(servers, 'b', { command: 'y' })
    expect(servers).toEqual({ a: { command: 'x' } })
    expect(result).not.toBe(servers)
  })
})

describe('removeServer', () => {
  it('removes an existing server', () => {
    const servers = { a: { command: 'x' }, b: { command: 'y' } }
    const result = removeServer(servers, 'a')
    expect(result).toEqual({ b: { command: 'y' } })
  })

  it('does nothing when server does not exist', () => {
    const servers = { a: { command: 'x' } }
    const result = removeServer(servers, 'b')
    expect(result).toEqual({ a: { command: 'x' } })
  })

  it('does not mutate the original servers object', () => {
    const servers = { a: { command: 'x' }, b: { command: 'y' } }
    const result = removeServer(servers, 'a')
    expect(servers).toEqual({ a: { command: 'x' }, b: { command: 'y' } })
    expect(result).not.toBe(servers)
  })
})
