import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null, setConfigScope: vi.fn() },
  perms: { allowRules: [] as any[], denyRules: [] as any[], origin: 'global' as const, add: vi.fn(), remove: vi.fn() },
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/features/permissions/hooks/usePermissions', () => ({ usePermissions: () => mocks.perms }))
vi.mock('@/shared/hooks/useSelectProject', () => ({ useSelectProject: () => vi.fn() }))
vi.mock('@/i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  mocks.store.configScope = 'global'
  mocks.store.currentProject = null
})

describe('Permissions page', () => {
  it('renders ScopeSwitcher', async () => {
    const { Permissions } = await import('./Permissions')
    render(<Permissions />)
    expect(screen.getByText('scope.label')).toBeTruthy()
  })

  it('shows guard when project scope without project', async () => {
    mocks.store.configScope = 'project'
    const { Permissions } = await import('./Permissions')
    render(<Permissions />)
    expect(screen.queryByText('permissions.header.type')).toBeFalsy()
  })
})
