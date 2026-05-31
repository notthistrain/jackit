import { useT } from '@/i18n'
import { confirmDialog } from './confirm-dialog.variants'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useT()
  const { overlay, content, title: titleClass, message: messageClass, footer, cancelButton, confirmButton } = confirmDialog({ danger })

  if (!open) return null

  return (
    <div className={overlay()} onClick={onCancel}>
      <div className={content()} onClick={e => e.stopPropagation()}>
        <h3 className={titleClass()}>{title}</h3>
        <p className={messageClass()}>{message}</p>
        <div className={footer()}>
          <button onClick={onCancel} className={cancelButton()}>
            {t('confirm.cancel')}
          </button>
          <button onClick={onConfirm} className={confirmButton()}>
            {confirmLabel || t('confirm.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}
