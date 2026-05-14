import { tv } from 'tailwind-variants'

export const waveformCanvas = tv({
  slots: {
    error: 'text-text-secondary text-center p-10 text-xs',
    errorDetail: 'text-[11px]',
    canvas: 'w-full h-full block',
  },
})
