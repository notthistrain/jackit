import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null, setConfigScope: vi.fn() },
  config: { items: [] as Array<{ key: string, value: unknown, origin: string }> },
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/shared/hooks/useConfig', () => ({
  useConfig: () => ({ config: mocks.config, refresh: vi.fn(), writeConfig: vi.fn() }),
}))
vi.mock('@/shared/hooks/useSlotBindings', () => ({
  useSlotBindings: () => ({ bindings: [], bind: vi.fn(), setCurrentModel: vi.fn() }),
}))
vi.mock('@/shared/hooks/usePreferences', () => ({ usePreferences: () => ({ set: vi.fn() }) }))
vi.mock('@/shared/hooks/useSelectProject', () => ({ useSelectProject: () => vi.fn() }))
vi.mock('@/providers/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/i18n', () => ({ useT: () => ({ t: (key: string) => key, locale: 'zh', setLocale: vi.fn() }) }))

beforeEach(() => {
  mocks.store.configScope = 'global'
  mocks.store.currentProject = null
  mocks.config.items = []
})

describe('general page', () => {
  it('renders ScopeSwitcher', async () => {
    const { General } = await import('./General')
    render(<General />)
    expect(screen.getByText('scope.label')).toBeTruthy()
  })

  it('shows EmptyState when project scope without project', async () => {
    mocks.store.configScope = 'project'
    const { General } = await import('./General')
    render(<General />)
    expect(screen.queryByText('general.slots')).toBeFalsy()
  })

  it('shows local-write hint on slot card in project scope with project', async () => {
    mocks.store.configScope = 'project'
    mocks.store.currentProject = '/proj'
    const { General } = await import('./General')
    render(<General />)
    expect(screen.getByText(/slotProjectHint/)).toBeTruthy()
  })
})
