import { tv } from 'tailwind-variants'

export const addMcpServerForm = tv({
  slots: {
    root: 'mt-3 p-3 bg-card border border-border-light rounded-[4px]',
    title: 'text-[13px] font-medium text-foreground mb-3',
    form: 'flex flex-col gap-2',
    input: 'bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs text-foreground',
    inputMono: 'bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground',
    buttons: 'flex justify-end gap-2',
    cancelButton: 'px-3 py-1.5 border border-border text-xs text-muted rounded-[2px]',
    submitButton: 'px-3 py-1.5 bg-primary text-white text-xs rounded-[2px]',
  },
})
