import { tv } from 'tailwind-variants'

export const providerNode = tv({
  slots: {
    root: 'bg-card border border-border-light rounded-[4px]',
    header: 'flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar/30 rounded-[4px]',
    chevron: 'text-muted shrink-0',
    info: 'flex items-center gap-2 min-w-0 flex-1',
    infoBox: 'min-w-0',
    name: 'text-[13px] font-medium text-foreground truncate',
    url: 'text-[11px] text-muted truncate',
    actions: 'flex gap-1 shrink-0',
    addIcon: 'inline -mt-0.5 mr-0.5',
    deleteIcon: 'inline -mt-0.5',
    list: 'pb-2 flex flex-col gap-0.5',
    empty: 'pl-12 pr-3 py-2 text-[11px] text-muted',
    ghostBtn: 'text-muted hover:bg-sidebar hover:text-foreground',
    dangerBtn: 'text-muted hover:bg-danger/10 hover:text-danger',
  },
  compoundSlots: [
    {
      slots: ['ghostBtn', 'dangerBtn'],
      class: 'text-[11px] px-2 py-1 border border-border rounded-[2px] cursor-pointer',
    },
  ],
})
