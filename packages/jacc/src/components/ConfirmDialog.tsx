import { useT } from '@/i18n'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useT()
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-card border border-border rounded-[4px] p-5 w-[360px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[14px] font-medium text-foreground mb-2">{title}</h3>
        <p className="text-[12px] text-muted leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 border border-border text-xs text-muted-foreground rounded-[2px] hover:bg-sidebar"
          >
            {t('confirm.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 text-xs text-white rounded-[2px] ${
              danger ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {confirmLabel || t('confirm.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}
