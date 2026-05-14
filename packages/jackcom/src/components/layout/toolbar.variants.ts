import { tv } from 'tailwind-variants'

export const toolbar = tv({
  slots: {
    root: 'bg-titlebar-bg border-b border-border px-3 py-1 flex items-center gap-2 text-xs',
    connectBtn: 'border-none px-3.5 py-[3px] rounded-sm cursor-pointer font-semibold text-[11px] text-white',
    connInfo: 'text-text-secondary text-[11px]',
    separator: 'text-border mx-1',
    toolBtn: 'bg-transparent border-none text-text-secondary cursor-pointer text-[11px] px-1.5 py-0.5',
    windowBtn: 'bg-transparent border-none text-[11px] px-1.5 py-0.5',
    onlineIndicator: 'text-online text-[11px] font-semibold',
    spacer: 'ml-auto',
  },
  variants: {
    online: {
      true: { connectBtn: 'bg-accent' },
      false: { connectBtn: 'bg-border' },
    },
    active: {
      true: { windowBtn: 'text-accent cursor-pointer opacity-100' },
      false: { windowBtn: 'text-text-secondary cursor-not-allowed opacity-50' },
    },
  },
})
