import { useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TerminalView } from '@/components/terminal/TerminalView'
import { SendBar } from '@/components/terminal/SendBar'
import { useMainStore } from '@/lib/store'
import { useDataFeed } from '@/hooks/useDataFeed'
import { useSerialPort } from '@/hooks/useSerialPort'
import { bytesToHex } from '@/lib/formatters'

type PanelType = 'terminal' | 'table' | 'modbus' | 'atcmd'

const PANELS: { id: PanelType; label: string }[] = [
  { id: 'terminal', label: 'TERMINAL' },
  { id: 'table', label: 'TABLE' },
  { id: 'modbus', label: 'MODBUS' },
  { id: 'atcmd', label: 'AT CMD' },
]

export default function MainApp() {
  const { activePanel, setActivePanel, activePortId } = useMainStore()
  const { frames } = useDataFeed({ portId: activePortId })
  const { send } = useSerialPort()

  const handleSend = useCallback(async (data: number[]) => {
    if (!activePortId) return
    try {
      const hexData = bytesToHex(data)
      await send(activePortId, hexData)
    } catch (err) {
      console.error('Send failed:', err)
    }
  }, [activePortId, send])

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
      bottomPanel={<SendBar onSend={handleSend} disabled={!activePortId} />}
    />
  )
}
