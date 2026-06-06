import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'

const setProject = vi.fn()
const addProject = vi.fn()
const openProject = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))

const storeState = { currentPage: 'general' as string, currentProject: null as string | null, setProject }
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => storeState }))

vi.mock('@/shared/hooks/useProjects', () => ({
  useProjects: () => ({ add: addProject, open: openProject }),
}))

vi.mock('@/shared/components/layout/Sidebar', () => ({ Sidebar: () => <div>SIDEBAR</div> }))
vi.mock('@/shared/components/layout/TitleBar', () => ({ TitleBar: () => <div>TITLEBAR</div> }))
vi.mock('@/shared/components/ui/EmptyState', () => ({
  EmptyState: () => <div>EMPTY_STATE</div>,
}))

vi.mock('@/pages/General', () => ({ General: () => <div>GENERAL_PAGE</div> }))
vi.mock('@/pages/EnvVars', () => ({ EnvVars: () => <div>ENVVARS_PAGE</div> }))
vi.mock('@/pages/Permissions', () => ({ Permissions: () => <div>PERMISSIONS_PAGE</div> }))
vi.mock('@/pages/McpServers', () => ({ McpServers: () => <div>MCP_PAGE</div> }))
vi.mock('@/pages/Models', () => ({ Models: () => <div>MODELS_PAGE</div> }))
vi.mock('@/pages/Skills', () => ({ Skills: () => <div>SKILLS_PAGE</div> }))
vi.mock('@/pages/Agents', () => ({ Agents: () => <div>AGENTS_PAGE</div> }))

describe('layout', () => {
  it('renders title bar and sidebar', () => {
    storeState.currentPage = 'general'
    storeState.currentProject = null
    render(<Layout />)
    expect(screen.getByText('TITLEBAR')).toBeTruthy()
    expect(screen.getByText('SIDEBAR')).toBeTruthy()
    expect(screen.getByText('GENERAL_PAGE')).toBeTruthy()
  })

  it('renders Models page when currentPage is models', () => {
    storeState.currentPage = 'models'
    storeState.currentProject = null
    render(<Layout />)
    expect(screen.getByText('MODELS_PAGE')).toBeTruthy()
  })

  it('renders EmptyState when skills page lacks current project', () => {
    storeState.currentPage = 'skills'
    storeState.currentProject = null
    render(<Layout />)
    expect(screen.getByText('EMPTY_STATE')).toBeTruthy()
    expect(screen.queryByText('SKILLS_PAGE')).toBeNull()
  })

  it('renders Skills page when project is selected', () => {
    storeState.currentPage = 'skills'
    storeState.currentProject = '/path/proj'
    render(<Layout />)
    expect(screen.getByText('SKILLS_PAGE')).toBeTruthy()
  })

  it('renders EmptyState when agents page lacks current project', () => {
    storeState.currentPage = 'agents'
    storeState.currentProject = null
    render(<Layout />)
    expect(screen.getByText('EMPTY_STATE')).toBeTruthy()
  })
})
