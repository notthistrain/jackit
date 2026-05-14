import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useMainStore } from '@/lib/store'
import { openDecoderWindow, openHistoryWindow, openWaveformWindow } from '@/lib/window'
import { ConnectionDialog } from '@/components/connection/ConnectionDialog'
import { ActivityBar } from './ActivityBar'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'
import { Toolbar } from './Toolbar'
import { appLayout } from './app-layout.variants'

interface AppLayoutProps {
  sidebar: ReactNode
  mainContent: ReactNode
  bottomPanel: ReactNode
}

export function AppLayout({ sidebar, mainContent, bottomPanel }: AppLayoutProps) {
  const { activePortId, toggleSidebar, toggleHexDisplay, incrementClearSequence, connectionDialogOpen, toggleConnectionDialog } = useMainStore()

  const closeConnectionDialog = useCallback(() => {
    toggleConnectionDialog(false)
  }, [toggleConnectionDialog])

  useKeyboardShortcuts([
    { key: 'h', ctrl: true, handler: toggleHexDisplay },
    { key: 'l', ctrl: true, handler: incrementClearSequence },
    { key: 'w', ctrl: true, shift: true, handler: () => activePortId && openWaveformWindow(activePortId) },
    { key: 'd', ctrl: true, shift: true, handler: () => activePortId && openDecoderWindow(activePortId) },
    { key: 'h', ctrl: true, shift: true, handler: () => openHistoryWindow() },
  ])

  const { root, mainRow, contentCol, contentArea } = appLayout()

  return (
    <div className={root()}>
      <TitleBar onOpenConnectionDialog={() => toggleConnectionDialog(true)} onClearTerminal={incrementClearSequence} />
      <Toolbar onOpenConnectionDialog={() => toggleConnectionDialog(true)} />
      <div className={mainRow()}>
        <ActivityBar />
        {sidebar}
        <div className={contentCol()}>
          <div className={contentArea()}>
            {mainContent}
          </div>
          {bottomPanel}
        </div>
      </div>
      <StatusBar />
      {connectionDialogOpen && (
        <ConnectionDialog onClose={closeConnectionDialog} />
      )}
    </div>
  )
}
