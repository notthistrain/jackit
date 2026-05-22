import type { TooltipData } from './useWaveformInteraction'
import { cn } from '@/lib/utils'
import { CHANNEL_COLORS } from './channel-colors'
import { waveformCanvas } from './waveform-canvas.variants'

interface WaveformOverlayProps {
  channelNames: string[]
  viewportRange: { start: number, end: number }
  tooltip: TooltipData | null
  canvasWidth: number
}

export function WaveformOverlay({ channelNames, viewportRange, tooltip, canvasWidth }: WaveformOverlayProps) {
  const {
    overlay,
    gridLineH,
    gridLineV,
    yAxisLabel,
    xAxisLabel,
    legend,
    legendItem,
    legendMore,
    tooltip: tooltipCls,
    tooltipIndex,
    tooltipValue,
  } = waveformCanvas()

  return (
    <div className={overlay()}>
      {/* Y 轴网格线 + 标签 */}
      {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
        <div
          key={ratio}
          style={{ position: 'absolute', left: 0, right: 0, top: `${ratio * 100}%` }}
        >
          <div className={gridLineH()} />
          {ratio < 1 && (
            <span className={yAxisLabel()}>
              {Math.round((1 - ratio) * 255)}
            </span>
          )}
        </div>
      ))}

      {/* X 轴网格线 + 标签 */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const index = Math.round(viewportRange.start + (viewportRange.end - viewportRange.start) * ratio)
        return (
          <div
            key={`x-${ratio}`}
            style={{ position: 'absolute', top: 0, bottom: 0, left: `${ratio * 100}%` }}
          >
            <div className={gridLineV()} />
            <span
              className={xAxisLabel()}
              style={ratio === 1 ? { right: 3 } : { left: 3 }}
            >
              {index}
            </span>
          </div>
        )
      })}

      {/* 通道图例 */}
      {channelNames.length > 0 && (
        <div className={legend()}>
          {channelNames.slice(0, CHANNEL_COLORS.length).map((name, i) => (
            <span
              key={name}
              className={cn(legendItem(), `text-[${CHANNEL_COLORS[i % CHANNEL_COLORS.length]}]`)}
              style={{ color: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }}
            >
              {name}
            </span>
          ))}
          {channelNames.length > CHANNEL_COLORS.length && (
            <span className={legendMore()}>
              +
              {channelNames.length - CHANNEL_COLORS.length}
              {' '}
              more
            </span>
          )}
        </div>
      )}

      {/* 悬浮数据提示 */}
      {tooltip && (
        <div
          className={tooltipCls()}
          style={{
            left: Math.min(tooltip.x + 12, canvasWidth - 160),
            top: Math.max(tooltip.y - 60, 4),
          }}
        >
          <div className={tooltipIndex()}>
            #
            {tooltip.index}
          </div>
          {tooltip.values.slice(0, CHANNEL_COLORS.length).map(v => (
            <div
              key={v.channel}
              className={tooltipValue()}
              style={{ color: CHANNEL_COLORS[v.channelIndex % CHANNEL_COLORS.length] }}
            >
              {v.channel}
              :
              {Math.round(v.value * 255)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
