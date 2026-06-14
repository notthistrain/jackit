import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null, setConfigScope: vi.fn() },
  env: {
    regularEntries: [] as Array<[string, string]>,
    modelEntries: [] as Array<[string, string]>,
    origin: 'global' as const,
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/features/env-vars/hooks/useEnvVars', () => ({ useEnvVars: () => mocks.env }))
vi.mock('@/shared/hooks/useSelectProject', () => ({ useSelectProject: () => vi.fn() }))
vi.mock('@/i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  mocks.store.configScope = 'global'
  mocks.store.currentProject = null
})

describe('envVars page', () => {
  it('renders ScopeSwitcher', async () => {
    const { EnvVars } = await import('./EnvVars')
    render(<EnvVars />)
    expect(screen.getByText('scope.label')).toBeTruthy()
  })

  it('shows guard when project scope without project', async () => {
    mocks.store.configScope = 'project'
    const { EnvVars } = await import('./EnvVars')
    render(<EnvVars />)
    expect(screen.queryByText('envvars.header.name')).toBeFalsy()
  })
})
