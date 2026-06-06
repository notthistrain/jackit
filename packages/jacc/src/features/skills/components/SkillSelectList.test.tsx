import type { SkillInfo } from '../api/skills-api'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SkillSelectList } from './SkillSelectList'

const skills: SkillInfo[] = [
  { name: 'skill-a', description: 'desc a', enabled: false, source: 'project' },
  { name: 'skill-b', description: 'desc b', enabled: false, source: 'project' },
]

describe('skillSelectList', () => {
  it('renders all skills', () => {
    render(<SkillSelectList skills={skills} selected={new Set()} onToggle={vi.fn()} />)
    expect(screen.getByText('skill-a')).toBeTruthy()
    expect(screen.getByText('skill-b')).toBeTruthy()
    expect(screen.getByText('desc a')).toBeTruthy()
  })

  it('calls onToggle when checkbox clicked', async () => {
    const onToggle = vi.fn()
    render(<SkillSelectList skills={skills} selected={new Set()} onToggle={onToggle} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    expect(onToggle).toHaveBeenCalledWith('skill-a')
  })

  it('reflects selected state on checkbox', () => {
    render(<SkillSelectList skills={skills} selected={new Set(['skill-b'])} onToggle={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(false)
    expect(checkboxes[1].checked).toBe(true)
  })
})
