import type { SkillInfo } from '../api/skills-api'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SkillListItem } from './SkillListItem'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('@/shared/components/ui/SourceBadge', () => ({
  SourceBadge: ({ scope }: { scope: string }) => <span>{scope}</span>,
}))

const projectSkill: SkillInfo = {
  name: 'skill-a',
  description: 'desc a',
  enabled: true,
  source: 'project',
}

describe('skillListItem', () => {
  it('renders skill info', () => {
    render(<SkillListItem skill={projectSkill} toggling={false} onToggle={vi.fn()} />)
    expect(screen.getByText('skill-a')).toBeTruthy()
    expect(screen.getByText('desc a')).toBeTruthy()
    expect(screen.getByText('project')).toBeTruthy()
  })

  it('calls onToggle when switch clicked', async () => {
    const onToggle = vi.fn()
    render(<SkillListItem skill={projectSkill} toggling={false} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledWith('skill-a', false)
  })

  it('shows readonly text and no switch for user source', () => {
    const userSkill: SkillInfo = { ...projectSkill, source: 'user' }
    render(<SkillListItem skill={userSkill} toggling={false} onToggle={vi.fn()} />)
    expect(screen.getByText('skills.readonly')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
