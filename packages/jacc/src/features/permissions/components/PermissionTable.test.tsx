import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PermissionTable } from './PermissionTable'

vi.mock('@/shared/components/ui/SourceBadge', () => ({
  SourceBadge: ({ scope }: { scope: string }) => <span data-testid="source-badge">{scope}</span>,
}))

describe('permissionTable', () => {
  const headers = {
    type: 'Type',
    tool: 'Tool',
    pattern: 'Pattern',
    source: 'Source',
  }

  it('renders headers', () => {
    render(
      <PermissionTable
        kind="allow"
        title="Allow List"
        rules={[]}
        scope="global"
        emptyText="No rules"
        badgeText="Allow"
        iconText="✓"
        headers={headers}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Type')).toBeTruthy()
    expect(screen.getByText('Tool')).toBeTruthy()
    expect(screen.getByText('Pattern')).toBeTruthy()
    expect(screen.getByText('Source')).toBeTruthy()
  })

  it('renders rules with tool, pattern, and badge', () => {
    const rules = [
      { tool: 'Bash', pattern: 'ls -la' },
      { tool: 'Read', pattern: '*.txt' },
    ]
    render(
      <PermissionTable
        kind="allow"
        title="Allow List"
        rules={rules}
        scope="project"
        emptyText="No rules"
        badgeText="Allow"
        iconText="✓"
        headers={headers}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Bash')).toBeTruthy()
    expect(screen.getByText('ls -la')).toBeTruthy()
    expect(screen.getByText('Read')).toBeTruthy()
    expect(screen.getByText('*.txt')).toBeTruthy()
    expect(screen.getAllByText('Allow')).toHaveLength(2)
  })

  it('displays empty text when no rules', () => {
    render(
      <PermissionTable
        kind="deny"
        title="Deny List"
        rules={[]}
        scope="global"
        emptyText="No deny rules"
        badgeText="Deny"
        iconText="✗"
        headers={headers}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('No deny rules')).toBeTruthy()
  })

  it('calls onDelete with correct index when delete button clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const rules = [
      { tool: 'Bash', pattern: 'rm' },
      { tool: 'Write', pattern: '*.log' },
    ]
    render(
      <PermissionTable
        kind="deny"
        title="Deny List"
        rules={rules}
        scope="global"
        emptyText="No rules"
        badgeText="Deny"
        iconText="✗"
        headers={headers}
        onDelete={onDelete}
      />,
    )
    const deleteButtons = screen.getAllByRole('button', { name: '×' })
    await user.click(deleteButtons[1])
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('applies allow kind styles', () => {
    const { container } = render(
      <PermissionTable
        kind="allow"
        title="Allow List"
        rules={[{ tool: 'Bash', pattern: 'ls' }]}
        scope="global"
        emptyText="No rules"
        badgeText="Allow"
        iconText="✓"
        headers={headers}
        onDelete={vi.fn()}
      />,
    )
    const titleElement = container.querySelector('.text-success')
    expect(titleElement).toBeTruthy()
    const badgeElement = container.querySelector('.bg-success-light.text-success')
    expect(badgeElement).toBeTruthy()
  })

  it('applies deny kind styles', () => {
    const { container } = render(
      <PermissionTable
        kind="deny"
        title="Deny List"
        rules={[{ tool: 'Bash', pattern: 'rm' }]}
        scope="global"
        emptyText="No rules"
        badgeText="Deny"
        iconText="✗"
        headers={headers}
        onDelete={vi.fn()}
      />,
    )
    const titleElement = container.querySelector('.text-danger')
    expect(titleElement).toBeTruthy()
    const badgeElement = container.querySelector('.bg-danger-light.text-danger')
    expect(badgeElement).toBeTruthy()
  })

  it('renders SourceBadge with correct scope', () => {
    render(
      <PermissionTable
        kind="allow"
        title="Allow List"
        rules={[{ tool: 'Bash', pattern: 'ls' }]}
        scope="project"
        emptyText="No rules"
        badgeText="Allow"
        iconText="✓"
        headers={headers}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByTestId('source-badge').textContent).toBe('project')
  })
})
