import { tv } from 'tailwind-variants'

export const toastProvider = tv({
  slots: {
    container: 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[360px]',
    toast: 'flex items-center gap-2 px-3 py-2 rounded-[4px] text-xs shadow-md border animate-in slide-in-from-right',
    message: 'flex-1 break-all',
    closeButton: 'shrink-0 opacity-60 hover:opacity-100 text-[10px]',
  },
  variants: {
    tone: {
      success: { toast: 'bg-success-light border-success/30 text-success' },
      error: { toast: 'bg-danger-light border-danger/30 text-danger' },
    },
  },
  defaultVariants: { tone: 'success' },
})
