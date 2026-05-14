import { tv } from 'tailwind-variants'

export const sessionList = tv({
  slots: {
    empty: 'flex-1 flex items-center justify-center text-text-secondary text-[11px] p-5 text-center',
    root: 'flex-1 overflow-auto',
    item: 'px-2.5 py-1.5 cursor-pointer border-b border-border data-[selected=true]:bg-accent data-[selected=false]:bg-transparent',
    portInfo: 'font-semibold text-text text-[11px]',
    time: 'text-text-secondary text-[10px]',
  },
})
