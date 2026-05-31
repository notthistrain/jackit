import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectSwitcher } from './ProjectSwitcher'

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [],
    add: vi.fn(),
    open: vi.fn(),
    pin: vi.fn(),
  }),
}))

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores/useAppStore', () => ({
  useAppStore: () => ({
    currentProject: null,
    setProject: vi.fn(),
  }),
}))

describe('projectSwitcher', () => {
  it('renders trigger button', () => {
    render(<ProjectSwitcher />)
    expect(screen.getByText('project.current')).toBeTruthy()
    expect(screen.getByText('project.none')).toBeTruthy()
  })
})
