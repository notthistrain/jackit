import type { Provider } from '@/features/models/hooks/useProviders'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useProviderNode } from '@/features/models/hooks/useProviderNode'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { AddApiKeyDialog } from './AddApiKeyDialog'
import { AddProviderDialog } from './AddProviderDialog'
import { ApiKeyNode } from './ApiKeyNode'
import { providerNode } from './provider-node.variants'

export interface ProviderNodeProps {
  provider: Provider
  onRemoveProvider: (id: number) => void
  onUpdateProvider: (id: number, input: { name?: string, base_url?: string, notes?: string }) => Promise<void>
  t: (key: string, params?: Record<string, string>) => string
}

export function ProviderNode({ provider, onRemoveProvider, onUpdateProvider, t }: ProviderNodeProps) {
  const {
    apiKeys,
    update,
    remove,
    expanded,
    showAddKey,
    showEditProvider,
    confirmDeleteProvider,
    setExpanded,
    setShowAddKey,
    setShowEditProvider,
    setConfirmDeleteProvider,
    handleAddKey,
  } = useProviderNode(provider.id)

  const {
    root,
    header,
    chevron,
    info,
    infoBox,
    name,
    url,
    actions,
    addIcon,
    deleteIcon,
    list,
    empty,
    ghostBtn,
    dangerBtn,
  } = providerNode()

  return (
    <div className={root()}>
      {/* Provider header */}
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
            <div className={name()}>{provider.name}</div>
            <div className={url()}>{provider.base_url}</div>
          </div>
        </div>
        <div className={actions()} onClick={e => e.stopPropagation()}>
          <button onClick={() => setShowAddKey(true)} className={ghostBtn()}>
            <Plus size={12} className={addIcon()} />
            {t('apiKeys.addBtn')}
          </button>
          <button onClick={() => setShowEditProvider(true)} className={ghostBtn()}>
            {t('models.edit')}
          </button>
          <button onClick={() => setConfirmDeleteProvider(true)} className={dangerBtn()}>
            <Trash2 size={12} className={deleteIcon()} />
          </button>
        </div>
      </div>

      {/* Expanded: api keys list */}
      {expanded && (
        <div className={list()}>
          {apiKeys.map(ak => (
            <ApiKeyNode key={ak.id} apiKey={ak} onRemoveKey={remove} onUpdateKey={update} t={t} />
          ))}
          {apiKeys.length === 0 && <div className={empty()}>{t('models.empty')}</div>}
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
        onConfirm={() => {
          setConfirmDeleteProvider(false)
          onRemoveProvider(provider.id)
        }}
        onCancel={() => setConfirmDeleteProvider(false)}
      />
    </div>
  )
}
