import { tv } from 'tailwind-variants'

export const addPermissionFormVariants = tv({
  slots: {
    root: 'mt-4 p-3 bg-card border border-border-light rounded-[4px]',
    title: 'text-[13px] font-medium text-foreground mb-3',
    selectRow: 'flex gap-2 mb-2',
    select: 'bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs text-foreground',
    inputRow: 'flex gap-2',
    input: 'flex-1 bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground',
    submitButton: 'px-3 py-1.5 bg-primary text-white text-xs rounded-[2px]',
    cancelButton: 'px-3 py-1.5 border border-border text-xs text-muted rounded-[2px]',
  },
})
