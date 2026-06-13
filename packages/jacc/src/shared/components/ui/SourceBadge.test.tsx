import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SourceBadge } from './SourceBadge'

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

describe('sourceBadge', () => {
  it('renders global scope', () => {
    render(<SourceBadge scope="global" />)
    expect(screen.getByText('source.global')).toBeTruthy()
  })

  it('renders project scope', () => {
    render(<SourceBadge scope="project" />)
    expect(screen.getByText('source.project')).toBeTruthy()
  })

  it('renders models scope with emoji', () => {
    render(<SourceBadge scope="models" />)
    expect(screen.getByText('🧠')).toBeTruthy()
  })

  it('applies custom className', () => {
    const { container } = render(<SourceBadge scope="global" className="custom-class" />)
    const badge = container.querySelector('span')!
    expect(badge.className).toContain('custom-class')
  })
})
