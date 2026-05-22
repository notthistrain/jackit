import { tv } from 'tailwind-variants'

export const waveformCanvas = tv({
  slots: {
    error: 'text-text-secondary text-center p-10 text-xs',
    errorDetail: 'text-[11px]',
    canvas: 'w-full h-full block',
    container: 'relative w-full h-full',
    overlay: 'absolute inset-0 pointer-events-none',
    gridLineH: 'border-t border-white/[0.06]',
    gridLineV: 'h-full border-l border-white/[0.06]',
    yAxisLabel: 'absolute left-1 top-0.5 text-[9px] text-text-secondary font-mono',
    xAxisLabel: 'absolute bottom-0.5 text-[9px] text-text-secondary font-mono',
    legend: 'absolute right-1 top-1 flex flex-col gap-[1px]',
    legendItem: 'text-[9px] font-mono',
    legendMore: 'text-[9px] text-text-secondary font-mono',
    tooltip: 'absolute bg-[rgba(30,30,30,0.95)] border border-border rounded px-2 py-1 text-[10px] font-mono text-text pointer-events-none whitespace-nowrap z-10',
    tooltipIndex: 'text-text-secondary mb-0.5',
    tooltipValue: '',
  },
})
