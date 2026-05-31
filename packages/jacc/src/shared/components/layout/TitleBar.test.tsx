import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TitleBar } from './TitleBar'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
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
})
