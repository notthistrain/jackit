import type { CreateModelInput } from '../api/models-api'
import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { Button } from '@/shared/components/ui/Button'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Input } from '@/shared/components/ui/Input'
import { addModelDialog } from './add-model-dialog.variants'

export interface AddModelDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateModelInput) => Promise<void>
  apiKeyId: number
  initialValues?: {
    model_name: string
    context_size: string
  }
}

export function AddModelDialog({ open, onClose, onSubmit, apiKeyId, initialValues }: AddModelDialogProps) {
  const { t } = useT()
  const [modelName, setModelName] = useState('')
  const [contextSize, setContextSize] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { form, footer } = addModelDialog()

  useEffect(() => {
    if (open && initialValues) {
      setModelName(initialValues.model_name)
      setContextSize(initialValues.context_size)
    }
    else if (!open) {
      setModelName('')
      setContextSize('')
    }
  }, [open, initialValues])

  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!modelName)
      return
    setSubmitting(true)
    try {
      await onSubmit({
        api_key_id: apiKeyId,
        model_name: modelName,
        context_size: contextSize || null,
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
      title={isEdit ? t('models.dialog.editTitle') : t('models.dialog.addTitle')}
      footer={(
        <div className={footer()}>
          <Button variant="ghost" onClick={onClose}>
            {t('models.dialog.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !modelName}
          >
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </Button>
        </div>
      )}
    >
      <div className={form()}>
        <Input
          label={`${t('models.dialog.modelName')} *`}
          value={modelName}
          onChange={setModelName}
          placeholder={t('models.dialog.modelNamePlaceholder')}
        />
        <Input
          label={t('models.dialog.contextSize')}
          value={contextSize}
          onChange={setContextSize}
          placeholder={t('models.dialog.contextSizePlaceholder')}
        />
      </div>
    </Dialog>
  )
}
