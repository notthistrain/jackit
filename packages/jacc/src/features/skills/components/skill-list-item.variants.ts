import { tv } from 'tailwind-variants'

export const skillListItem = tv({
  slots: {
    root: 'flex items-center justify-between px-3.5 py-2.5 bg-card border border-border-light rounded-[4px]',
    main: 'flex items-center gap-2.5 min-w-0',
    icon: 'w-9 h-9 bg-success-light rounded-[4px] flex items-center justify-center text-base shrink-0',
    info: 'min-w-0',
    name: 'text-[13px] font-medium text-foreground',
    description: 'text-[11px] text-muted truncate max-w-[300px]',
    actions: 'flex items-center gap-2 shrink-0',
    readonly: 'text-[10px] text-muted',
    toggle: 'w-9 h-5 rounded-full relative transition-colors',
    knob: 'w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all',
  },
  variants: {
    enabled: {
      true: {
        toggle: 'bg-success',
        knob: 'right-0.5',
      },
      false: {
        toggle: 'bg-border',
        knob: 'left-0.5',
      },
    },
    toggling: {
      true: {
        toggle: 'opacity-50',
      },
    },
  },
})
