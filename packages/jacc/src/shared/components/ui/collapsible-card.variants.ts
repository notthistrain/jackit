import { tv } from 'tailwind-variants'

export const collapsibleCard = tv({
  slots: {
    root: 'bg-card border rounded-[4px] overflow-hidden',
    header: 'flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar/30',
    headerLeft: 'flex items-center gap-2.5 min-w-0 flex-1',
    headerRight: 'flex items-center gap-2 shrink-0',
    icon: 'text-muted shrink-0',
    content: 'border-t border-border-light',
  },
  variants: {
    expanded: {
      true: {
        root: 'border-primary',
      },
      false: {
        root: 'border-border-light',
      },
    },
  },
  defaultVariants: {
    expanded: false,
  },
})
