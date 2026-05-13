import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MenuItem } from '../MenuItem'

describe('MenuItem', () => {
  it('renders label text', () => {
    render(<MenuItem label="File" />)
    expect(screen.getByText('File')).toBeTruthy()
  })

  it('renders shortcut hint', () => {
    render(<MenuItem label="New" shortcut="Ctrl+N" />)
    expect(screen.getByText('Ctrl+N')).toBeTruthy()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<MenuItem label="Open" onClick={onClick} />)
    fireEvent.click(screen.getByText('Open'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(<MenuItem label="Open" onClick={onClick} disabled />)
    fireEvent.click(screen.getByText('Open'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as separator when type is separator', () => {
    const { container } = render(<MenuItem type="separator" />)
    expect(container.firstChild).toBeTruthy()
    expect(container.textContent).toBe('')
  })
})
