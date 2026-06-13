import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddApiKeyDialog } from './AddApiKeyDialog'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

describe('addApiKeyDialog', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <AddApiKeyDialog open={false} providerId={1} onClose={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title when open', () => {
    render(<AddApiKeyDialog open providerId={1} onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('apiKeys.dialog.addTitle')).toBeTruthy()
  })

  it('renders a password toggle button next to the api key input', () => {
    const { container } = render(
      <AddApiKeyDialog open providerId={1} onClose={vi.fn()} onSubmit={vi.fn()} />,
    )
    const passwordInput = container.querySelector('input[type="password"]')
    expect(passwordInput).toBeTruthy()
    const toggle = container.querySelector('button[type="button"]')
    expect(toggle).toBeTruthy()
  })

  it('calls onSubmit with provider_id', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <AddApiKeyDialog open providerId={7} onClose={vi.fn()} onSubmit={onSubmit} />,
    )
    const inputs = container.querySelectorAll('input')
    await userEvent.type(inputs[0], 'MyKey') // name
    await userEvent.type(inputs[1], 'sk-123') // api key
    await userEvent.click(screen.getByText('models.dialog.save'))
    expect(onSubmit).toHaveBeenCalledWith({
      provider_id: 7,
      name: 'MyKey',
      api_key: 'sk-123',
      notes: null,
    })
  })

  it('shows edit title in edit mode', () => {
    render(
      <AddApiKeyDialog
        open
        providerId={1}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        initialValues={{ name: 'Existing', api_key: 'sk-existing', notes: 'a note' }}
      />,
    )
    expect(screen.getByText('apiKeys.dialog.editTitle')).toBeTruthy()
  })
})
