import type { CreateProviderInput } from '../api/models-api'
import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { Button } from '@/shared/components/ui/Button'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Input } from '@/shared/components/ui/Input'
import { addProviderDialog } from './add-provider-dialog.variants'

export interface AddProviderDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateProviderInput) => Promise<void>
  initialValues?: {
    name: string
    base_url: string
    notes: string
  }
}

export function AddProviderDialog({ open, onClose, onSubmit, initialValues }: AddProviderDialogProps) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { form, footer } = addProviderDialog()

  useEffect(() => {
    if (open && initialValues) {
      setName(initialValues.name)
      setBaseUrl(initialValues.base_url)
      setNotes(initialValues.notes)
    }
    else if (!open) {
      setName('')
      setBaseUrl('')
      setNotes('')
    }
  }, [open, initialValues])

  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!name || !baseUrl)
      return
    setSubmitting(true)
    try {
      await onSubmit({ name, base_url: baseUrl, notes: notes || null })
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
      title={isEdit ? t('providers.dialog.editTitle') : t('providers.dialog.addTitle')}
      footer={(
        <div className={footer()}>
          <Button variant="ghost" onClick={onClose}>
            {t('models.dialog.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name || !baseUrl}
          >
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </Button>
        </div>
      )}
    >
      <div className={form()}>
        <Input
          label={`${t('providers.dialog.name')} *`}
          value={name}
          onChange={setName}
          placeholder={t('providers.dialog.namePlaceholder')}
        />
        <Input
          label={`${t('providers.dialog.baseUrl')} *`}
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder={t('providers.dialog.baseUrlPlaceholder')}
        />
        <Input
          label={t('providers.dialog.notes')}
          value={notes}
          onChange={setNotes}
          placeholder={t('providers.dialog.notesPlaceholder')}
        />
      </div>
    </Dialog>
  )
}
