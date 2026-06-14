import { tv } from 'tailwind-variants'

export const envValueInput = tv({
  slots: {
    text: 'w-[90%] bg-sidebar border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground',
    select: 'bg-sidebar border border-border px-2 py-1 rounded-[2px] text-[11px] text-foreground',
    toggle: 'relative inline-flex items-center h-4 w-7 rounded-full transition-colors',
    toggleLabel: 'ml-2 text-[11px] text-muted-foreground',
    knob: 'inline-block h-3 w-3 rounded-full bg-white transition-transform',
  },
  variants: {
    on: {
      true: { toggle: 'bg-success', knob: 'translate-x-3.5' },
      false: { toggle: 'bg-border', knob: 'translate-x-0.5' },
    },
  },
})
