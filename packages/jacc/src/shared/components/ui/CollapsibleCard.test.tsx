import { fireEvent, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CollapsibleCard } from './CollapsibleCard'

describe('CollapsibleCard', () => {
  it('renders header', () => {
    render(
      <CollapsibleCard expanded={false} onToggle={vi.fn()} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    expect(screen.getByText('Header')).toBeTruthy()
  })

  it('shows content when expanded', () => {
    render(
      <CollapsibleCard expanded={true} onToggle={vi.fn()} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    expect(screen.getByText('Content')).toBeTruthy()
  })

  it('hides content when collapsed', () => {
    render(
      <CollapsibleCard expanded={false} onToggle={vi.fn()} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    expect(screen.queryByText('Content')).toBeNull()
  })

  it('calls onToggle when header clicked', async () => {
    const onToggle = vi.fn()
    render(
      <CollapsibleCard expanded={false} onToggle={onToggle} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    await userEvent.click(screen.getByText('Header'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('does not call onToggle when headerRight clicked', async () => {
    const onToggle = vi.fn()
    render(
      <CollapsibleCard
        expanded={false}
        onToggle={onToggle}
        header={<div>Header</div>}
        headerRight={<button>Action</button>}
      >
        Content
      </CollapsibleCard>
    )
    await userEvent.click(screen.getByText('Action'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('shows ChevronDown when expanded', () => {
    const { container } = render(
      <CollapsibleCard expanded={true} onToggle={vi.fn()} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
