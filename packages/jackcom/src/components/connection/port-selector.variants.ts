import { tv } from 'tailwind-variants'

export const portSelector = tv({
  slots: {
    root: 'flex flex-col gap-1',
    row: 'flex gap-1.5 items-center',
    select: 'flex-1 px-2 py-1 text-xs bg-editor-bg text-text border border-border rounded-sm outline-none',
    refreshBtn: 'px-2 py-1 text-[11px] bg-border text-text border border-border rounded-sm',
    error: 'text-[11px] text-error',
  },
  variants: {
    loading: {
      true: { refreshBtn: 'cursor-not-allowed opacity-50' },
      false: { refreshBtn: 'cursor-pointer opacity-100' },
    },
  },
})
