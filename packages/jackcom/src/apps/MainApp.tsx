import { useState, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TerminalView } from '@/components/terminal/TerminalView'
import { SendBar } from '@/components/terminal/SendBar'
import { useMainStore } from '@/lib/store'
import type { DisplayFrame } from '@/components/terminal/TerminalView'

type PanelType = 'terminal' | 'table' | 'modbus' | 'atcmd'

const PANELS: { id: PanelType; label: string }[] = [
  { id: 'terminal', label: 'TERMINAL' },
  { id: 'table', label: 'TABLE' },
  { id: 'modbus', label: 'MODBUS' },
  { id: 'atcmd', label: 'AT CMD' },
]

export default function MainApp() {
  const { activePanel, setActivePanel } = useMainStore()
  const [frames, setFrames] = useState<DisplayFrame[]>([])

  const handleSend = useCallback((data: number[]) => {
    // TODO: 通过 Tauri invoke 发送数据（Plan 8 集成）
    // 当前仅本地模拟 TX 回显
    const frame: DisplayFrame = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      direction: 'tx',
      raw_hex: data.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      formatted: '',
      protocol: 'raw',
      summary: '',
    }
    setFrames((prev) => [...prev, frame])
  }, [])

  return (
    <AppLayout
      sidebar={<Sidebar />}
      mainContent={
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Tab 栏 */}
          <div style={{
            display: 'flex',
            background: 'var(--color-sidebar-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            {PANELS.map((panel) => (
              <div
                key={panel.id}
                onClick={() => setActivePanel(panel.id)}
                style={{
                  padding: '6px 16px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  color: activePanel === panel.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontWeight: activePanel === panel.id ? 600 : 400,
                  borderBottom: activePanel === panel.id
                    ? '2px solid var(--color-accent)'
                    : '2px solid transparent',
                }}
              >
                {panel.label}
              </div>
            ))}
          </div>
          {/* 内容区 */}
          {activePanel === 'terminal' && <TerminalView frames={frames} />}
          {activePanel !== 'terminal' && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: '13px',
            }}>
              {activePanel.toUpperCase()} View — Coming Soon
            </div>
          )}
        </div>
      }
      bottomPanel={<SendBar onSend={handleSend} />}
    />
  )
}
