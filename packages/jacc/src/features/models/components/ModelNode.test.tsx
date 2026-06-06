import type { Model } from '@/features/models/hooks/useModels'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ModelNode } from './ModelNode'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const t = (key: string) => key

const model: Model = {
  id: 1,
  api_key_id: 1,
  model_name: 'gpt-4',
  context_size: '128k',
  created_at: '',
  updated_at: '',
}

describe('modelNode', () => {
  it('renders model_name and context_size', () => {
    render(
      <ModelNode
        model={model}
        onTest={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        testing={null}
        testResult={null}
        t={t}
      />,
    )
    expect(screen.getByText('gpt-4')).toBeTruthy()
    expect(screen.getByText(/128k/)).toBeTruthy()
  })

  it('calls onTest with model id', async () => {
    const onTest = vi.fn()
    render(
      <ModelNode
        model={model}
        onTest={onTest}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        testing={null}
        testResult={null}
        t={t}
      />,
    )
    await userEvent.click(screen.getByText('models.test'))
    expect(onTest).toHaveBeenCalledWith(1)
  })

  it('shows confirm dialog when delete clicked', async () => {
    render(
      <ModelNode
        model={model}
        onTest={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        testing={null}
        testResult={null}
        t={t}
      />,
    )
    expect(screen.queryByText('confirm.deleteModel.title')).toBeNull()
    await userEvent.click(screen.getByText('models.delete'))
    expect(screen.getByText('confirm.deleteModel.title')).toBeTruthy()
  })

  it('calls onRemove with model id after confirming delete', async () => {
    const onRemove = vi.fn()
    render(
      <ModelNode
        model={model}
        onTest={vi.fn()}
        onEdit={vi.fn()}
        onRemove={onRemove}
        testing={null}
        testResult={null}
        t={t}
      />,
    )
    await userEvent.click(screen.getByText('models.delete'))
    expect(screen.getByText('confirm.deleteModel.title')).toBeTruthy()
    // confirmLabel reuses 'models.delete', so two nodes share the text:
    // the trigger button and the dialog confirm button. Click the latter.
    const deleteButtons = screen.getAllByText('models.delete')
    await userEvent.click(deleteButtons[deleteButtons.length - 1])
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('renders testResult msg when id matches', () => {
    render(
      <ModelNode
        model={model}
        onTest={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        testing={null}
        testResult={{ id: 1, msg: 'ok msg', ok: true }}
        t={t}
      />,
    )
    expect(screen.getByText('ok msg')).toBeTruthy()
  })
})
