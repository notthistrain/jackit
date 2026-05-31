import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'

vi.mock('@/hooks/usePreferences', () => ({
  usePreferences: () => ({
    set: vi.fn(),
  }),
}))

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores/useAppStore', () => ({
  useAppStore: () => ({
    currentPage: 'models',
    setPage: vi.fn(),
    theme: 'dark',
    setTheme: vi.fn(),
  }),
}))

vi.mock('@/components/ProjectSwitcher', () => ({
  ProjectSwitcher: () => <div>ProjectSwitcher</div>,
}))

describe('sidebar', () => {
  it('renders navigation sections', () => {
    render(<Sidebar />)
    expect(screen.getByText('sidebar.config')).toBeTruthy()
    expect(screen.getByText('sidebar.extensions')).toBeTruthy()
  })

  it('renders navigation items', () => {
    render(<Sidebar />)
    expect(screen.getByText('sidebar.models')).toBeTruthy()
    expect(screen.getByText('sidebar.skills')).toBeTruthy()
  })
})
