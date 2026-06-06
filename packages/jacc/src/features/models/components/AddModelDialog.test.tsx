import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddModelDialog } from './AddModelDialog'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

describe('addModelDialog', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <AddModelDialog open={false} apiKeyId={1} onClose={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title when open', () => {
    render(<AddModelDialog open apiKeyId={1} onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('models.dialog.addTitle')).toBeTruthy()
  })

  it('calls onSubmit with api_key_id', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <AddModelDialog open apiKeyId={3} onClose={vi.fn()} onSubmit={onSubmit} />,
    )
    const inputs = container.querySelectorAll('input')
    await userEvent.type(inputs[0], 'gpt-4')
    await userEvent.type(inputs[1], '128k')
    await userEvent.click(screen.getByText('models.dialog.save'))
    expect(onSubmit).toHaveBeenCalledWith({
      api_key_id: 3,
      model_name: 'gpt-4',
      context_size: '128k',
    })
  })

  it('shows edit title in edit mode', () => {
    render(
      <AddModelDialog
        open
        apiKeyId={1}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        initialValues={{ model_name: 'gpt-4', context_size: '128k' }}
      />,
    )
    expect(screen.getByText('models.dialog.editTitle')).toBeTruthy()
  })
})
