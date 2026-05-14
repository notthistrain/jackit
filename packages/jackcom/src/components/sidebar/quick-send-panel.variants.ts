import { tv } from 'tailwind-variants'

export const quickSendPanel = tv({
  slots: {
    root: 'flex flex-col h-full',
    list: 'flex-1 overflow-auto p-1',
    empty: 'p-2 text-text-secondary text-[11px]',
    snippet: 'px-2 py-1.5 mb-[2px] rounded-sm bg-editor-bg flex items-center gap-1.5',
    snippetInfo: 'flex-1 min-w-0',
    snippetName: 'text-[11px] font-semibold',
    snippetData: 'text-[10px] text-text-secondary font-mono overflow-hidden text-ellipsis whitespace-nowrap',
    sendBtn: 'bg-transparent border-none text-[11px] px-1 py-0.5',
    deleteBtn: 'bg-transparent border-none text-text-secondary cursor-pointer text-[11px] px-1 py-0.5',
    addForm: 'p-2 border-t border-border flex flex-col gap-1 text-[11px]',
    addInput: 'bg-editor-bg border border-border rounded-sm px-1.5 py-[3px] text-text text-[11px] outline-none',
    addActions: 'flex gap-1',
    confirmBtn: 'bg-accent text-white border-none px-2 py-[2px] rounded-sm cursor-pointer text-[10px]',
    cancelFormBtn: 'bg-transparent border border-border text-text-secondary px-2 py-[2px] rounded-sm cursor-pointer text-[10px]',
    addButton: 'bg-transparent border-none text-accent cursor-pointer p-1.5 text-[11px]',
  },
  variants: {
    active: {
      true: { sendBtn: 'text-accent cursor-pointer opacity-100' },
      false: { sendBtn: 'text-text-secondary cursor-not-allowed opacity-50' },
    },
    adding: {
      true: { addButton: 'border-t-0' },
      false: { addButton: 'border-t border-border' },
    },
    mono: {
      true: { addInput: 'font-mono' },
    },
  },
})
