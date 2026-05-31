import { tv } from 'tailwind-variants'

export const button = tv({
  slots: {
    root: 'inline-flex items-center justify-center rounded-[4px] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  },
  variants: {
    variant: {
      primary: {
        root: 'bg-primary text-white hover:bg-primary/90',
      },
      ghost: {
        root: 'text-muted hover:bg-sidebar hover:text-foreground border border-border',
      },
      danger: {
        root: 'text-muted hover:bg-danger/10 hover:text-danger border border-border',
      },
    },
    size: {
      sm: {
        root: 'px-2 py-1 text-[11px]',
      },
      md: {
        root: 'px-3 py-2 text-xs',
      },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})
