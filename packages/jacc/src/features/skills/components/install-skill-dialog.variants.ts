import { tv } from 'tailwind-variants'

export const installSkillDialog = tv({
  slots: {
    section: 'mb-4',
    label: 'text-[11px] text-muted mb-1',
    fetchRow: 'flex gap-2',
    statusBox: 'mb-4 px-3.5 py-2.5 bg-sidebar border border-border-light rounded-[4px] text-[11px] text-muted',
    errorBox: 'mb-4 px-3.5 py-2.5 bg-danger-light border border-danger/30 rounded-[4px] text-[11px] text-danger',
    selectLabel: 'text-[11px] text-muted mb-2',
    footer: 'flex justify-end gap-2',
  },
})
