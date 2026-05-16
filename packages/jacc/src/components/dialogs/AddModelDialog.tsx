import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CreateModelInput } from '@/hooks/useModels'
import { useT } from '@/i18n'

interface AddModelDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateModelInput) => Promise<void>
  initialValues?: {
    alias: string
    base_url: string
    api_key: string
    model_name: string
    slot: string
    context_size: string
  }
}

export function AddModelDialog({ open, onClose, onSubmit, initialValues }: AddModelDialogProps) {
  const { t } = useT()
  const [alias, setAlias] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [slot, setSlot] = useState<string>('')
  const [contextSize, setContextSize] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && initialValues) {
      setAlias(initialValues.alias)
      setBaseUrl(initialValues.base_url)
      setApiKey(initialValues.api_key)
      setModelName(initialValues.model_name)
      setSlot(initialValues.slot)
      setContextSize(initialValues.context_size)
    } else if (!open) {
      setAlias('')
      setBaseUrl('')
      setApiKey('')
      setModelName('')
      setSlot('')
      setContextSize('')
    }
  }, [open, initialValues])

  if (!open) return null

  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!alias || !baseUrl || !modelName) return
    if (!isEdit && !apiKey) return
    setSubmitting(true)
    try {
      await onSubmit({
        alias,
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName,
        slot: slot || null,
        context_size: contextSize,
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
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.alias')} {t('models.dialog.required')}</div>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={t('models.dialog.aliasPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.baseUrl')} {t('models.dialog.required')}</div>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t('models.dialog.baseUrlPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">
              {isEdit ? t('models.dialog.apiKeyEdit') : t('models.dialog.apiKey')} {!isEdit && t('models.dialog.required')}
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isEdit ? t('models.dialog.apiKeyEditPlaceholder') : t('models.dialog.apiKeyPlaceholder')}
                className="w-full bg-sidebar border border-border px-3 py-2 pr-9 rounded-[4px] text-xs text-foreground"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.modelName')} {t('models.dialog.required')}</div>
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={t('models.dialog.modelNamePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.contextSize')}</div>
            <input
              value={contextSize}
              onChange={(e) => setContextSize(e.target.value)}
              placeholder={t('models.dialog.contextSizePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.slot')}</div>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            >
              <option value="">{t('models.dialog.slotNone')}</option>
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar"
          >
            {t('models.dialog.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !alias || !baseUrl || !modelName || (!isEdit && !apiKey)}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50"
          >
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
