import { tv } from 'tailwind-variants'

export const sourceBadge = tv({
  slots: {
    root: 'inline-flex items-center px-1.5 py-0.5 text-[9px] rounded-[8px] whitespace-nowrap',
  },
  variants: {
    scope: {
      global: {
        root: 'bg-border text-muted',
      },
      project: {
        root: 'bg-primary-light text-primary',
      },
      user: {
        root: 'bg-border text-muted-foreground',
      },
      plugin: {
        root: 'bg-border text-muted-foreground',
      },
      models: {
        root: 'bg-success-light text-success',
      },
      shared: {
        root: 'bg-border text-muted',
      },
      local: {
        root: 'bg-success-light text-success',
      },
    },
  },
})
