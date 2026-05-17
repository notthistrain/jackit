import { useEffect, useState } from 'react'
import type { CreateModelInput } from '@/hooks/useModels'
import { useT } from '@/i18n'

interface ModelDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateModelInput) => Promise<void>
  apiKeyId: number
  initialValues?: {
    model_name: string
    context_size: string
  }
}

export function AddModelDialog({ open, onClose, onSubmit, apiKeyId, initialValues }: ModelDialogProps) {
  const { t } = useT()
  const [modelName, setModelName] = useState('')
  const [contextSize, setContextSize] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && initialValues) {
      setModelName(initialValues.model_name)
      setContextSize(initialValues.context_size)
    } else if (!open) {
      setModelName(''); setContextSize('')
    }
  }, [open, initialValues])

  if (!open) return null
  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!modelName) return
    setSubmitting(true)
    try {
      await onSubmit({
        api_key_id: apiKeyId,
        model_name: modelName,
        context_size: contextSize || null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[400px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-5">
          {isEdit ? t('models.dialog.editTitle') : t('models.dialog.addTitle')}
        </h3>
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.modelName')} *</div>
            <input value={modelName} onChange={(e) => setModelName(e.target.value)}
              placeholder={t('models.dialog.modelNamePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.contextSize')}</div>
            <input value={contextSize} onChange={(e) => setContextSize(e.target.value)}
              placeholder={t('models.dialog.contextSizePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar">
            {t('models.dialog.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !modelName}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50">
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
