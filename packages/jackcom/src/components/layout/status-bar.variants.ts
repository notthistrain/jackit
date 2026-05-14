import { tv } from 'tailwind-variants'

export const statusBar = tv({
  slots: {
    root: 'bg-accent px-3 py-[2px] flex gap-4 text-[11px] text-white',
    stats: 'ml-auto',
    encoding: '',
  },
})
