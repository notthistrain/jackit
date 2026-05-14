import { tv } from 'tailwind-variants'

export const serialConfigForm = tv({
  slots: {
    row: 'flex items-center gap-2',
    label: 'text-[10px] text-text-secondary text-right w-[70px] shrink-0',
    select: 'flex-1 px-1.5 py-[3px] text-[11px] bg-[#3c3c3c] text-text border border-[#4c4c4c] rounded-sm outline-none',
    compactSelect: 'flex-1 px-1.5 py-[3px] text-[10px] bg-[#3c3c3c] text-text border border-[#4c4c4c] rounded-sm outline-none text-center',
    portRow: 'flex-1 flex gap-1',
  },
})
