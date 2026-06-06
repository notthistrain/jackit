import { tv } from 'tailwind-variants'

export const modelNode = tv({
  slots: {
    root: 'flex items-center justify-between pl-24 pr-3 py-2 hover:bg-sidebar/50 rounded-[4px]',
    info: 'min-w-0 flex-1 mr-3',
    nameRow: 'flex items-center gap-2',
    name: 'text-[12px] text-foreground font-medium',
    ctx: 'text-[10px] text-muted',
    result: 'text-[10px] mt-0.5 truncate',
    actions: 'flex gap-1 shrink-0',
    testBtn: 'text-[11px] px-2 py-1 border border-border rounded-[2px] cursor-pointer bg-card text-foreground hover:bg-sidebar disabled:opacity-50',
    ghostBtn: 'text-[11px] px-2 py-1 border border-border rounded-[2px] cursor-pointer text-muted hover:bg-sidebar hover:text-foreground',
    dangerBtn: 'text-[11px] px-2 py-1 border border-border rounded-[2px] cursor-pointer text-muted hover:bg-danger/10 hover:text-danger',
  },
  variants: {
    resultOk: { true: { result: 'text-success' }, false: { result: 'text-danger' } },
  },
})
