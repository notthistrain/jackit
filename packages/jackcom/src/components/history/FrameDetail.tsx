import type { DisplayFrame } from '@/lib/tauri-events'
import { frameDetail } from './frame-detail.variants'

interface FrameDetailProps {
  frame: DisplayFrame
}

export function FrameDetail({ frame }: FrameDetailProps) {
  const { root, header, hexSection, hexLabel, hexData, parsedSection, parsedLabel, parsedData, summary } = frameDetail()

  return (
    <div className={root()}>
      <div className={header()}>
        Frame #{frame.id} · {frame.timestamp}
      </div>
      <div className={hexSection()}>
        <div className={hexLabel()}>HEX:</div>
        <div className={hexData()}>{frame.raw_hex}</div>
      </div>
      {frame.formatted && (
        <div className={parsedSection()}>
          <div className={parsedLabel()}>Parsed:</div>
          <div className={parsedData()}>{frame.formatted}</div>
        </div>
      )}
      {frame.summary && (
        <div className={summary()}>
          {frame.summary}
        </div>
      )}
    </div>
  )
}
