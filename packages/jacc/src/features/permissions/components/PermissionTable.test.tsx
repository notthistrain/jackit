import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PermissionTable } from './PermissionTable'

vi.mock('@/shared/components/ui/SourceBadge', () => ({
  SourceBadge: ({ scope }: { scope: string }) => <span data-testid="source-badge">{scope}</span>,
}))

describe('permissionTable', () => {
  const mockT = (key: string) => key

  it('renders headers', () => {
    render(
      <PermissionTable
        kind="allow"
        rules={[]}
        scope="global"
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    expect(screen.getByText('permissions.header.type')).toBeTruthy()
    expect(screen.getByText('permissions.header.tool')).toBeTruthy()
    expect(screen.getByText('permissions.header.pattern')).toBeTruthy()
    expect(screen.getByText('permissions.header.source')).toBeTruthy()
  })

  it('renders rules with tool, pattern, and badge', () => {
    const rules = [
      { tool: 'Bash', pattern: 'ls -la' },
      { tool: 'Read', pattern: '*.txt' },
    ]
    render(
      <PermissionTable
        kind="allow"
        rules={rules}
        scope="project"
        onDelete={vi.fn()}
        t={mockT}
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
        rules={[]}
        scope="global"
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    expect(screen.getByText('permissions.noDeny')).toBeTruthy()
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
        rules={rules}
        scope="global"
        onDelete={onDelete}
        t={mockT}
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
        rules={[{ tool: 'Bash', pattern: 'ls' }]}
        scope="global"
        onDelete={vi.fn()}
        t={mockT}
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
        rules={[{ tool: 'Bash', pattern: 'rm' }]}
        scope="global"
        onDelete={vi.fn()}
        t={mockT}
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
        rules={[{ tool: 'Bash', pattern: 'ls' }]}
        scope="project"
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    expect(screen.getByTestId('source-badge').textContent).toBe('project')
  })
})
