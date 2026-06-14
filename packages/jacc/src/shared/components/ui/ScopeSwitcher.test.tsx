import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { ScopeSwitcher } from './ScopeSwitcher'

describe('scopeSwitcher', () => {
  it('renders both options with a scope label', () => {
    render(<ScopeSwitcher value="global" onChange={vi.fn()} />)
    expect(screen.getByText('scope.label')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'source.global' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'source.project' })).toBeTruthy()
  })

  it('marks active option with aria-pressed', () => {
    render(<ScopeSwitcher value="project" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'source.project' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'source.global' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onChange when clicking inactive option', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScopeSwitcher value="global" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'source.project' }))
    expect(onChange).toHaveBeenCalledWith('project')
  })
})
