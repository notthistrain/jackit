import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddMcpServerForm } from './AddMcpServerForm'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const mockT = (key: string) => key

describe('addMcpServerForm', () => {
  const defaultValues = { name: '', command: '', args: '' }

  it('does not render when visible is false', () => {
    const { container } = render(
      <AddMcpServerForm
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

  it('renders title and inputs when visible is true', () => {
    render(
      <AddMcpServerForm
        visible={true}
        values={defaultValues}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    expect(screen.getByText('mcp.add.title')).toBeTruthy()
    expect(screen.getByPlaceholderText('mcp.add.name')).toBeTruthy()
    expect(screen.getByPlaceholderText('mcp.add.command')).toBeTruthy()
    expect(screen.getByPlaceholderText('mcp.add.args')).toBeTruthy()
  })

  it('calls onChange when name input is changed', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AddMcpServerForm
        visible={true}
        values={defaultValues}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    const nameInput = screen.getByPlaceholderText('mcp.add.name')
    await user.type(nameInput, 'x')
    expect(onChange).toHaveBeenLastCalledWith({ name: 'x', command: '', args: '' })
  })

  it('calls onChange when command input is changed', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AddMcpServerForm
        visible={true}
        values={defaultValues}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    const commandInput = screen.getByPlaceholderText('mcp.add.command')
    await user.type(commandInput, 'x')
    expect(onChange).toHaveBeenLastCalledWith({ name: '', command: 'x', args: '' })
  })

  it('calls onChange when args input is changed', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AddMcpServerForm
        visible={true}
        values={defaultValues}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    const argsInput = screen.getByPlaceholderText('mcp.add.args')
    await user.type(argsInput, 'x')
    expect(onChange).toHaveBeenLastCalledWith({ name: '', command: '', args: 'x' })
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <AddMcpServerForm
        visible={true}
        values={defaultValues}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        t={mockT}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'mcp.add.cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onSubmit when submit button is clicked', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <AddMcpServerForm
        visible={true}
        values={defaultValues}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'mcp.add.submit' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('displays provided values in inputs', () => {
    const values = { name: 'my-server', command: 'python', args: 'app.py' }
    render(
      <AddMcpServerForm
        visible={true}
        values={values}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )
    expect(screen.getByDisplayValue('my-server')).toBeTruthy()
    expect(screen.getByDisplayValue('python')).toBeTruthy()
    expect(screen.getByDisplayValue('app.py')).toBeTruthy()
  })
})
