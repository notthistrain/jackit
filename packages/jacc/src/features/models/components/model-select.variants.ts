import { tv } from 'tailwind-variants'

export const modelSelect = tv({
  slots: {
    root: 'relative',
    trigger: 'flex items-center gap-1 px-2 py-1 border border-border rounded-[2px] text-xs bg-sidebar text-foreground hover:bg-sidebar/80',
    triggerText: '',
    triggerPlaceholder: 'text-muted',
    triggerIcon: 'text-muted shrink-0',
    dropdown: 'absolute left-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-20 min-w-[280px]',
    searchWrapper: 'p-1.5 border-b border-border',
    search: 'w-full px-2 py-1 text-xs bg-sidebar border border-border rounded-[2px] text-foreground placeholder:text-muted outline-none',
    list: 'max-h-[200px] overflow-y-auto',
    option: 'flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer',
    optionMeta: 'text-[10px] text-muted shrink-0 ml-2',
    empty: 'px-2.5 py-2 text-xs text-muted text-center',
  },
  variants: {
    highlighted: {
      true: { option: 'bg-sidebar' },
    },
    selected: {
      true: { option: 'text-primary font-medium' },
      false: { option: 'text-foreground' },
    },
  },
})
