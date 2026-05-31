import { tv } from 'tailwind-variants'

export const titleBar = tv({
  slots: {
    root: 'h-8 flex items-center bg-sidebar border-b border-border select-none',
    title: 'pl-3 text-xs text-muted',
    dragRegion: 'flex-1 h-full',
    buttons: 'flex h-full',
    button: 'w-11 h-full flex items-center justify-center text-muted-foreground transition-colors',
  },
  variants: {
    buttonType: {
      minimize: {
        button: 'hover:bg-border/50',
      },
      maximize: {
        button: 'hover:bg-border/50',
      },
      close: {
        button: 'hover:bg-danger/80 hover:text-white',
      },
    },
  },
})
