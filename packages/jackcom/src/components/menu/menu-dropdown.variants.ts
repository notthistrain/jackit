import { tv } from 'tailwind-variants'

export const menuDropdown = tv({
  slots: {
    root: 'absolute top-full left-0 bg-menu-bg border border-border rounded-md py-1 min-w-[180px] z-[1000] shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
  },
})
