import type { ApiKeyView } from '@/features/models/hooks/useApiKeys'
import type { Model } from '@/features/models/hooks/useModels'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string, params?: Record<string, string>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}))

const hooks = vi.hoisted(() => ({
  modelsResult: { models: [] as Model[], add: vi.fn(), update: vi.fn(), remove: vi.fn(), test: vi.fn() },
}))

vi.mock('@/features/models/hooks/useModels', () => ({
  useModels: () => hooks.modelsResult,
}))

const apiKey: ApiKeyView = {
  id: 7,
  provider_id: 3,
  name: 'My Key',
  api_key_masked: 'sk-***xyz',
  notes: 'note',
  created_at: '',
  updated_at: '',
}

function t(key: string, params?: Record<string, string>) {
  return params ? `${key}:${JSON.stringify(params)}` : key
}

beforeEach(() => {
  hooks.modelsResult = { models: [], add: vi.fn(), update: vi.fn(), remove: vi.fn(), test: vi.fn() }
})

describe('apiKeyNode', () => {
  it('renders apiKey.name and api_key_masked', async () => {
    const { ApiKeyNode } = await import('./ApiKeyNode')
    render(
      <ApiKeyNode
        apiKey={apiKey}
        onRemoveKey={vi.fn()}
        onUpdateKey={vi.fn()}
        t={t}
      />,
    )
    expect(screen.getByText('My Key')).toBeTruthy()
    expect(screen.getByText('sk-***xyz')).toBeTruthy()
  })

  it('does not show models list when collapsed', async () => {
    const { ApiKeyNode } = await import('./ApiKeyNode')
    render(
      <ApiKeyNode
        apiKey={apiKey}
        onRemoveKey={vi.fn()}
        onUpdateKey={vi.fn()}
        t={t}
      />,
    )
    expect(screen.queryByText('models.empty')).toBeNull()
  })

  it('expands and shows models.empty when no models', async () => {
    const { ApiKeyNode } = await import('./ApiKeyNode')
    render(
      <ApiKeyNode
        apiKey={apiKey}
        onRemoveKey={vi.fn()}
        onUpdateKey={vi.fn()}
        t={t}
      />,
    )
    await userEvent.click(screen.getByText('My Key'))
    expect(screen.getByText('models.empty')).toBeTruthy()
  })

  it('renders ModelNode children when models exist after expanding', async () => {
    hooks.modelsResult = {
      models: [{
        id: 1,
        api_key_id: 7,
        model_name: 'gpt-4',
        context_size: '128k',
        created_at: '',
        updated_at: '',
      }],
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      test: vi.fn(),
    }
    const { ApiKeyNode } = await import('./ApiKeyNode')
    render(
      <ApiKeyNode
        apiKey={apiKey}
        onRemoveKey={vi.fn()}
        onUpdateKey={vi.fn()}
        t={t}
      />,
    )
    await userEvent.click(screen.getByText('My Key'))
    expect(screen.getByText('gpt-4')).toBeTruthy()
  })

  it('opens add-model dialog when addBtn clicked (does not bubble to header)', async () => {
    const { ApiKeyNode } = await import('./ApiKeyNode')
    render(
      <ApiKeyNode
        apiKey={apiKey}
        onRemoveKey={vi.fn()}
        onUpdateKey={vi.fn()}
        t={t}
      />,
    )
    await userEvent.click(screen.getByText('models.addBtn'))
    // Dialog opens with addTitle key
    expect(screen.getByText('models.dialog.addTitle')).toBeTruthy()
    // Header should remain collapsed (no expand triggered)
    expect(screen.queryByText('models.empty')).toBeNull()
  })

  it('opens delete confirm dialog when delete clicked', async () => {
    const { ApiKeyNode } = await import('./ApiKeyNode')
    render(
      <ApiKeyNode
        apiKey={apiKey}
        onRemoveKey={vi.fn()}
        onUpdateKey={vi.fn()}
        t={t}
      />,
    )
    expect(screen.queryByText('confirm.deleteApiKey.title')).toBeNull()
    await userEvent.click(screen.getByText('models.delete'))
    expect(screen.getByText('confirm.deleteApiKey.title')).toBeTruthy()
  })

  it('calls onRemoveKey with apiKey.id after confirming delete', async () => {
    const onRemoveKey = vi.fn()
    const { ApiKeyNode } = await import('./ApiKeyNode')
    render(
      <ApiKeyNode
        apiKey={apiKey}
        onRemoveKey={onRemoveKey}
        onUpdateKey={vi.fn()}
        t={t}
      />,
    )
    await userEvent.click(screen.getByText('models.delete'))
    expect(screen.getByText('confirm.deleteApiKey.title')).toBeTruthy()
    // confirmLabel reuses 'models.delete', take last instance (dialog confirm button)
    const deleteButtons = screen.getAllByText('models.delete')
    await userEvent.click(deleteButtons[deleteButtons.length - 1])
    expect(onRemoveKey).toHaveBeenCalledWith(7)
  })
})
