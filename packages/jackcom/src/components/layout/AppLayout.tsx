import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { ConnectionDialog } from '@/components/connection/ConnectionDialog'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useMainStore } from '@/lib/store'
import { openDecoderWindow, openHistoryWindow, openWaveformWindow } from '@/lib/window'
import { ActivityBar } from './ActivityBar'
import { appLayout } from './app-layout.variants'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'
import { Toolbar } from './Toolbar'

interface AppLayoutProps {
  sidebar: ReactNode
  mainContent: ReactNode
  bottomPanel: ReactNode
}

export function AppLayout({ sidebar, mainContent, bottomPanel }: AppLayoutProps) {
  const toggleHexDisplay = useMainStore(s => s.toggleHexDisplay)
  const incrementClearSequence = useMainStore(s => s.incrementClearSequence)
  const connectionDialogOpen = useMainStore(s => s.connectionDialogOpen)
  const toggleConnectionDialog = useMainStore(s => s.toggleConnectionDialog)

  const closeConnectionDialog = useCallback(() => {
    toggleConnectionDialog(false)
  }, [toggleConnectionDialog])

  useKeyboardShortcuts([
    { key: 'h', ctrl: true, handler: toggleHexDisplay },
    { key: 'l', ctrl: true, handler: incrementClearSequence },
    { key: 'w', ctrl: true, shift: true, handler: () => useMainStore.getState().activePortId && openWaveformWindow(useMainStore.getState().activePortId!) },
    { key: 'd', ctrl: true, shift: true, handler: () => useMainStore.getState().activePortId && openDecoderWindow(useMainStore.getState().activePortId!) },
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
