import { tv } from 'tailwind-variants'

export const layout = tv({
  slots: {
    root: 'h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden',
    body: 'flex flex-1 overflow-hidden',
    main: 'flex-1 overflow-y-auto relative',
  },
})
