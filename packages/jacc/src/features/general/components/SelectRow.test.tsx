import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SelectRow } from './SelectRow'

describe('selectRow', () => {
  const opts = [
    { value: 'low', label: 'low' },
    { value: 'high', label: 'high' },
  ]

  it('renders label and description', () => {
    render(
      <SelectRow
        label="Effort Level"
        description="Effort level desc"
        value="high"
        options={opts}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Effort Level')).toBeTruthy()
    expect(screen.getByText('Effort level desc')).toBeTruthy()
  })

  it('renders all options', () => {
    render(
      <SelectRow label="L" description="D" value="low" options={opts} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('option', { name: 'low' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'high' })).toBeTruthy()
  })

  it('selects current value', () => {
    render(
      <SelectRow label="L" description="D" value="high" options={opts} onChange={vi.fn()} />,
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('high')
  })

  it('calls onChange when value changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SelectRow label="L" description="D" value="low" options={opts} onChange={onChange} />,
    )
    await user.selectOptions(screen.getByRole('combobox'), 'high')
    expect(onChange).toHaveBeenCalledWith('high')
  })

  it('renders badge when provided', () => {
    render(
      <SelectRow
        label="L"
        description="D"
        value="low"
        options={opts}
        onChange={vi.fn()}
        badge={<span data-testid="badge">B</span>}
      />,
    )
    expect(screen.getByTestId('badge')).toBeTruthy()
  })
})
