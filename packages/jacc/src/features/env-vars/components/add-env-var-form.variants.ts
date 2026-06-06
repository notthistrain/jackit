import { tv } from 'tailwind-variants'

export const addEnvVarFormVariants = tv({
  slots: {
    container: 'mt-3 p-3 bg-card border border-border-light rounded-[4px]',
    formRow: 'flex gap-2 items-end',
    inputGroup: 'flex-1',
    label: 'text-[11px] text-muted mb-1',
    input: 'w-full bg-sidebar border border-border px-2 py-1.5 rounded-[2px] text-xs font-mono text-foreground',
    submitBtn: 'px-3 py-1.5 bg-primary text-white text-xs rounded-[2px]',
    cancelBtn: 'px-3 py-1.5 border border-border text-xs text-muted rounded-[2px]',
  },
})
