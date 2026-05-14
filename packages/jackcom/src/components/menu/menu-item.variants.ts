import { tv } from 'tailwind-variants'

export const menuItem = tv({
  slots: {
    separator: 'h-px bg-border mx-2 my-1',
    item: 'px-3 py-1 pl-3 flex items-center gap-6 text-xs rounded-sm mx-1 data-[disabled=true]:opacity-50 data-[disabled=true]:text-text-secondary data-[disabled=true]:cursor-default data-[disabled=false]:cursor-pointer data-[disabled=false]:text-text hover:bg-accent hover:text-white',
    label: 'flex-1',
    shortcut: 'text-[11px] text-text-secondary ml-auto',
  },
})
