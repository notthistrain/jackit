import { useState } from 'react'
import { AddProviderDialog } from '@/features/models/components/AddProviderDialog'
import { ProviderNode } from '@/features/models/components/ProviderNode'
import { useProviders } from '@/features/models/hooks/useProviders'
import { useT } from '@/i18n'
import { Fab } from '@/shared/components/ui/Fab'

export function Models() {
  const { t } = useT()
  const { providers, add, update, remove } = useProviders()
  const [showAddProvider, setShowAddProvider] = useState(false)

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('models.title')}</h2>

      <div className="flex flex-col gap-2">
        {providers.map(provider => (
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
      <AddProviderDialog open={showAddProvider} onClose={() => setShowAddProvider(false)} onSubmit={add} />
    </div>
  )
}
