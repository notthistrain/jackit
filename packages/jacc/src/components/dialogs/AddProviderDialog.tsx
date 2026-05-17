import { useEffect, useState } from 'react'
import type { CreateProviderInput } from '@/hooks/useProviders'
import { useT } from '@/i18n'

interface ProviderDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateProviderInput) => Promise<void>
  initialValues?: {
    name: string
    base_url: string
    notes: string
  }
}

export function AddProviderDialog({ open, onClose, onSubmit, initialValues }: ProviderDialogProps) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && initialValues) {
      setName(initialValues.name)
      setBaseUrl(initialValues.base_url)
      setNotes(initialValues.notes)
    } else if (!open) {
      setName(''); setBaseUrl(''); setNotes('')
    }
  }, [open, initialValues])

  if (!open) return null
  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!name || !baseUrl) return
    setSubmitting(true)
    try {
      await onSubmit({ name, base_url: baseUrl, notes: notes || null })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[400px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-5">
          {isEdit ? t('providers.dialog.editTitle') : t('providers.dialog.addTitle')}
        </h3>
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="text-[11px] text-muted mb-1">{t('providers.dialog.name')} *</div>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('providers.dialog.namePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('providers.dialog.baseUrl')} *</div>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t('providers.dialog.baseUrlPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('providers.dialog.notes')}</div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={t('providers.dialog.notesPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar">
            {t('models.dialog.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !name || !baseUrl}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50">
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
