import { describe, expect, it } from 'vitest'
import { deleteEnvVar, extractEnv, setEnvVar, splitEnv } from './env-vars-api'

describe('env-vars-api', () => {
  describe('extractEnv', () => {
    it('returns empty env and global scope when config is null', () => {
      const result = extractEnv(null)
      expect(result).toEqual({ env: {}, scope: 'global' })
    })

    it('returns empty env and global scope when env item not found', () => {
      const result = extractEnv({ items: [{ key: 'other', value: 'x', scope: 'global' }] })
      expect(result).toEqual({ env: {}, scope: 'global' })
    })

    it('returns env object and scope when env item exists', () => {
      const result = extractEnv({
        items: [{ key: 'env', value: { MY_VAR: 'a' }, scope: 'project' }],
      })
      expect(result).toEqual({ env: { MY_VAR: 'a' }, scope: 'project' })
    })
  })

  describe('splitEnv', () => {
    it('splits all model keys into modelEntries', () => {
      const result = splitEnv({ ANTHROPIC_MODEL: 'opus', ANTHROPIC_BASE_URL: 'url' })
      expect(result.regularEntries).toEqual([])
      expect(result.modelEntries).toHaveLength(2)
    })

    it('splits all regular keys into regularEntries', () => {
      const result = splitEnv({ MY_VAR: 'a', OTHER: 'b' })
      expect(result.regularEntries).toHaveLength(2)
      expect(result.modelEntries).toEqual([])
    })

    it('splits mixed keys correctly', () => {
      const result = splitEnv({ MY_VAR: 'a', ANTHROPIC_MODEL: 'opus' })
      expect(result.regularEntries).toEqual([['MY_VAR', 'a']])
      expect(result.modelEntries).toEqual([['ANTHROPIC_MODEL', 'opus']])
    })
  })

  describe('setEnvVar', () => {
    it('adds new key', () => {
      const result = setEnvVar({ A: 'a' }, 'B', 'b')
      expect(result).toEqual({ A: 'a', B: 'b' })
    })

    it('overrides existing key', () => {
      const result = setEnvVar({ A: 'a' }, 'A', 'b')
      expect(result).toEqual({ A: 'b' })
    })

    it('does not modify original object', () => {
      const original = { A: 'a' }
      const result = setEnvVar(original, 'B', 'b')
      expect(original).toEqual({ A: 'a' })
      expect(result).toEqual({ A: 'a', B: 'b' })
    })
  })

  describe('deleteEnvVar', () => {
    it('removes existing key', () => {
      const result = deleteEnvVar({ A: 'a', B: 'b' }, 'A')
      expect(result).toEqual({ B: 'b' })
    })

    it('returns same env when key does not exist', () => {
      const result = deleteEnvVar({ A: 'a' }, 'B')
      expect(result).toEqual({ A: 'a' })
    })

    it('does not modify original object', () => {
      const original = { A: 'a', B: 'b' }
      const result = deleteEnvVar(original, 'A')
      expect(original).toEqual({ A: 'a', B: 'b' })
      expect(result).toEqual({ B: 'b' })
    })
  })
})
