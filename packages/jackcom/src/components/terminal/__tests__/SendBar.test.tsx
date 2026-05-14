import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SendBar } from '../SendBar'

describe('SendBar', () => {
  it('renders hex mode by default', () => {
    render(<SendBar onSend={vi.fn()} />)
    expect(screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')).toBeTruthy()
  })

  it('switches to ASCII mode', () => {
    render(<SendBar onSend={vi.fn()} />)
    const asciiBtn = screen.getByText('ASCII')
    fireEvent.click(asciiBtn)
    expect(screen.getByPlaceholderText('AT+RST')).toBeTruthy()
  })

  it('sends hex data on Enter', () => {
    const onSend = vi.fn()
    render(<SendBar onSend={onSend} />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    fireEvent.change(input, { target: { value: '01 03' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith([0x01, 0x03])
  })

  it('sends ASCII data', () => {
    const onSend = vi.fn()
    render(<SendBar onSend={onSend} />)
    fireEvent.click(screen.getByText('ASCII'))
    const input = screen.getByPlaceholderText('AT+RST')
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith([72, 101, 108, 108, 111])
  })

  it('shows error border for invalid hex', () => {
    render(<SendBar onSend={vi.fn()} />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    fireEvent.change(input, { target: { value: 'GG' } })
    // error state applies border-error Tailwind class
    expect(input.className).toContain('border-error')
  })

  it('adds line ending when selected', () => {
    const onSend = vi.fn()
    render(<SendBar onSend={onSend} />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    fireEvent.change(input, { target: { value: '01' } })
    fireEvent.click(screen.getByText('+CRLF'))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith([0x01, 0x0d, 0x0a])
  })

  it('disables input and button when disabled', () => {
    render(<SendBar onSend={vi.fn()} disabled />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    const sendBtn = screen.getByText('SEND')
    expect(input).toHaveProperty('disabled', true)
    expect(sendBtn).toHaveProperty('disabled', true)
  })

  it('does not send empty input', () => {
    const onSend = vi.fn()
    render(<SendBar onSend={onSend} />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })
})
