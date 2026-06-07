import { tv } from 'tailwind-variants'

export const selectRow = tv({
  slots: {
    root: 'flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]',
    info: '',
    label: 'text-[13px] font-medium text-foreground',
    description: 'text-[11px] text-muted',
    actions: 'flex items-center gap-2',
    select: 'bg-sidebar border border-border text-foreground px-2.5 py-1 rounded-[2px] text-xs',
  },
})
