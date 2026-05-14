import { tv } from 'tailwind-variants'

export const activityBar = tv({
  slots: {
    root: 'w-10 bg-titlebar-bg border-r border-border flex flex-col items-center pt-1 gap-0.5',
    item: 'text-lg p-1.5 cursor-pointer border-l-2 data-[active=true]:border-accent data-[active=true]:opacity-100 data-[active=false]:border-transparent data-[active=false]:opacity-60',
  },
})
