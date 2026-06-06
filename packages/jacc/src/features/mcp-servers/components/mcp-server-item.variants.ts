import { tv } from 'tailwind-variants'

export const mcpServerItem = tv({
  slots: {
    root: 'bg-card border rounded-[4px] overflow-hidden',
    header: 'flex items-center justify-between px-4 py-3 cursor-pointer',
    statusDot: 'w-2 h-2 bg-success rounded-full',
    nameContainer: 'flex items-center gap-2.5',
    name: 'text-[13px] font-medium text-foreground',
    commandPreview: 'text-[11px] text-muted',
    headerRight: 'flex items-center gap-2',
    chevron: 'text-muted',
    content: 'px-4 pb-3.5 border-t border-border-light',
    contentInner: 'flex flex-col gap-2.5 pt-3',
    fieldLabel: 'text-[11px] text-muted mb-1',
    input: 'w-full bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground',
    envContainer: 'bg-sidebar border border-border rounded-[2px] p-2',
    envRow: 'flex gap-2 items-center mb-1',
    envKey: 'flex-1 bg-card border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground',
    envEquals: 'text-muted',
    envValue: 'flex-1 bg-card border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground',
    deleteButton: 'text-[11px] px-3 py-1.5 border border-border text-danger rounded-[2px] hover:bg-danger-light',
    buttonContainer: 'flex justify-end mt-1',
  },
  variants: {
    expanded: {
      true: { root: 'border-primary' },
      false: { root: 'border-border-light' },
    },
  },
})
