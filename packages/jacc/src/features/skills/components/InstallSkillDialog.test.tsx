import type { GithubInstallResult } from '../api/skills-api'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InstallSkillDialog } from './InstallSkillDialog'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const fetchResult: GithubInstallResult = {
  token: 'tok-1',
  skills: [
    { name: 'skill-a', description: 'desc a', enabled: false, source: 'project' },
    { name: 'skill-b', description: 'desc b', enabled: false, source: 'project' },
  ],
}

describe('installSkillDialog', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <InstallSkillDialog open={false} onClose={vi.fn()} onFetch={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders repo input when open', () => {
    render(<InstallSkillDialog open onClose={vi.fn()} onFetch={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText('skills.install.title')).toBeTruthy()
    expect(screen.getByPlaceholderText('skills.install.repoPlaceholder')).toBeTruthy()
  })

  it('calls onFetch and shows skill list', async () => {
    const onFetch = vi.fn().mockResolvedValue(fetchResult)
    render(<InstallSkillDialog open onClose={vi.fn()} onFetch={onFetch} onConfirm={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('skills.install.repoPlaceholder'), 'http://repo')
    await userEvent.click(screen.getByText('skills.install.fetch'))
    expect(onFetch).toHaveBeenCalledWith('http://repo')
    expect(await screen.findByText('skill-a')).toBeTruthy()
  })

  it('selects skills and calls onConfirm', async () => {
    const onFetch = vi.fn().mockResolvedValue(fetchResult)
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<InstallSkillDialog open onClose={vi.fn()} onFetch={onFetch} onConfirm={onConfirm} />)
    await userEvent.type(screen.getByPlaceholderText('skills.install.repoPlaceholder'), 'http://repo')
    await userEvent.click(screen.getByText('skills.install.fetch'))
    await screen.findByText('skill-a')
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(screen.getByText('skills.install.install'))
    expect(onConfirm).toHaveBeenCalledWith('tok-1', ['skill-a'])
  })
})
