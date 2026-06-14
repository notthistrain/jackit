import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null, setConfigScope: vi.fn() },
  mcp: {
    servers: { a: { command: 'testcmd' } } as Record<string, any>,
    origin: 'global' as const,
    save: vi.fn(),
    remove: vi.fn(),
    add: vi.fn(),
  },
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/features/mcp-servers/hooks/useMcpServers', () => ({ useMcpServers: () => mocks.mcp }))
vi.mock('@/shared/hooks/useSelectProject', () => ({ useSelectProject: () => vi.fn() }))
vi.mock('@/i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  mocks.store.configScope = 'global'
  mocks.store.currentProject = null
})

describe('mcpServers page', () => {
  it('renders ScopeSwitcher', async () => {
    const { McpServers } = await import('./McpServers')
    render(<McpServers />)
    expect(screen.getByText('scope.label')).toBeTruthy()
  })

  it('shows guard when project scope without project', async () => {
    mocks.store.configScope = 'project'
    const { McpServers } = await import('./McpServers')
    render(<McpServers />)
    expect(screen.queryByText('testcmd')).toBeFalsy()
  })
})
