import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddPermissionForm } from './AddPermissionForm'

describe('addPermissionForm', () => {
  const mockT = (key: string) => key
  const defaultValues = {
    type: 'allow' as const,
    tool: 'Bash',
    pattern: '',
  }

  it('does not render when visible is false', () => {
    const { container } = render(
      <AddPermissionForm
        visible={false}
        values={defaultValues}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders form when visible is true', () => {
    render(
      <AddPermissionForm
        visible={true}
        values={defaultValues}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    expect(screen.getByText('permissions.add.title')).toBeTruthy()
    expect(screen.getByPlaceholderText('permissions.add.pattern')).toBeTruthy()
    expect(screen.getByText('permissions.add.submit')).toBeTruthy()
    expect(screen.getByText('permissions.add.cancel')).toBeTruthy()
  })

  it('calls onChange when type select changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <AddPermissionForm
        visible={true}
        values={defaultValues}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    const typeSelect = screen.getByDisplayValue('Allow')
    await user.selectOptions(typeSelect, 'deny')
    expect(onChange).toHaveBeenCalledWith({ ...defaultValues, type: 'deny' })
  })

  it('calls onChange when tool select changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <AddPermissionForm
        visible={true}
        values={defaultValues}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    const toolSelect = screen.getByDisplayValue('Bash')
    await user.selectOptions(toolSelect, 'Read')
    expect(onChange).toHaveBeenCalledWith({ ...defaultValues, tool: 'Read' })
  })

  it('calls onChange when pattern input changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <AddPermissionForm
        visible={true}
        values={defaultValues}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    const patternInput = screen.getByPlaceholderText('permissions.add.pattern')
    await user.type(patternInput, 'ls')
    expect(onChange).toHaveBeenCalledWith({ ...defaultValues, pattern: 'l' })
    expect(onChange).toHaveBeenCalledWith({ ...defaultValues, pattern: 's' })
  })

  it('calls onSubmit when submit button clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <AddPermissionForm
        visible={true}
        values={defaultValues}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    await user.click(screen.getByText('permissions.add.submit'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <AddPermissionForm
        visible={true}
        values={defaultValues}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        t={mockT}
      />,
    )
    await user.click(screen.getByText('permissions.add.cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders all tool options', () => {
    render(
      <AddPermissionForm
        visible={true}
        values={defaultValues}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    const toolSelect = screen.getByDisplayValue('Bash')
    expect(toolSelect.textContent).toContain('Bash')
    expect(toolSelect.textContent).toContain('Read')
    expect(toolSelect.textContent).toContain('Write')
    expect(toolSelect.textContent).toContain('Edit')
  })
})
