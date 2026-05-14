import { tv } from 'tailwind-variants'

export const appLayout = tv({
  slots: {
    root: 'flex flex-col h-screen bg-editor-bg text-text',
    mainRow: 'flex-1 flex overflow-hidden',
    contentCol: 'flex-1 flex flex-col overflow-hidden',
    contentArea: 'flex-1 overflow-hidden',
  },
})
