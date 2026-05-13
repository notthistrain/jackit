import { beforeEach, describe, expect, it } from 'vitest'
import { useSnippetsStore } from '../snippets-store'

describe('useSnippetsStore', () => {
  beforeEach(() => {
    const { snippets } = useSnippetsStore.getState()
    snippets.forEach(s => useSnippetsStore.getState().remove(s.id))
  })

  it('adds a snippet', () => {
    useSnippetsStore.getState().add('Test', '01 03 00')
    const state = useSnippetsStore.getState()
    expect(state.snippets).toHaveLength(1)
    expect(state.snippets[0].name).toBe('Test')
    expect(state.snippets[0].data).toBe('01 03 00')
    expect(state.snippets[0].id).toBeTruthy()
  })

  it('removes a snippet by id', () => {
    useSnippetsStore.getState().add('A', '01')
    useSnippetsStore.getState().add('B', '02')
    const id = useSnippetsStore.getState().snippets[0]!.id
    useSnippetsStore.getState().remove(id)
    expect(useSnippetsStore.getState().snippets).toHaveLength(1)
    expect(useSnippetsStore.getState().snippets[0]!.name).toBe('B')
  })

  it('sets createdAt timestamp', () => {
    const before = Date.now()
    useSnippetsStore.getState().add('Timer', 'FF')
    const after = Date.now()
    const snippet = useSnippetsStore.getState().snippets[0]!
    expect(snippet.createdAt).toBeGreaterThanOrEqual(before)
    expect(snippet.createdAt).toBeLessThanOrEqual(after)
  })
})
