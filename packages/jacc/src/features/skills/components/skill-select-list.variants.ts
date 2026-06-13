import { tv } from 'tailwind-variants'

export const skillSelectList = tv({
  slots: {
    root: 'flex flex-col gap-1.5 max-h-[200px] overflow-y-auto',
    item: 'flex items-center gap-2 px-3 py-2 rounded-[4px] cursor-pointer border',
    checkbox: 'accent-success',
    name: 'text-xs font-medium text-foreground',
    description: 'text-[10px] text-muted',
  },
  variants: {
    selected: {
      true: { item: 'bg-success-light border-success/30' },
      false: { item: 'bg-sidebar border-border' },
    },
  },
})
