import { tv } from 'tailwind-variants'

export const dialog = tv({
  slots: {
    overlay: 'fixed inset-0 bg-black/30 flex items-center justify-center z-50',
    content: 'bg-card border border-border rounded-[4px] shadow-xl',
    header: 'px-6 pt-6 pb-4',
    title: 'text-[15px] font-medium text-foreground',
    body: 'px-6 pb-4',
    footer: 'px-6 pb-6 flex justify-end gap-2',
  },
  variants: {
    size: {
      sm: {
        content: 'w-[320px]',
      },
      md: {
        content: 'w-[400px]',
      },
      lg: {
        content: 'w-[600px]',
      },
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
