import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToggleRow } from './ToggleRow'

describe('toggleRow', () => {
  it('renders label and description', () => {
    render(
      <ToggleRow
        label="Skip Dangerous"
        description="Skip dangerous mode prompt"
        checked={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('Skip Dangerous')).toBeTruthy()
    expect(screen.getByText('Skip dangerous mode prompt')).toBeTruthy()
  })

  it('renders badge when provided', () => {
    render(
      <ToggleRow
        label="L"
        description="D"
        checked={false}
        onToggle={vi.fn()}
        badge={<span data-testid="badge">B</span>}
      />,
    )
    expect(screen.getByTestId('badge')).toBeTruthy()
  })

  it('does not render badge when not provided', () => {
    render(
      <ToggleRow
        label="L"
        description="D"
        checked={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('badge')).toBeNull()
  })

  it('reflects checked=true visually', () => {
    const { container } = render(
      <ToggleRow label="L" description="D" checked={true} onToggle={vi.fn()} />,
    )
    expect(container.querySelector('.bg-primary')).toBeTruthy()
  })

  it('reflects checked=false visually', () => {
    const { container } = render(
      <ToggleRow label="L" description="D" checked={false} onToggle={vi.fn()} />,
    )
    expect(container.querySelector('.bg-border')).toBeTruthy()
  })

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(
      <ToggleRow label="L" description="D" checked={false} onToggle={onToggle} />,
    )
    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
