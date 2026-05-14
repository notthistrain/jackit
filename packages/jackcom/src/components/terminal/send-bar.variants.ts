import { tv } from 'tailwind-variants'

export const sendBar = tv({
  slots: {
    root: 'bg-sidebar-bg border-t border-border px-2.5 py-1.5 flex flex-col gap-1',
    optionsRow: 'flex gap-1.5 items-center text-[11px]',
    modeBtn: 'border-none px-1.5 py-[1px] rounded-sm cursor-pointer font-semibold text-[10px]',
    separator: 'text-border',
    lineEndingBtn: 'border-none px-1 py-[1px] rounded-sm cursor-pointer text-[10px]',
    inputRow: 'flex gap-1.5',
    input: 'flex-1 bg-editor-bg border rounded-sm px-2 py-1 text-text font-mono text-xs outline-none',
    sendBtn: 'bg-accent text-white border-none px-5 py-1 rounded-sm font-bold text-[11px]',
  },
  variants: {
    active: {
      true: { modeBtn: 'bg-accent text-white' },
      false: { modeBtn: 'bg-transparent text-text-secondary' },
    },
    lineEndingActive: {
      true: { lineEndingBtn: 'bg-border text-text' },
      false: { lineEndingBtn: 'bg-transparent text-text-secondary' },
    },
    error: {
      true: { input: 'border-error' },
      false: { input: 'border-border' },
    },
    disabled: {
      true: { sendBtn: 'cursor-not-allowed opacity-50' },
      false: { sendBtn: 'cursor-pointer opacity-100' },
    },
  },
})
