import { tv } from 'tailwind-variants'

export const permissionTableVariants = tv({
  slots: {
    root: 'mb-5',
    title: 'text-xs font-semibold mb-2 flex items-center gap-1.5',
    table: 'bg-card border border-border-light rounded-[4px] overflow-hidden',
    header: 'flex px-3.5 py-2 bg-sidebar border-b border-border-light text-[11px] text-muted font-medium',
    headerType: 'w-[50px]',
    headerTool: 'w-[50px]',
    headerPattern: 'flex-1',
    headerSource: 'w-[50px] text-center',
    headerAction: 'w-[30px]',
    row: 'flex items-center px-3.5 py-2 border-b border-border-light/50',
    cellType: 'w-[50px]',
    cellTool: 'w-[50px] text-[11px] text-muted-foreground',
    cellPattern: 'flex-1 text-[11px] font-mono text-foreground',
    cellSource: 'w-[50px] text-center',
    cellAction: 'w-[30px] text-center',
    badge: 'text-[10px] px-1.5 py-0.5 rounded-[2px]',
    deleteButton: 'text-border hover:text-danger text-xs',
    empty: 'px-3.5 py-3 text-[11px] text-muted text-center',
  },
  variants: {
    kind: {
      allow: {
        title: 'text-success',
        badge: 'bg-success-light text-success',
      },
      deny: {
        title: 'text-danger',
        badge: 'bg-danger-light text-danger',
      },
    },
  },
  defaultVariants: {
    kind: 'allow',
  },
})
