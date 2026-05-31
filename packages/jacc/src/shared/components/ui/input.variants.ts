import { tv } from 'tailwind-variants'

export const input = tv({
  slots: {
    root: 'w-full bg-sidebar border border-border rounded-[4px] text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
    label: 'text-[11px] text-muted mb-1 block',
    error: 'text-[11px] text-danger mt-1',
  },
  variants: {
    size: {
      sm: {
        root: 'px-2 py-1',
      },
      md: {
        root: 'px-3 py-2',
      },
    },
    hasError: {
      true: {
        root: 'border-danger focus:ring-danger',
      },
    },
    disabled: {
      true: {
        root: 'opacity-50 cursor-not-allowed',
      },
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
