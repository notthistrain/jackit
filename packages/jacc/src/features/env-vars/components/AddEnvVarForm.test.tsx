import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddEnvVarForm } from './AddEnvVarForm'

describe('addEnvVarForm', () => {
  const mockT = (key: string) => key

  it('does not render when visible is false', () => {
    const { container } = render(
      <AddEnvVarForm
        visible={false}
        values={{ key: '', value: '' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )

    expect(container.firstChild).toBeFalsy()
  })

  it('renders form when visible is true', () => {
    render(
      <AddEnvVarForm
        visible={true}
        values={{ key: '', value: '' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )

    expect(screen.getByText('envvars.add.name')).toBeTruthy()
    expect(screen.getByText('envvars.add.value')).toBeTruthy()
    expect(screen.getByText('envvars.add.submit')).toBeTruthy()
    expect(screen.getByText('envvars.add.cancel')).toBeTruthy()
  })

  it('displays current values in inputs', () => {
    render(
      <AddEnvVarForm
        visible={true}
        values={{ key: 'MY_KEY', value: 'my_value' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )

    expect(screen.getByDisplayValue('MY_KEY')).toBeTruthy()
    expect(screen.getByDisplayValue('my_value')).toBeTruthy()
  })

  it('calls onChange when key input changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <AddEnvVarForm
        visible={true}
        values={{ key: '', value: '' }}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )

    const keyInput = screen.getByPlaceholderText('MY_VAR')
    await user.type(keyInput, 'K')

    expect(onChange).toHaveBeenCalledWith({ key: 'K', value: '' })
  })

  it('calls onChange when value input changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <AddEnvVarForm
        visible={true}
        values={{ key: 'KEY', value: '' }}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )

    const valueInput = screen.getByPlaceholderText('value')
    await user.type(valueInput, 'v')

    expect(onChange).toHaveBeenCalledWith({ key: 'KEY', value: 'v' })
  })

  it('calls onSubmit when submit button clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <AddEnvVarForm
        visible={true}
        values={{ key: 'KEY', value: 'value' }}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        t={mockT}
      />,
    )

    await user.click(screen.getByText('envvars.add.submit'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <AddEnvVarForm
        visible={true}
        values={{ key: 'KEY', value: 'value' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        t={mockT}
      />,
    )

    await user.click(screen.getByText('envvars.add.cancel'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
