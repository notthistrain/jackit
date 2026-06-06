import { render, screen } from '@testing-library/react'
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
      <EnvVarRow
        envKey="MY_VAR"
        value="test-value"
        scope="global"
        t={mockT}
      />,
    )

    expect(screen.getByText('MY_VAR')).toBeTruthy()
    expect(screen.getByDisplayValue('test-value')).toBeTruthy()
  })

  it('calls onLocalChange when input changes', async () => {
    const user = userEvent.setup()
    const onLocalChange = vi.fn()

    render(
      <EnvVarRow
        envKey="MY_VAR"
        value="test"
        scope="global"
        onLocalChange={onLocalChange}
        t={mockT}
      />,
    )

    const input = screen.getByDisplayValue('test')
    await user.clear(input)
    await user.type(input, 'new-value')

    expect(onLocalChange).toHaveBeenCalledWith('MY_VAR', 'new-value')
  })

  it('calls onBlur when input loses focus', async () => {
    const user = userEvent.setup()
    const onBlur = vi.fn()

    render(
      <EnvVarRow
        envKey="MY_VAR"
        value="test"
        scope="global"
        onBlur={onBlur}
        t={mockT}
      />,
    )

    const input = screen.getByDisplayValue('test')
    await user.click(input)
    await user.tab()

    expect(onBlur).toHaveBeenCalledWith('MY_VAR')
  })

  it('calls onDelete when delete button clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()

    render(
      <EnvVarRow
        envKey="MY_VAR"
        value="test"
        scope="global"
        onDelete={onDelete}
        t={mockT}
      />,
    )

    await user.click(screen.getByRole('button', { name: '×' }))

    expect(onDelete).toHaveBeenCalledWith('MY_VAR')
  })

  it('renders readonly row with managed hint', () => {
    render(
      <EnvVarRow
        envKey="ANTHROPIC_MODEL"
        value="opus"
        scope="models"
        readOnly
        t={mockT}
      />,
    )

    expect(screen.getByText('ANTHROPIC_MODEL')).toBeTruthy()
    expect(screen.getByText('envvars.managedByModels')).toBeTruthy()
    expect(screen.queryByDisplayValue('opus')).toBeFalsy()
  })

  it('does not render delete button for readonly row', () => {
    render(
      <EnvVarRow
        envKey="ANTHROPIC_MODEL"
        value="opus"
        scope="models"
        readOnly
        t={mockT}
      />,
    )

    expect(screen.queryByRole('button', { name: '×' })).toBeFalsy()
  })

  it('applies muted text style for readonly row', () => {
    const { container } = render(
      <EnvVarRow
        envKey="ANTHROPIC_MODEL"
        value="opus"
        scope="models"
        readOnly
        t={mockT}
      />,
    )

    const nameDiv = screen.getByText('ANTHROPIC_MODEL')
    expect(nameDiv.className).toContain('text-muted')
    expect(container.firstChild).toBeTruthy()
    const rootDiv = container.firstChild as HTMLElement
    expect(rootDiv.className).toContain('opacity-50')
  })
})
