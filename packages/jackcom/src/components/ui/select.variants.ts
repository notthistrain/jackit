import { tv } from 'tailwind-variants'

export const select = tv({
  slots: {
    root: 'relative',
    trigger: 'flex items-center justify-between bg-input-bg text-text border border-input-border rounded-sm outline-none cursor-pointer',
    arrow: 'text-text-secondary ml-1 shrink-0',
    panel: 'absolute left-0 top-full mt-0.5 min-w-full bg-menu-bg border border-border rounded-sm shadow-lg py-0.5 z-[1000] overflow-hidden',
    option: 'px-2 py-1 cursor-pointer text-xs whitespace-nowrap',
  },
  variants: {
    size: {
      default: { trigger: 'px-2 py-1 text-xs' },
      compact: { trigger: 'px-1.5 py-[3px] text-[10px]' },
    },
    open: {
      true: { trigger: 'border-accent' },
    },
    selected: {
      true: { option: 'bg-accent/10 border-l-2 border-accent' },
      false: { option: 'border-l-2 border-transparent' },
    },
    hovered: {
      true: { option: 'bg-list-hover' },
    },
    disabled: {
      true: { option: 'opacity-50 cursor-not-allowed' },
    },
    triggerDisabled: {
      true: { trigger: 'opacity-50 cursor-not-allowed' },
    },
  },
})
