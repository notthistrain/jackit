import { tv } from 'tailwind-variants'

export const emptyState = tv({
  slots: {
    root: 'flex flex-col items-center justify-center h-full',
    icon: 'text-muted mb-3',
    title: 'text-sm font-medium text-foreground mb-1.5',
    description: 'text-xs text-muted mb-4',
    button: 'px-5 py-2 bg-primary text-white text-xs rounded-[4px] cursor-pointer hover:opacity-90',
  },
})
