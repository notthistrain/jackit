import type { ApiKeyView } from '@/features/models/hooks/useApiKeys'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useApiKeyNode } from '@/features/models/hooks/useApiKeyNode'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { AddApiKeyDialog } from './AddApiKeyDialog'
import { AddModelDialog } from './AddModelDialog'
import { apiKeyNode } from './api-key-node.variants'
import { ModelNode } from './ModelNode'

export interface ApiKeyNodeProps {
  apiKey: ApiKeyView
  onRemoveKey: (id: number) => void
  onUpdateKey: (id: number, input: { name?: string, api_key?: string, notes?: string }) => Promise<void>
  t: (key: string, params?: Record<string, string>) => string
}

export function ApiKeyNode({ apiKey, onRemoveKey, onUpdateKey, t }: ApiKeyNodeProps) {
  const {
    models,
    remove,
    expanded,
    showAddModel,
    editingModel,
    showEditKey,
    testing,
    testResult,
    confirmDeleteKey,
    setExpanded,
    setShowAddModel,
    setEditingModel,
    setShowEditKey,
    setConfirmDeleteKey,
    handleTestModel,
    handleAddModel,
    handleEditModel,
  } = useApiKeyNode(apiKey.id, t)

  const {
    header,
    chevron,
    info,
    infoBox,
    name,
    masked,
    actions,
    addIcon,
    list,
    empty,
    ghostBtn,
    dangerBtn,
  } = apiKeyNode()

  return (
    <div>
      {/* Key header row */}
      <div
        className={header()}
        onClick={() => setExpanded(v => !v)}
      >
        <div className={info()}>
          {expanded
            ? (
                <ChevronDown size={14} className={chevron()} />
              )
            : (
                <ChevronRight size={14} className={chevron()} />
              )}
          <div className={infoBox()}>
            <div className={name()}>{apiKey.name}</div>
            <div className={masked()}>{apiKey.api_key_masked}</div>
          </div>
        </div>
        <div className={actions()} onClick={e => e.stopPropagation()}>
          <button onClick={() => setShowAddModel(true)} className={ghostBtn()}>
            <Plus size={12} className={addIcon()} />
            {t('models.addBtn')}
          </button>
          <button onClick={() => setShowEditKey(true)} className={ghostBtn()}>
            {t('models.edit')}
          </button>
          <button onClick={() => setConfirmDeleteKey(true)} className={dangerBtn()}>
            {t('models.delete')}
          </button>
        </div>
      </div>

      {/* Expanded: models list */}
      {expanded && (
        <div className={list()}>
          {models.map(model => (
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
          {models.length === 0 && <div className={empty()}>{t('models.empty')}</div>}
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
        onConfirm={() => {
          setConfirmDeleteKey(false)
          onRemoveKey(apiKey.id)
        }}
        onCancel={() => setConfirmDeleteKey(false)}
      />
    </div>
  )
}
