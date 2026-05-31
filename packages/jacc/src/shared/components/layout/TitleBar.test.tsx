import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { TitleBar } from './TitleBar'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  })),
}))

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

describe('titleBar', () => {
  it('renders title', () => {
    render(<TitleBar />)
    expect(screen.getByText('app.title')).toBeTruthy()
  })

  it('renders window control buttons', () => {
    const { container } = render(<TitleBar />)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(3)
  })

  it('calls minimize when minimize button clicked', async () => {
    const minimize = vi.fn()
    const toggleMaximize = vi.fn()
    const close = vi.fn()
    vi.mocked(getCurrentWindow).mockReturnValue({ minimize, toggleMaximize, close } as any)

    const { container } = render(<TitleBar />)
    const buttons = container.querySelectorAll('button')
    await userEvent.click(buttons[0])
    expect(minimize).toHaveBeenCalledTimes(1)
  })

  it('calls toggleMaximize when maximize button clicked', async () => {
    const minimize = vi.fn()
    const toggleMaximize = vi.fn()
    const close = vi.fn()
    vi.mocked(getCurrentWindow).mockReturnValue({ minimize, toggleMaximize, close } as any)

    const { container } = render(<TitleBar />)
    const buttons = container.querySelectorAll('button')
    await userEvent.click(buttons[1])
    expect(toggleMaximize).toHaveBeenCalledTimes(1)
  })

  it('calls close when close button clicked', async () => {
    const minimize = vi.fn()
    const toggleMaximize = vi.fn()
    const close = vi.fn()
    vi.mocked(getCurrentWindow).mockReturnValue({ minimize, toggleMaximize, close } as any)

    const { container } = render(<TitleBar />)
    const buttons = container.querySelectorAll('button')
    await userEvent.click(buttons[2])
    expect(close).toHaveBeenCalledTimes(1)
  })
})
