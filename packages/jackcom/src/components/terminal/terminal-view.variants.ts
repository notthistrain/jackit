import { tv } from 'tailwind-variants'

export const terminalView = tv({
  slots: {
    root: 'flex-1 overflow-auto bg-editor-bg relative',
    inner: 'w-full relative',
    row: 'absolute top-0 left-0 w-full',
  },
})
