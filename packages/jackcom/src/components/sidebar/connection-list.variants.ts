import { tv } from 'tailwind-variants'

export const connectionList = tv({
  slots: {
    empty: 'px-2 py-3 text-text-secondary text-[11px]',
    list: 'p-1',
    item: 'px-2 py-1.5 mb-[2px] rounded-sm cursor-pointer data-[active=true]:bg-border data-[online=true]:border-l-[3px] data-[online=true]:border-l-online data-[online=false]:border-l-[3px] data-[online=false]:border-l-transparent',
    row: 'flex items-center gap-1.5',
    statusDot: 'text-[8px]',
    portName: 'font-semibold text-xs',
    baudRate: 'ml-auto text-text-secondary text-[10px]',
  },
})
