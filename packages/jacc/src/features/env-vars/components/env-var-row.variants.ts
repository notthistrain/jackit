import { tv } from 'tailwind-variants'

export const envVarRowVariants = tv({
  slots: {
    root: 'flex items-center px-3.5 py-2.5 border-b border-border-light/50',
    name: 'flex-[2] text-xs font-mono truncate pr-2',
    valueCell: 'flex-[3]',
    managedHint: 'flex-[3] text-[11px] text-muted italic',
    sourceCell: 'w-[50px] text-center',
    actionCell: 'w-[30px] text-center',
    deleteBtn: 'text-border hover:text-danger text-sm',
  },
  variants: {
    readOnly: {
      true: {
        root: 'opacity-50',
        name: 'text-muted',
      },
      false: {
        name: 'font-medium text-foreground',
      },
    },
  },
  defaultVariants: {
    readOnly: false,
  },
})
