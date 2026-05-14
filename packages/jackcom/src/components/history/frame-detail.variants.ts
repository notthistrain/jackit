import { tv } from 'tailwind-variants'

export const frameDetail = tv({
  slots: {
    root: 'px-2.5 py-2 bg-sidebar-bg border-t border-border',
    header: 'text-[10px] text-text-secondary mb-1',
    hexSection: 'text-[11px] text-text font-mono break-all',
    hexLabel: 'text-text-secondary text-[10px] mb-[2px]',
    hexData: 'text-rx',
    parsedSection: 'mt-1 text-[11px] font-mono',
    parsedLabel: 'text-text-secondary text-[10px] mb-[2px]',
    parsedData: 'text-text',
    summary: 'mt-1 text-[10px] text-text-secondary',
  },
})
