import { tv } from 'tailwind-variants'

export const titleBar = tv({
  slots: {
    root: 'h-[30px] bg-titlebar-bg border-b border-border flex items-center text-[13px] select-none',
    brand: 'flex items-center gap-1.5 px-2.5 h-full shrink-0',
    brandIcon: 'text-accent text-sm',
    brandText: 'text-xs font-semibold text-text',
    menuArea: 'flex h-full flex-1',
    menuContainer: 'relative h-full',
    menuTrigger: 'px-2.5 h-full flex items-center cursor-pointer text-xs rounded-t-sm data-[open=true]:text-text data-[open=true]:bg-menu-bg data-[open=false]:text-text-secondary data-[open=false]:bg-transparent',
  },
})
