import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './EmptyState'

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

describe('emptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState onSelectProject={vi.fn()} />)
    expect(screen.getByText('empty.title')).toBeTruthy()
    expect(screen.getByText('empty.desc')).toBeTruthy()
  })

  it('renders select button', () => {
    render(<EmptyState onSelectProject={vi.fn()} />)
    expect(screen.getByText('empty.select')).toBeTruthy()
  })

  it('calls onSelectProject when button clicked', async () => {
    const onSelectProject = vi.fn()
    render(<EmptyState onSelectProject={onSelectProject} />)
    const button = screen.getByText('empty.select')
    await userEvent.click(button)
    expect(onSelectProject).toHaveBeenCalledTimes(1)
  })
})
