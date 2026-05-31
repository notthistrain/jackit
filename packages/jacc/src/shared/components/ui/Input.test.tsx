import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('renders with value', () => {
    render(<Input value="test" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('test')).toBeTruthy()
  })

  it('calls onChange when typing', async () => {
    const onChange = vi.fn()
    render(<Input value="" onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'hello')
    expect(onChange).toHaveBeenCalledTimes(5)
  })

  it('renders label', () => {
    render(<Input value="" onChange={vi.fn()} label="Username" />)
    expect(screen.getByText('Username')).toBeTruthy()
  })

  it('renders error message', () => {
    render(<Input value="" onChange={vi.fn()} error="Required field" />)
    expect(screen.getByText('Required field')).toBeTruthy()
  })

  it('disables input when disabled prop is true', () => {
    render(<Input value="" onChange={vi.fn()} disabled />)
    const input = screen.getByRole('textbox')
    expect(input.hasAttribute('disabled')).toBe(true)
  })

  it('applies error styles when error is present', () => {
    render(<Input value="" onChange={vi.fn()} error="Error" />)
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('border-danger')
  })
})
