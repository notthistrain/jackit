import type { ApiKeyView } from '@/features/models/hooks/useApiKeys'
import type { Provider } from '@/features/models/hooks/useProviders'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string, params?: Record<string, string>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}))

const hooks = vi.hoisted(() => ({
  apiKeysResult: { apiKeys: [] as ApiKeyView[], add: vi.fn(), update: vi.fn(), remove: vi.fn() },
  modelsResult: { models: [] as unknown[], add: vi.fn(), update: vi.fn(), remove: vi.fn(), test: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/models/hooks/useApiKeys', () => ({
  useApiKeys: () => hooks.apiKeysResult,
}))

// Child ApiKeyNode transitively uses useModels which uses useToast — mock both.
vi.mock('@/features/models/hooks/useModels', () => ({
  useModels: () => hooks.modelsResult,
}))

vi.mock('@/providers/ToastProvider', () => ({ useToast: () => hooks.toast }))

const provider: Provider = {
  id: 5,
  name: 'OpenAI',
  base_url: 'https://api.openai.com/v1',
  notes: '',
  created_at: '',
  updated_at: '',
}

function t(key: string, params?: Record<string, string>) {
  return params ? `${key}:${JSON.stringify(params)}` : key
}

beforeEach(() => {
  hooks.apiKeysResult = { apiKeys: [], add: vi.fn(), update: vi.fn(), remove: vi.fn() }
  hooks.modelsResult = { models: [], add: vi.fn(), update: vi.fn(), remove: vi.fn(), test: vi.fn() }
})

describe('providerNode', () => {
  it('renders provider.name and base_url', async () => {
    const { ProviderNode } = await import('./ProviderNode')
    render(
      <ProviderNode
        provider={provider}
        onRemoveProvider={vi.fn()}
        onUpdateProvider={vi.fn()}
        t={t}
      />,
    )
    expect(screen.getByText('OpenAI')).toBeTruthy()
    expect(screen.getByText('https://api.openai.com/v1')).toBeTruthy()
  })

  it('does not show api keys list when collapsed', async () => {
    const { ProviderNode } = await import('./ProviderNode')
    render(
      <ProviderNode
        provider={provider}
        onRemoveProvider={vi.fn()}
        onUpdateProvider={vi.fn()}
        t={t}
      />,
    )
    expect(screen.queryByText('models.empty')).toBeNull()
  })

  it('expands and shows models.empty when no api keys after clicking header', async () => {
    const { ProviderNode } = await import('./ProviderNode')
    render(
      <ProviderNode
        provider={provider}
        onRemoveProvider={vi.fn()}
        onUpdateProvider={vi.fn()}
        t={t}
      />,
    )
    await userEvent.click(screen.getByText('OpenAI'))
    expect(screen.getByText('models.empty')).toBeTruthy()
  })

  it('renders ApiKeyNode children when apiKeys exist after expanding (no empty)', async () => {
    hooks.apiKeysResult = {
      apiKeys: [{
        id: 11,
        provider_id: 5,
        name: 'My Key',
        api_key_masked: 'sk-***xyz',
        notes: '',
        created_at: '',
        updated_at: '',
      }],
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    }
    const { ProviderNode } = await import('./ProviderNode')
    render(
      <ProviderNode
        provider={provider}
        onRemoveProvider={vi.fn()}
        onUpdateProvider={vi.fn()}
        t={t}
      />,
    )
    await userEvent.click(screen.getByText('OpenAI'))
    expect(screen.getByText('My Key')).toBeTruthy()
    expect(screen.queryByText('models.empty')).toBeNull()
  })

  it('opens add-api-key dialog when addBtn clicked (does not bubble to header)', async () => {
    const { ProviderNode } = await import('./ProviderNode')
    render(
      <ProviderNode
        provider={provider}
        onRemoveProvider={vi.fn()}
        onUpdateProvider={vi.fn()}
        t={t}
      />,
    )
    await userEvent.click(screen.getByText('apiKeys.addBtn'))
    // Dialog opens with addTitle key
    expect(screen.getByText('apiKeys.dialog.addTitle')).toBeTruthy()
    // Header should remain collapsed (no expand triggered)
    expect(screen.queryByText('models.empty')).toBeNull()
  })

  it('opens delete confirm dialog when delete (trash) icon clicked', async () => {
    const { ProviderNode } = await import('./ProviderNode')
    const { container } = render(
      <ProviderNode
        provider={provider}
        onRemoveProvider={vi.fn()}
        onUpdateProvider={vi.fn()}
        t={t}
      />,
    )
    expect(screen.queryByText('confirm.deleteProvider.title')).toBeNull()
    // delete button is icon-only (Trash2). It is the third (last) button in actions.
    const buttons = container.querySelectorAll('button')
    // Click last in header actions row: that's the delete button
    // Find the danger one specifically by the trash icon parent
    const deleteBtn = Array.from(buttons).find(b => b.querySelector('svg.lucide-trash-2, svg.lucide-trash2, svg[class*="trash"]'))
    expect(deleteBtn).toBeTruthy()
    await userEvent.click(deleteBtn!)
    expect(screen.getByText('confirm.deleteProvider.title')).toBeTruthy()
  })

  it('calls onRemoveProvider with provider.id after confirming delete', async () => {
    const onRemoveProvider = vi.fn()
    const { ProviderNode } = await import('./ProviderNode')
    const { container } = render(
      <ProviderNode
        provider={provider}
        onRemoveProvider={onRemoveProvider}
        onUpdateProvider={vi.fn()}
        t={t}
      />,
    )
    const buttons = container.querySelectorAll('button')
    const deleteBtn = Array.from(buttons).find(b => b.querySelector('svg[class*="trash"]'))
    await userEvent.click(deleteBtn!)
    expect(screen.getByText('confirm.deleteProvider.title')).toBeTruthy()
    // delete button is icon-only so 'models.delete' appears only once (in dialog confirm)
    await userEvent.click(screen.getByText('models.delete'))
    expect(onRemoveProvider).toHaveBeenCalledWith(5)
  })

  it('calls onUpdateProvider with notes=undefined when edit dialog submitted with empty notes', async () => {
    const onUpdateProvider = vi.fn().mockResolvedValue(undefined)
    const { ProviderNode } = await import('./ProviderNode')
    render(
      <ProviderNode
        provider={provider}
        onRemoveProvider={vi.fn()}
        onUpdateProvider={onUpdateProvider}
        t={t}
      />,
    )
    // Click edit button
    await userEvent.click(screen.getByText('models.edit'))
    // AddProviderDialog opens in edit mode
    expect(screen.getByText('providers.dialog.editTitle')).toBeTruthy()
    // Submit (name & base_url already filled from initialValues; notes is empty)
    await userEvent.click(screen.getByText('models.dialog.save'))
    // Verify '?? undefined' folding branch in ProviderNode: input.notes ?? undefined
    // AddProviderDialog passes notes: notes || null, so empty string becomes null,
    // then ProviderNode collapses null to undefined.
    expect(onUpdateProvider).toHaveBeenCalledWith(5, {
      name: 'OpenAI',
      base_url: 'https://api.openai.com/v1',
      notes: undefined,
    })
    // Dialog should close after successful submit
    expect(screen.queryByText('providers.dialog.editTitle')).toBeNull()
  })
})
