import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CreateApiKeyInput } from '@/hooks/useApiKeys'
import { useT } from '@/i18n'

interface ApiKeyDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateApiKeyInput) => Promise<void>
  providerId: number
  initialValues?: {
    name: string
    api_key: string
    notes: string
  }
}

export function AddApiKeyDialog({ open, onClose, onSubmit, providerId, initialValues }: ApiKeyDialogProps) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [notes, setNotes] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && initialValues) {
      setName(initialValues.name)
      setApiKey(initialValues.api_key)
      setNotes(initialValues.notes)
    } else if (!open) {
      setName(''); setApiKey(''); setNotes('')
    }
  }, [open, initialValues])

  if (!open) return null
  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!name || (!isEdit && !apiKey)) return
    setSubmitting(true)
    try {
      await onSubmit({
        provider_id: providerId,
        name,
        api_key: apiKey,
        notes: notes || null,
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
          {isEdit ? t('apiKeys.dialog.editTitle') : t('apiKeys.dialog.addTitle')}
        </h3>
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="text-[11px] text-muted mb-1">{t('apiKeys.dialog.name')} {!isEdit && '*'}</div>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('apiKeys.dialog.namePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">
              {isEdit ? t('apiKeys.dialog.apiKeyEdit') : t('apiKeys.dialog.apiKey')} {!isEdit && '*'}
            </div>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isEdit ? t('apiKeys.dialog.apiKeyEditPlaceholder') : t('apiKeys.dialog.apiKeyPlaceholder')}
                className="w-full bg-sidebar border border-border px-3 py-2 pr-9 rounded-[4px] text-xs text-foreground" />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('apiKeys.dialog.notes')}</div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={t('apiKeys.dialog.notesPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar">
            {t('models.dialog.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !name || (!isEdit && !apiKey)}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50">
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
