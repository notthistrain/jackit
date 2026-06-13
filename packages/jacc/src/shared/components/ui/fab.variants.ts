import { tv } from 'tailwind-variants'

export const fab = tv({
  slots: {
    root: 'fixed bottom-5 right-6 w-11 h-11 rounded-full bg-primary text-white shadow-lg flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity cursor-pointer',
  },
})
