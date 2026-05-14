import { tv } from 'tailwind-variants'

export const terminalLine = tv({
  slots: {
    root: 'flex gap-2 px-1.5 py-[1px] text-xs font-mono leading-6 whitespace-nowrap',
    timestamp: 'text-timestamp min-w-[100px]',
    direction: 'font-bold min-w-[20px]',
    data: 'text-text flex-1 overflow-hidden text-ellipsis',
  },
})
