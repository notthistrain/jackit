import { tv } from 'tailwind-variants'

export const slotRow = tv({
  slots: {
    root: 'group flex items-center gap-2.5 px-3 py-2 rounded-[4px] transition-colors',
    labelGroup: 'flex items-center gap-1.5 shrink-0',
    label: 'text-[12px] font-medium text-foreground',
    currentBadge: 'text-[9px] px-1.5 py-0.5 rounded-[2px] bg-primary text-white leading-none',
    driftBadge: 'inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-[8px] bg-amber-100 text-amber-700 leading-none whitespace-nowrap',
    contextSelect: 'text-[11px] px-1.5 py-1 rounded-[2px] border border-border bg-sidebar text-foreground w-[55px]',
    applyButton: 'text-[11px] px-2.5 py-1 rounded-[2px] bg-primary text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer',
    modelString: 'text-[10px] font-mono text-muted shrink-0',
  },
  variants: {
    isCurrent: {
      true: { root: 'border-2 border-primary bg-primary/5' },
      false: { root: 'border border-border-light bg-card hover:bg-sidebar/30' },
    },
    isBoundCtx: {
      false: { contextSelect: 'opacity-40 cursor-not-allowed' },
      true: { contextSelect: '' },
    },
  },
})
