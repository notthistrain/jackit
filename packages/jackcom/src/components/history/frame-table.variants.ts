import { tv } from 'tailwind-variants'

export const frameTable = tv({
  slots: {
    empty: 'flex-1 flex items-center justify-center text-text-secondary text-[11px]',
    root: 'flex-1 overflow-auto bg-editor-bg',
    header: 'flex px-2.5 py-1 bg-sidebar-bg text-text-secondary text-[10px] border-b border-border sticky top-0 z-[1]',
    headerTime: 'w-[90px]',
    headerDir: 'w-[30px]',
    headerProto: 'w-[60px]',
    headerData: 'flex-1',
    row: 'flex px-2.5 py-[3px] border-b border-[#2d2d2d] cursor-pointer data-[expanded=true]:bg-[#2a2d2e] data-[expanded=false]:bg-transparent',
    cellTime: 'w-[90px] text-text-secondary text-[11px]',
    cellDir: 'w-[30px] text-[11px] font-semibold',
    cellProto: 'w-[60px] text-[11px]',
    cellData: 'flex-1 text-text text-[11px] overflow-hidden text-ellipsis whitespace-nowrap',
    cellSummary: 'text-text-secondary ml-2',
  },
})
