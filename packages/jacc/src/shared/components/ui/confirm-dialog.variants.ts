import { tv } from 'tailwind-variants'

export const confirmDialog = tv({
  slots: {
    overlay: 'fixed inset-0 bg-black/30 flex items-center justify-center z-50',
    content: 'bg-card border border-border rounded-[4px] p-5 w-[360px] shadow-xl',
    title: 'text-[14px] font-medium text-foreground mb-2',
    message: 'text-[12px] text-muted leading-relaxed',
    footer: 'flex justify-end gap-2 mt-4',
    cancelButton: 'px-4 py-1.5 border border-border text-xs text-muted-foreground rounded-[2px] hover:bg-sidebar',
    confirmButton: 'px-4 py-1.5 text-xs text-white rounded-[2px]',
  },
  variants: {
    danger: {
      true: {
        confirmButton: 'bg-danger hover:bg-danger/90',
      },
      false: {
        confirmButton: 'bg-primary hover:bg-primary/90',
      },
    },
  },
})
