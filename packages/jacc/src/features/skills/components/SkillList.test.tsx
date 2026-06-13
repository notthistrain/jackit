import type { SkillInfo } from '../api/skills-api'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SkillList } from './SkillList'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('@/shared/components/ui/SourceBadge', () => ({
  SourceBadge: ({ scope }: { scope: string }) => <span>{scope}</span>,
}))

vi.mock('@/shared/components/ui/Fab', () => ({
  Fab: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>fab</button>,
}))

vi.mock('./InstallSkillDialog', () => ({
  InstallSkillDialog: () => null,
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

const skills: SkillInfo[] = [
  { name: 'alpha', description: 'first skill', enabled: true, source: 'project' },
  { name: 'beta', description: 'second skill', enabled: true, source: 'project' },
  { name: 'gamma', description: 'third skill', enabled: false, source: 'project' },
]

const noop = vi.fn().mockResolvedValue(undefined)

function renderList(props = {}) {
  return render(
    <SkillList
      skills={skills}
      loading={false}
      onToggle={noop}
      onImport={noop}
      onInstallFromGithub={vi.fn().mockResolvedValue({ token: '', skills: [] })}
      onConfirmInstall={noop}
      {...props}
    />,
  )
}

describe('skillList', () => {
  it('shows loading text', () => {
    renderList({ loading: true })
    expect(screen.getByText('common.loading')).toBeTruthy()
  })

  it('renders enabled skills by default', () => {
    renderList()
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
    expect(screen.queryByText('gamma')).toBeNull()
  })

  it('switches to disabled tab', async () => {
    renderList()
    await userEvent.click(screen.getByText(/skills.tab.disabled/))
    expect(screen.getByText('gamma')).toBeTruthy()
    expect(screen.queryByText('alpha')).toBeNull()
  })

  it('filters by search', async () => {
    renderList()
    await userEvent.type(screen.getByPlaceholderText('skills.search'), 'beta')
    expect(screen.getByText('beta')).toBeTruthy()
    expect(screen.queryByText('alpha')).toBeNull()
  })
})
