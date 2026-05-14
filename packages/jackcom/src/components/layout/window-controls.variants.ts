import { tv } from 'tailwind-variants'

export const windowControls = tv({
  slots: {
    root: 'flex h-full',
    btn: 'w-[46px] h-full flex items-center justify-center cursor-pointer',
  },
})
