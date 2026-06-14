import { describe, expect, it } from 'vitest'
import { ENV_CATALOG, findEnvMeta, searchCatalog } from './env-catalog'

describe('env-catalog', () => {
  it('covers all 17 groups', () => {
    const groups = new Set(ENV_CATALOG.map(m => m.group))
    expect(groups.size).toBe(17)
  })

  it('findEnvMeta returns meta by exact name', () => {
    const meta = findEnvMeta('ANTHROPIC_API_KEY')
    expect(meta?.sensitive).toBe(true)
  })

  it('marks slot-managed credential vars', () => {
    expect(findEnvMeta('ANTHROPIC_AUTH_TOKEN')?.slotManaged).toBe(true)
    expect(findEnvMeta('ANTHROPIC_DEFAULT_OPUS_MODEL')?.slotManaged).toBe(true)
  })

  it('does not include read-only identity vars', () => {
    expect(findEnvMeta('CLAUDECODE')).toBeUndefined()
    expect(findEnvMeta('CLAUDE_CODE_CHILD_SESSION')).toBeUndefined()
  })

  it('searchCatalog fuzzy-matches name case-insensitively', () => {
    const results = searchCatalog('token')
    expect(results.some(m => m.name === 'ANTHROPIC_AUTH_TOKEN')).toBe(true)
  })

  it('searchCatalog returns all when query empty', () => {
    expect(searchCatalog('').length).toBe(ENV_CATALOG.length)
  })

  it('boolean vars carry no enumValues; enum vars carry enumValues', () => {
    const bools = ENV_CATALOG.filter(m => m.type === 'boolean')
    expect(bools.every(m => !m.enumValues)).toBe(true)
    const enums = ENV_CATALOG.filter(m => m.type === 'enum')
    expect(enums.every(m => (m.enumValues?.length ?? 0) > 0)).toBe(true)
  })
})
