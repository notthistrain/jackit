import { tv } from 'tailwind-variants'

export const serialConfigForm = tv({
  slots: {
    row: 'flex items-center gap-2',
    label: 'text-[10px] text-text-secondary text-right w-[70px] shrink-0',
    portRow: 'flex-1 flex gap-1',
  },
})
