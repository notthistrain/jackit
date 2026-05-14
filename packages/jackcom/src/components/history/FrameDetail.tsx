import type { DisplayFrame } from '@/lib/tauri-events'

interface FrameDetailProps {
  frame: DisplayFrame
}

export function FrameDetail({ frame }: FrameDetailProps) {
  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--color-sidebar-bg)',
      borderTop: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
        Frame #{frame.id} · {frame.timestamp}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-text)', fontFamily: 'Consolas, monospace', wordBreak: 'break-all' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginBottom: '2px' }}>HEX:</div>
        <div style={{ color: 'var(--color-rx)' }}>{frame.raw_hex}</div>
      </div>
      {frame.formatted && (
        <div style={{ marginTop: '4px', fontSize: '11px', fontFamily: 'Consolas, monospace' }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginBottom: '2px' }}>Parsed:</div>
          <div style={{ color: 'var(--color-text)' }}>{frame.formatted}</div>
        </div>
      )}
      {frame.summary && (
        <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
          {frame.summary}
        </div>
      )}
    </div>
  )
}
