import { tv } from 'tailwind-variants'

export const filterBar = tv({
  slots: {
    root: 'px-2.5 py-1 bg-sidebar-bg border-b border-border flex gap-2 items-center',
    label: 'text-text-secondary text-[10px]',
    pill: 'border-none rounded-sm text-[10px] cursor-pointer',
    separator: 'text-border',
  },
  variants: {
    active: {
      true: { pill: 'bg-accent text-white' },
      false: { pill: 'bg-transparent text-text-secondary' },
    },
  },
})
