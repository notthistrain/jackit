import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Fab } from '@/components/Fab'
import { AddApiKeyDialog } from '@/components/dialogs/AddApiKeyDialog'
import { AddModelDialog } from '@/components/dialogs/AddModelDialog'
import { AddProviderDialog } from '@/components/dialogs/AddProviderDialog'
import { useApiKeys, type ApiKeyView } from '@/hooks/useApiKeys'
import { useModels, type Model } from '@/hooks/useModels'
import { useProviders, type Provider } from '@/hooks/useProviders'
import { useT } from '@/i18n'

// ---------------------------------------------------------------------------
// DropdownMenu — shared click-outside-aware menu for edit/delete actions
// ---------------------------------------------------------------------------
function DropdownMenu({
  open,
  onClose,
  items,
}: {
  open: boolean
  onClose: () => void
  items: { label: string; danger?: boolean; onClick: () => void }[]
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-10 py-1 min-w-[80px]">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-sidebar ${item.danger ? 'text-danger' : 'text-foreground'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ModelNode — leaf node: displays model_name + context_size
// ---------------------------------------------------------------------------
function ModelNode({
  model,
  onTest,
  onEdit,
  onRemove,
  testing,
  testResult,
  t,
}: {
  model: Model
  onTest: (id: number) => void
  onEdit: (m: Model) => void
  onRemove: (id: number) => void
  testing: number | null
  testResult: { id: number; msg: string; ok: boolean } | null
  t: (key: string, params?: Record<string, string>) => string
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex items-center justify-between pl-8 pr-3 py-2 hover:bg-sidebar/50 rounded-[4px] group">
      <div className="min-w-0 flex-1 mr-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-foreground font-medium">{model.model_name}</span>
          {model.context_size && (
            <span className="text-[10px] text-muted">({model.context_size})</span>
          )}
        </div>
        {testResult?.id === model.id && (
          <div
            className={`text-[10px] mt-0.5 truncate ${testResult.ok ? 'text-success' : 'text-danger'}`}
            title={testResult.msg}
          >
            {testResult.msg}
          </div>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => onTest(model.id)}
          disabled={testing === model.id}
          className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar disabled:opacity-50 cursor-pointer"
        >
          {testing === model.id ? '...' : t('models.test')}
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="text-[11px] px-2 py-1 bg-card border border-border rounded-[2px] text-muted hover:bg-sidebar cursor-pointer"
          >
            <MoreHorizontal size={14} />
          </button>
          <DropdownMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            items={[
              { label: t('models.edit'), onClick: () => onEdit(model) },
              { label: t('models.delete'), danger: true, onClick: () => onRemove(model.id) },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ApiKeyNode — middle level: holds useModels(apiKeyId)
// ---------------------------------------------------------------------------
function ApiKeyNode({
  apiKey,
  onRemoveKey,
  onUpdateKey,
  t,
}: {
  apiKey: ApiKeyView
  onRemoveKey: (id: number) => void
  onUpdateKey: (id: number, input: { name?: string; api_key?: string; notes?: string }) => Promise<void>
  t: (key: string, params?: Record<string, string>) => string
}) {
  const { models, add, update, remove, test } = useModels(apiKey.id)
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAddModel, setShowAddModel] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [showEditKey, setShowEditKey] = useState(false)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null)

  function formatTestResult(raw: string): string {
    if (raw === 'CONNECTION_SUCCESS') return t('models.testSuccess')
    if (raw.startsWith('CONNECTION_FAILED:')) return t('models.testFailed', { error: raw.slice(18) })
    if (raw.startsWith('HTTP_ERROR:')) return t('models.testFailed', { error: raw.slice(11) })
    return raw
  }

  async function handleTestModel(id: number) {
    setTesting(id)
    setTestResult(null)
    try {
      const msg = await test(id)
      setTestResult({ id, msg: formatTestResult(msg), ok: true })
    } catch (e) {
      setTestResult({ id, msg: formatTestResult(String(e)), ok: false })
    } finally {
      setTesting(null)
    }
  }

  async function handleAddModel(input: { api_key_id: number; model_name: string; context_size: string | null }) {
    await add(input)
    setShowAddModel(false)
  }

  async function handleEditModel(input: { api_key_id: number; model_name: string; context_size: string | null }) {
    if (editingModel) {
      await update(editingModel.id, {
        model_name: input.model_name,
        context_size: input.context_size === null ? undefined : input.context_size,
      })
    }
    setEditingModel(null)
  }

  return (
    <div>
      {/* Key header row */}
      <div
        className="flex items-center justify-between px-3 py-2.5 hover:bg-sidebar/50 rounded-[4px] cursor-pointer group"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {expanded
            ? <ChevronDown size={14} className="text-muted shrink-0" />
            : <ChevronRight size={14} className="text-muted shrink-0" />
          }
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-foreground truncate">{apiKey.name}</div>
            <div className="text-[11px] text-muted truncate">{apiKey.api_key_masked}</div>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="text-[11px] px-2 py-1 bg-card border border-border rounded-[2px] text-muted hover:bg-sidebar cursor-pointer"
            >
              <MoreHorizontal size={14} />
            </button>
            <DropdownMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              items={[
                { label: t('models.edit'), onClick: () => setShowEditKey(true) },
                { label: t('models.delete'), danger: true, onClick: () => onRemoveKey(apiKey.id) },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Expanded: models list */}
      {expanded && (
        <div className="ml-4 mt-0.5 mb-1 flex flex-col gap-0.5">
          {models.map((model) => (
            <ModelNode
              key={model.id}
              model={model}
              onTest={handleTestModel}
              onEdit={setEditingModel}
              onRemove={remove}
              testing={testing}
              testResult={testResult}
              t={t}
            />
          ))}
          {models.length === 0 && (
            <div className="pl-8 pr-3 py-2 text-[11px] text-muted">{t('models.empty')}</div>
          )}
          <button
            onClick={() => setShowAddModel(true)}
            className="ml-8 text-[11px] text-muted hover:text-foreground py-1 cursor-pointer"
          >
            + {t('models.dialog.addTitle')}
          </button>
        </div>
      )}

      {/* Dialogs */}
      <AddModelDialog
        open={showAddModel}
        onClose={() => setShowAddModel(false)}
        onSubmit={handleAddModel}
        apiKeyId={apiKey.id}
      />
      {editingModel && (
        <AddModelDialog
          open
          onClose={() => setEditingModel(null)}
          onSubmit={handleEditModel}
          apiKeyId={apiKey.id}
          initialValues={{
            model_name: editingModel.model_name,
            context_size: editingModel.context_size || '',
          }}
        />
      )}
      {showEditKey && (
        <AddApiKeyDialog
          open
          onClose={() => setShowEditKey(false)}
          onSubmit={async (input) => {
            await onUpdateKey(apiKey.id, {
              name: input.name,
              api_key: input.api_key || undefined,
              notes: input.notes || undefined,
            })
            setShowEditKey(false)
          }}
          providerId={apiKey.provider_id}
          initialValues={{
            name: apiKey.name,
            api_key: '',
            notes: apiKey.notes || '',
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProviderNode — top level: holds useApiKeys(providerId)
// ---------------------------------------------------------------------------
function ProviderNode({
  provider,
  onRemoveProvider,
  onUpdateProvider,
  t,
}: {
  provider: Provider
  onRemoveProvider: (id: number) => void
  onUpdateProvider: (id: number, input: { name?: string; base_url?: string; notes?: string }) => Promise<void>
  t: (key: string, params?: Record<string, string>) => string
}) {
  const { apiKeys, add, update, remove } = useApiKeys(provider.id)
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAddKey, setShowAddKey] = useState(false)
  const [showEditProvider, setShowEditProvider] = useState(false)

  async function handleAddKey(input: { provider_id: number; name: string; api_key: string; notes: string | null }) {
    await add(input)
    setShowAddKey(false)
  }

  return (
    <div className="bg-card border border-border-light rounded-[4px]">
      {/* Provider header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar/30 rounded-[4px]"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {expanded
            ? <ChevronDown size={14} className="text-muted shrink-0" />
            : <ChevronRight size={14} className="text-muted shrink-0" />
          }
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-foreground truncate">{provider.name}</div>
            <div className="text-[11px] text-muted truncate">{provider.base_url}</div>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="text-[11px] px-2 py-1 bg-card border border-border rounded-[2px] text-muted hover:bg-sidebar cursor-pointer"
            >
              <MoreHorizontal size={14} />
            </button>
            <DropdownMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              items={[
                { label: t('models.edit'), onClick: () => setShowEditProvider(true) },
                { label: t('models.delete'), danger: true, onClick: () => onRemoveProvider(provider.id) },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Expanded: api keys list */}
      {expanded && (
        <div className="px-2 pb-2 flex flex-col gap-0.5">
          {apiKeys.map((ak) => (
            <ApiKeyNode
              key={ak.id}
              apiKey={ak}
              onRemoveKey={remove}
              onUpdateKey={update}
              t={t}
            />
          ))}
          {apiKeys.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-muted">{t('apiKeys.dialog.addTitle')}</div>
          )}
          <button
            onClick={() => setShowAddKey(true)}
            className="ml-3 text-[11px] text-muted hover:text-foreground py-1 cursor-pointer"
          >
            + {t('apiKeys.dialog.addTitle')}
          </button>
        </div>
      )}

      {/* Dialogs */}
      <AddApiKeyDialog
        open={showAddKey}
        onClose={() => setShowAddKey(false)}
        onSubmit={handleAddKey}
        providerId={provider.id}
      />
      {showEditProvider && (
        <AddProviderDialog
          open
          onClose={() => setShowEditProvider(false)}
          onSubmit={async (input) => {
            await onUpdateProvider(provider.id, {
              name: input.name,
              base_url: input.base_url,
              notes: input.notes ?? undefined,
            })
            setShowEditProvider(false)
          }}
          initialValues={{
            name: provider.name,
            base_url: provider.base_url,
            notes: provider.notes || '',
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Models — main page component
// ---------------------------------------------------------------------------
export function Models() {
  const { t } = useT()
  const { providers, add, update, remove } = useProviders()
  const [showAddProvider, setShowAddProvider] = useState(false)

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('models.title')}</h2>

      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <ProviderNode
            key={provider.id}
            provider={provider}
            onRemoveProvider={remove}
            onUpdateProvider={update}
            t={t}
          />
        ))}
      </div>

      {providers.length === 0 && (
        <div className="px-4 py-3 bg-sidebar border border-border-light rounded-[4px] text-xs text-muted text-center">
          {t('models.empty')}
        </div>
      )}

      <Fab onClick={() => setShowAddProvider(true)} />
      <AddProviderDialog
        open={showAddProvider}
        onClose={() => setShowAddProvider(false)}
        onSubmit={add}
      />
    </div>
  )
}
