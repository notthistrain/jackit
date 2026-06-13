import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Fab } from './Fab'

describe('fab', () => {
  it('renders button', () => {
    const { container } = render(<Fab onClick={vi.fn()} />)
    const button = container.querySelector('button')
    expect(button).toBeTruthy()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const { container } = render(<Fab onClick={onClick} />)
    const button = container.querySelector('button')!
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies custom className', () => {
    const { container } = render(<Fab onClick={vi.fn()} className="custom-class" />)
    const button = container.querySelector('button')!
    expect(button.className).toContain('custom-class')
  })
})
