import { tv } from 'tailwind-variants'

export const skillList = tv({
  slots: {
    loading: 'p-6 text-xs text-muted',
    root: 'p-6 pb-20',
    tabBar: 'flex items-center gap-4 mb-4',
    tab: 'text-sm font-medium pb-1 border-b-2 transition-colors',
    spacer: 'flex-1',
    searchWrap: 'relative',
    searchIcon: 'absolute left-2.5 top-1/2 -translate-y-1/2 text-muted',
    searchInput: 'bg-card border border-border pl-7 pr-3 py-1.5 rounded-[4px] text-xs text-foreground w-[160px]',
    list: 'flex flex-col gap-1.5',
    menu: 'fixed bottom-20 right-6 bg-card border border-border rounded-[4px] shadow-lg py-1 min-w-[140px] z-40',
    menuItem: 'w-full text-left px-3 py-2 text-xs text-foreground hover:bg-sidebar',
  },
  variants: {
    active: {
      true: {
        tab: 'text-foreground border-primary',
      },
      false: {
        tab: 'text-muted border-transparent hover:text-foreground',
      },
    },
  },
})
