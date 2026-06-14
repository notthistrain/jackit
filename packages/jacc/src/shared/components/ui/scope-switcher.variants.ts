import { tv } from 'tailwind-variants'

export const scopeSwitcher = tv({
  slots: {
    root: 'inline-flex items-center gap-2',
    label: 'text-[11px] text-muted-foreground',
    group: 'inline-flex rounded-[8px] border border-border overflow-hidden',
    option: 'px-2.5 py-1 text-[11px] transition-colors',
  },
  variants: {
    scope: { global: {}, project: {} },
    active: { true: {}, false: { option: 'bg-transparent text-muted-foreground' } },
  },
  compoundVariants: [
    { scope: 'global', active: true, class: { option: 'bg-primary-light text-primary' } },
    { scope: 'project', active: true, class: { option: 'bg-success-light text-success' } },
  ],
})
