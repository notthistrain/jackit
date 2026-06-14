import { describe, expect, it } from 'vitest'
import { addRule, extractPermissions, removeRule } from './permissions-api'

describe('permissions-api', () => {
  describe('extractPermissions', () => {
    it('returns empty permissions and global origin when config is null', () => {
      const result = extractPermissions(null)
      expect(result.permissions).toEqual({})
      expect(result.origin).toBe('global')
    })

    it('returns empty permissions and global origin when permissions item is missing', () => {
      const config = { items: [{ key: 'other', value: 'foo', origin: 'shared' as const }] }
      const result = extractPermissions(config)
      expect(result.permissions).toEqual({})
      expect(result.origin).toBe('global')
    })

    it('extracts permissions and origin from config item', () => {
      const config = {
        items: [
          {
            key: 'permissions',
            value: { allow: [{ tool: 'Bash', pattern: 'ls' }], deny: [] },
            origin: 'shared' as const,
          },
        ],
      }
      const result = extractPermissions(config)
      expect(result.permissions).toEqual({ allow: [{ tool: 'Bash', pattern: 'ls' }], deny: [] })
      expect(result.origin).toBe('shared')
    })
  })

  describe('addRule', () => {
    it('initializes array when type does not exist', () => {
      const permissions = {}
      const rule = { tool: 'Bash', pattern: 'rm' }
      const result = addRule(permissions, 'deny', rule)
      expect(result).toEqual({ deny: [rule] })
      expect(result).not.toBe(permissions)
    })

    it('appends rule to existing array', () => {
      const permissions = { allow: [{ tool: 'Bash', pattern: 'ls' }] }
      const rule = { tool: 'Read', pattern: '*.txt' }
      const result = addRule(permissions, 'allow', rule)
      expect(result.allow).toEqual([{ tool: 'Bash', pattern: 'ls' }, rule])
    })

    it('does not modify original permissions object', () => {
      const permissions = { allow: [{ tool: 'Bash', pattern: 'ls' }] }
      const original = permissions.allow
      const result = addRule(permissions, 'allow', { tool: 'Read', pattern: '*.txt' })
      expect(permissions.allow).toBe(original)
      expect(result.allow).not.toBe(original)
    })
  })

  describe('removeRule', () => {
    it('removes rule at specified index', () => {
      const permissions = {
        allow: [
          { tool: 'Bash', pattern: 'ls' },
          { tool: 'Read', pattern: '*.txt' },
          { tool: 'Write', pattern: '*.log' },
        ],
      }
      const result = removeRule(permissions, 'allow', 1)
      expect(result.allow).toEqual([
        { tool: 'Bash', pattern: 'ls' },
        { tool: 'Write', pattern: '*.log' },
      ])
    })

    it('handles out-of-bounds index gracefully', () => {
      const permissions = { allow: [{ tool: 'Bash', pattern: 'ls' }] }
      const result = removeRule(permissions, 'allow', 10)
      expect(result.allow).toEqual([{ tool: 'Bash', pattern: 'ls' }])
    })

    it('does not modify original permissions object', () => {
      const permissions = { deny: [{ tool: 'Bash', pattern: 'rm' }] }
      const original = permissions.deny
      const result = removeRule(permissions, 'deny', 0)
      expect(permissions.deny).toBe(original)
      expect(result.deny).not.toBe(original)
    })
  })
})
