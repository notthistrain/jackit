import { tv } from 'tailwind-variants'

export const connectionDialog = tv({
  slots: {
    overlay: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]',
    dialog: 'bg-editor-bg rounded-md overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)] min-w-[480px] font-sans text-[11px] text-text',
    titleBar: 'bg-titlebar-bg px-3 py-2 flex items-center border-b border-border',
    titleText: 'text-accent font-semibold text-xs',
    closeBtn: 'ml-auto text-text-secondary cursor-pointer text-sm bg-transparent border-none px-0.5 leading-none',
    body: 'flex min-h-[200px]',
    recentList: 'w-40 border-r border-border p-2.5',
    recentHeader: 'text-text-secondary text-[10px] font-bold tracking-wide mb-2',
    recentItem: 'rounded-sm px-2 py-1.5 mb-[3px] cursor-pointer',
    recentPort: 'text-text text-[11px] font-semibold',
    recentDetail: 'text-text-secondary text-[10px]',
    configArea: 'flex-1 p-3 flex flex-col gap-2',
    error: 'text-[11px] text-error px-2 py-1 bg-error/10 rounded-sm',
    spacer: 'flex-1',
    actions: 'flex justify-end gap-2',
    cancelBtn: 'bg-transparent border border-[#4c4c4c] rounded-sm px-3.5 py-1 text-text-secondary text-[10px] cursor-pointer',
    connectBtn: 'rounded-sm px-3.5 py-1 text-[10px] font-semibold',
  },
  variants: {
    hovered: {
      true: { recentItem: 'bg-accent' },
      false: { recentItem: 'bg-[#2a2d2e]' },
    },
    disabled: {
      true: { connectBtn: 'opacity-60 cursor-not-allowed' },
      false: { connectBtn: 'bg-accent text-white cursor-pointer' },
    },
  },
})
