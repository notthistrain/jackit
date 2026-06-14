import type { EnvVarMeta } from '../api/env-catalog'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddEnvVarForm } from './AddEnvVarForm'

vi.mock('@/i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))

describe('addEnvVarForm', () => {
  const mockT = (key: string) => key
  const emptyValues = { meta: null, value: '' }
  const sampleMeta: EnvVarMeta = { name: 'MY_KEY', group: 'feature', type: 'string', sensitive: false, description: '' }

  it('does not render when visible is false', () => {
    const { container } = render(
      <AddEnvVarForm visible={false} values={emptyValues} onChange={vi.fn()} onSubmit={vi.fn()} onCancel={vi.fn()} t={mockT} />,
    )
    expect(container.firstChild).toBeFalsy()
  })

  it('renders form when visible is true', () => {
    render(
      <AddEnvVarForm visible={true} values={emptyValues} onChange={vi.fn()} onSubmit={vi.fn()} onCancel={vi.fn()} t={mockT} />,
    )
    expect(screen.getByText('envvars.add.name')).toBeTruthy()
    expect(screen.getByText('envvars.add.value')).toBeTruthy()
    expect(screen.getByText('envvars.add.submit')).toBeTruthy()
    expect(screen.getByText('envvars.add.cancel')).toBeTruthy()
  })

  it('displays current meta name and value', () => {
    render(
      <AddEnvVarForm visible={true} values={{ meta: sampleMeta, value: 'my_value' }} onChange={vi.fn()} onSubmit={vi.fn()} onCancel={vi.fn()} t={mockT} />,
    )
    expect(screen.getByDisplayValue('MY_KEY')).toBeTruthy()
    expect(screen.getByDisplayValue('my_value')).toBeTruthy()
  })

  it('value input change calls onChange with value', () => {
    const onChange = vi.fn()
    render(
      <AddEnvVarForm visible={true} values={{ meta: sampleMeta, value: '' }} onChange={onChange} onSubmit={vi.fn()} onCancel={vi.fn()} t={mockT} />,
    )
    const valueInput = screen.getByDisplayValue('')
    fireEvent.change(valueInput, { target: { value: 'v' } })
    expect(onChange).toHaveBeenCalledWith({ meta: sampleMeta, value: 'v' })
  })

  it('calls onSubmit when submit button clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <AddEnvVarForm visible={true} values={{ meta: sampleMeta, value: 'value' }} onChange={vi.fn()} onSubmit={onSubmit} onCancel={vi.fn()} t={mockT} />,
    )
    await user.click(screen.getByText('envvars.add.submit'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <AddEnvVarForm visible={true} values={emptyValues} onChange={vi.fn()} onSubmit={vi.fn()} onCancel={onCancel} t={mockT} />,
    )
    await user.click(screen.getByText('envvars.add.cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
