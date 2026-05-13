import type { ReactNode } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useMainStore } from '@/lib/store'
import { openDecoderWindow, openHistoryWindow, openWaveformWindow } from '@/lib/window'
import { ActivityBar } from './ActivityBar'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'
import { Toolbar } from './Toolbar'

interface AppLayoutProps {
  sidebar: ReactNode
  mainContent: ReactNode
  bottomPanel: ReactNode
}

export function AppLayout({ sidebar, mainContent, bottomPanel }: AppLayoutProps) {
  const { activePortId, toggleSidebar, toggleHexDisplay } = useMainStore()

  useKeyboardShortcuts([
    { key: 'h', ctrl: true, handler: toggleHexDisplay },
    { key: 'l', ctrl: true, handler: () => { /* clear terminal placeholder */ } },
    { key: 'w', ctrl: true, shift: true, handler: () => activePortId && openWaveformWindow(activePortId) },
    { key: 'd', ctrl: true, shift: true, handler: () => activePortId && openDecoderWindow(activePortId) },
    { key: 'h', ctrl: true, shift: true, handler: () => openHistoryWindow() },
  ])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
    }}
    >
      <TitleBar />
      <Toolbar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ActivityBar />
        {sidebar}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {mainContent}
          </div>
          {bottomPanel}
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
