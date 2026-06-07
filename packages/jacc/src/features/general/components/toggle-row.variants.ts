import { tv } from 'tailwind-variants'

export const toggleRow = tv({
  slots: {
    root: 'flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]',
    info: '',
    label: 'text-[13px] font-medium text-foreground',
    description: 'text-[11px] text-muted',
    actions: 'flex items-center gap-2',
    track: 'w-9 h-5 rounded-full relative transition-colors',
    knob: 'w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all',
  },
  variants: {
    checked: {
      true: { track: 'bg-primary', knob: 'right-0.5' },
      false: { track: 'bg-border', knob: 'left-0.5' },
    },
  },
})
