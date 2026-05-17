import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Fab } from '@/components/Fab'
import { AddApiKeyDialog } from '@/components/dialogs/AddApiKeyDialog'
import { AddModelDialog } from '@/components/dialogs/AddModelDialog'
import { AddProviderDialog } from '@/components/dialogs/AddProviderDialog'
import { useApiKeys, type ApiKeyView } from '@/hooks/useApiKeys'
import { useModels, type Model } from '@/hooks/useModels'
import { useProviders, type Provider } from '@/hooks/useProviders'
import { useT } from '@/i18n'

// shared button styles
const btnBase = 'text-[11px] px-2 py-1 border border-border rounded-[2px] cursor-pointer'
const btnGhost = `${btnBase} text-muted hover:bg-sidebar hover:text-foreground`
const btnDanger = `${btnBase} text-muted hover:bg-danger/10 hover:text-danger`

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
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex items-center justify-between pl-24 pr-3 py-2 hover:bg-sidebar/50 rounded-[4px]">
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
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onTest(model.id)}
          disabled={testing === model.id}
          className={`${btnBase} bg-card text-foreground hover:bg-sidebar disabled:opacity-50`}
        >
          {testing === model.id ? '...' : t('models.test')}
        </button>
        <button onClick={() => onEdit(model)} className={btnGhost}>
          {t('models.edit')}
        </button>
        <button onClick={() => setConfirmDelete(true)} className={btnDanger}>
          {t('models.delete')}
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={t('confirm.deleteModel.title')}
        message={t('confirm.deleteModel.message', { name: model.model_name })}
        confirmLabel={t('models.delete')}
        danger
        onConfirm={() => { setConfirmDelete(false); onRemove(model.id) }}
        onCancel={() => setConfirmDelete(false)}
      />
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
  const [showAddModel, setShowAddModel] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [showEditKey, setShowEditKey] = useState(false)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null)
  const [confirmDeleteKey, setConfirmDeleteKey] = useState(false)

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
        className="flex items-center justify-between pl-12 pr-3 py-2.5 hover:bg-sidebar/50 rounded-[4px] cursor-pointer"
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
        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowAddModel(true)} className={btnGhost}>
            <Plus size={12} className="inline -mt-0.5 mr-0.5" />{t('models.addBtn')}
          </button>
          <button onClick={() => setShowEditKey(true)} className={btnGhost}>
            {t('models.edit')}
          </button>
          <button onClick={() => setConfirmDeleteKey(true)} className={btnDanger}>
            {t('models.delete')}
          </button>
        </div>
      </div>

      {/* Expanded: models list */}
      {expanded && (
        <div className="mt-0.5 mb-1 flex flex-col gap-0.5">
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
            <div className="pl-24 pr-3 py-2 text-[11px] text-muted">{t('models.empty')}</div>
          )}
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
      <ConfirmDialog
        open={confirmDeleteKey}
        title={t('confirm.deleteApiKey.title')}
        message={t('confirm.deleteApiKey.message', { name: apiKey.name })}
        confirmLabel={t('models.delete')}
        danger
        onConfirm={() => { setConfirmDeleteKey(false); onRemoveKey(apiKey.id) }}
        onCancel={() => setConfirmDeleteKey(false)}
      />
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
  const [showAddKey, setShowAddKey] = useState(false)
  const [showEditProvider, setShowEditProvider] = useState(false)
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState(false)

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
        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowAddKey(true)} className={btnGhost}>
            <Plus size={12} className="inline -mt-0.5 mr-0.5" />{t('apiKeys.addBtn')}
          </button>
          <button onClick={() => setShowEditProvider(true)} className={btnGhost}>
            {t('models.edit')}
          </button>
          <button onClick={() => setConfirmDeleteProvider(true)} className={btnDanger}>
            <Trash2 size={12} className="inline -mt-0.5" />
          </button>
        </div>
      </div>

      {/* Expanded: api keys list */}
      {expanded && (
        <div className="pb-2 flex flex-col gap-0.5">
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
            <div className="pl-12 pr-3 py-2 text-[11px] text-muted">{t('models.empty')}</div>
          )}
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
      <ConfirmDialog
        open={confirmDeleteProvider}
        title={t('confirm.deleteProvider.title')}
        message={t('confirm.deleteProvider.message', { name: provider.name })}
        confirmLabel={t('models.delete')}
        danger
        onConfirm={() => { setConfirmDeleteProvider(false); onRemoveProvider(provider.id) }}
        onCancel={() => setConfirmDeleteProvider(false)}
      />
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
