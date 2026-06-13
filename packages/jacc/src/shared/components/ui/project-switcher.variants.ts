import { tv } from 'tailwind-variants'

export const projectSwitcher = tv({
  slots: {
    root: 'relative px-3 pt-3 pb-2 border-b border-border',
    trigger: 'w-full px-2.5 py-1.5 bg-card border border-border rounded-[4px] flex items-center justify-between cursor-pointer hover:border-muted',
    triggerLeft: 'text-left',
    triggerLabel: 'text-[11px] text-muted',
    triggerValue: 'text-xs font-medium text-foreground truncate',
    triggerIcon: 'text-muted shrink-0',
    dropdown: 'absolute left-3 right-3 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-50 overflow-hidden',
    currentSection: 'px-3 py-2 bg-primary-light border-b border-border',
    currentLabel: 'text-[11px] text-primary',
    currentName: 'text-xs font-medium text-foreground truncate',
    currentPath: 'text-[10px] text-muted truncate',
    listSection: 'py-1.5',
    listTitle: 'px-3 py-1 text-[10px] text-muted',
    listItem: 'px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-border/30',
    listItemIcon: 'text-muted shrink-0',
    listItemContent: 'flex-1 min-w-0',
    listItemName: 'text-xs text-foreground truncate',
    listItemPath: 'text-[10px] text-muted truncate',
    pinButton: 'text-muted hover:text-foreground',
    footer: 'border-t border-border px-3 py-2',
    footerButton: 'text-xs text-primary cursor-pointer hover:underline',
  },
})
