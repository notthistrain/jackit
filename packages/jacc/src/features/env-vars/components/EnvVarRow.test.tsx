import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EnvVarRow } from './EnvVarRow'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

describe('envVarRow', () => {
  const mockT = (key: string) => key

  it('renders regular row with editable input', () => {
    render(
      <EnvVarRow envKey="MY_VAR" value="test-value" origin="global" t={mockT} />,
    )
    expect(screen.getByText('MY_VAR')).toBeTruthy()
    expect(screen.getByDisplayValue('test-value')).toBeTruthy()
  })

  it('calls onCommit when value changes', () => {
    const onCommit = vi.fn()
    render(
      <EnvVarRow envKey="MY_VAR" value="test" origin="global" onCommit={onCommit} t={mockT} />,
    )
    const input = screen.getByDisplayValue('test')
    fireEvent.change(input, { target: { value: 'new-value' } })
    expect(onCommit).toHaveBeenCalledWith('MY_VAR', 'new-value')
  })

  it('calls onDelete with key and origin', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <EnvVarRow envKey="MY_VAR" value="test" origin="global" onDelete={onDelete} t={mockT} />,
    )
    await user.click(screen.getByRole('button', { name: '×' }))
    expect(onDelete).toHaveBeenCalledWith('MY_VAR', 'global')
  })

  it('renders readonly row with managed hint', () => {
    render(
      <EnvVarRow envKey="ANTHROPIC_MODEL" value="opus" origin="models" readOnly t={mockT} />,
    )
    expect(screen.getByText('ANTHROPIC_MODEL')).toBeTruthy()
    expect(screen.getByText(/managedByModels/)).toBeTruthy()
    expect(screen.queryByDisplayValue('opus')).toBeFalsy()
  })

  it('does not render delete button for readonly row', () => {
    render(
      <EnvVarRow envKey="ANTHROPIC_MODEL" value="opus" origin="models" readOnly t={mockT} />,
    )
    expect(screen.queryByRole('button', { name: '×' })).toBeFalsy()
  })

  it('renders slot-managed row greyed with masked value and no delete', () => {
    render(
      <EnvVarRow envKey="ANTHROPIC_AUTH_TOKEN" value="sk-x" origin="local" slotManaged t={mockT} />,
    )
    expect(screen.getByText(/••••/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByDisplayValue('sk-x')).toBeNull()
  })
})
