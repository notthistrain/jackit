import type { LayerConfig } from '@/shared/hooks/useConfig'
import { describe, expect, it } from 'vitest'
import { extractMcpServers, removeServer, upsertServer } from './mcp-servers-api'

describe('extractMcpServers', () => {
  it('extracts servers and origin when mcpServers item exists', () => {
    const config: LayerConfig = {
      items: [
        { key: 'mcpServers', value: { a: { command: 'x' }, b: { command: 'y' } }, origin: 'shared' },
      ],
    }
    const result = extractMcpServers(config)
    expect(result.servers).toEqual({ a: { command: 'x' }, b: { command: 'y' } })
    expect(result.origin).toBe('shared')
  })

  it('returns empty servers and global origin when mcpServers item does not exist', () => {
    const config: LayerConfig = { items: [{ key: 'other', value: {}, origin: 'global' }] }
    const result = extractMcpServers(config)
    expect(result.servers).toEqual({})
    expect(result.origin).toBe('global')
  })

  it('returns empty servers and global origin when config is null', () => {
    const result = extractMcpServers(null)
    expect(result.servers).toEqual({})
    expect(result.origin).toBe('global')
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
