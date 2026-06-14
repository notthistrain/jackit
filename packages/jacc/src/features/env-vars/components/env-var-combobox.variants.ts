import { tv } from 'tailwind-variants'

export const envVarCombobox = tv({
  slots: {
    root: 'relative',
    input: 'w-full bg-sidebar border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground',
    dropdown: 'absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-card border border-border rounded-[4px] shadow-md',
    groupTitle: 'px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted bg-card border-b border-border-light sticky top-0',
    option: 'flex items-center justify-between px-2 py-1 text-[11px] font-mono cursor-pointer hover:bg-sidebar',
    optionName: 'truncate',
    optionHint: 'ml-2 text-[9px] text-muted-foreground shrink-0',
    custom: 'px-2 py-1 text-[11px] text-primary cursor-pointer hover:bg-sidebar',
  },
  variants: {
    disabled: {
      true: { option: 'opacity-50 cursor-not-allowed hover:bg-transparent' },
    },
  },
})
