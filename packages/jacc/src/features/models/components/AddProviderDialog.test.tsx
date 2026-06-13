import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddProviderDialog } from './AddProviderDialog'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

describe('addProviderDialog', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <AddProviderDialog open={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders inputs when open', () => {
    render(<AddProviderDialog open onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('providers.dialog.addTitle')).toBeTruthy()
  })

  it('calls onSubmit with form values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <AddProviderDialog open onClose={vi.fn()} onSubmit={onSubmit} />,
    )
    const inputs = container.querySelectorAll('input')
    await userEvent.type(inputs[0], 'MyProvider')
    await userEvent.type(inputs[1], 'http://api.test')
    await userEvent.click(screen.getByText('models.dialog.save'))
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'MyProvider',
      base_url: 'http://api.test',
      notes: null,
    })
  })

  it('shows initialValues in edit mode', () => {
    const { container } = render(
      <AddProviderDialog
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        initialValues={{ name: 'Existing', base_url: 'http://existing.test', notes: 'a note' }}
      />,
    )
    expect(screen.getByText('providers.dialog.editTitle')).toBeTruthy()
    const inputs = container.querySelectorAll('input')
    expect((inputs[0] as HTMLInputElement).value).toBe('Existing')
    expect((inputs[1] as HTMLInputElement).value).toBe('http://existing.test')
    expect((inputs[2] as HTMLInputElement).value).toBe('a note')
  })
})
