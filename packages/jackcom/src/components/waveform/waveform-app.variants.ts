import { tv } from 'tailwind-variants'

export const waveformApp = tv({
  slots: {
    root: 'h-screen bg-[var(--color-editor-bg)] text-[var(--color-text)] flex flex-col font-[system-ui]',
    waveformArea: 'flex-1 relative overflow-hidden',
    emptyState: 'text-[var(--color-text-secondary)] text-center mt-10',
    toolbar: 'bg-[var(--color-sidebar-bg)] border-t border-[var(--color-border)] px-2.5 py-1 flex gap-3 text-[10px] text-[var(--color-text-secondary)]',
    pauseBtn: 'border-none px-2 py-0.5 rounded-sm cursor-pointer text-[10px]',
    clearBtn: 'bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer text-[10px]',
    frameCount: 'ml-auto text-[10px]',
  },
  variants: {
    paused: {
      true: {
        pauseBtn: 'bg-[var(--color-accent)] text-white',
      },
      false: {
        pauseBtn: 'bg-transparent text-[var(--color-text-secondary)]',
      },
    },
  },
})
