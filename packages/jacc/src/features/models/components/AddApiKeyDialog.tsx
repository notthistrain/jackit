import type { CreateApiKeyInput } from '../api/models-api'
import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { Button } from '@/shared/components/ui/Button'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Input } from '@/shared/components/ui/Input'
import { addApiKeyDialog } from './add-api-key-dialog.variants'

export interface AddApiKeyDialogProps {
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

export function AddApiKeyDialog({ open, onClose, onSubmit, providerId, initialValues }: AddApiKeyDialogProps) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { form, footer } = addApiKeyDialog()

  useEffect(() => {
    if (open && initialValues) {
      setName(initialValues.name)
      setApiKey(initialValues.api_key)
      setNotes(initialValues.notes)
    }
    else if (!open) {
      setName('')
      setApiKey('')
      setNotes('')
    }
  }, [open, initialValues])

  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!name || (!isEdit && !apiKey))
      return
    setSubmitting(true)
    try {
      await onSubmit({
        provider_id: providerId,
        name,
        api_key: apiKey,
        notes: notes || null,
      })
      onClose()
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t('apiKeys.dialog.editTitle') : t('apiKeys.dialog.addTitle')}
      footer={(
        <div className={footer()}>
          <Button variant="ghost" onClick={onClose}>
            {t('models.dialog.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name || (!isEdit && !apiKey)}
          >
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </Button>
        </div>
      )}
    >
      <div className={form()}>
        <Input
          label={`${t('apiKeys.dialog.name')}${isEdit ? '' : ' *'}`}
          value={name}
          onChange={setName}
          placeholder={t('apiKeys.dialog.namePlaceholder')}
        />
        <Input
          type="password"
          togglePassword
          label={`${isEdit ? t('apiKeys.dialog.apiKeyEdit') : t('apiKeys.dialog.apiKey')}${isEdit ? '' : ' *'}`}
          value={apiKey}
          onChange={setApiKey}
          placeholder={isEdit ? t('apiKeys.dialog.apiKeyEditPlaceholder') : t('apiKeys.dialog.apiKeyPlaceholder')}
        />
        <Input
          label={t('apiKeys.dialog.notes')}
          value={notes}
          onChange={setNotes}
          placeholder={t('apiKeys.dialog.notesPlaceholder')}
        />
      </div>
    </Dialog>
  )
}
