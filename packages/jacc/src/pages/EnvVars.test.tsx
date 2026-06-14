import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null, setConfigScope: vi.fn() },
  env: {
    entries: [] as Array<{ key: string, value: string, origin: string }>,
    regularEntries: [] as Array<{ key: string, value: string, origin: string }>,
    modelEntries: [] as Array<{ key: string, value: string, origin: string }>,
    needsProject: false,
    setVar: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/features/env-vars/hooks/useEnvVars', () => ({ useEnvVars: () => mocks.env }))
vi.mock('@/shared/hooks/useSelectProject', () => ({ useSelectProject: () => vi.fn() }))
vi.mock('@/i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  mocks.store.configScope = 'global'
  mocks.store.currentProject = null
  mocks.env.needsProject = false
})

describe('envVars page', () => {
  it('renders ScopeSwitcher', async () => {
    const { EnvVars } = await import('./EnvVars')
    render(<EnvVars />)
    expect(screen.getByText('scope.label')).toBeTruthy()
  })

  it('shows guard when needsProject', async () => {
    mocks.store.configScope = 'project'
    mocks.env.needsProject = true
    const { EnvVars } = await import('./EnvVars')
    render(<EnvVars />)
    expect(screen.queryByText('envvars.header.name')).toBeFalsy()
  })
})
