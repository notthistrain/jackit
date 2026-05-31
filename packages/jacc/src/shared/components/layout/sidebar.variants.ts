import { tv } from 'tailwind-variants'

export const sidebar = tv({
  slots: {
    root: 'w-[180px] bg-sidebar border-r border-border flex flex-col h-full',
    nav: 'flex-1 py-2 overflow-y-auto',
    sectionTitle: 'px-3 py-1 text-[10px] text-muted uppercase tracking-wider',
    navItem: 'w-full text-left px-4 py-[7px] mx-2 text-xs flex items-center gap-2 rounded-[4px] cursor-pointer',
    footer: 'px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted',
    themeButton: 'cursor-pointer hover:text-foreground flex items-center gap-1',
  },
  variants: {
    active: {
      true: {
        navItem: 'bg-card text-foreground shadow-sm',
      },
      false: {
        navItem: 'text-muted-foreground hover:text-foreground hover:bg-card/50',
      },
    },
  },
})
