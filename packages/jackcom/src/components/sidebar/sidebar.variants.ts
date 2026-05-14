import { tv } from 'tailwind-variants'

export const sidebar = tv({
  slots: {
    root: 'w-[200px] bg-sidebar-bg border-r border-border flex flex-col overflow-hidden',
    header: 'px-2.5 py-2 text-[11px] font-bold text-text-secondary tracking-wide border-b border-border',
    content: 'flex-1 overflow-auto',
  },
})
