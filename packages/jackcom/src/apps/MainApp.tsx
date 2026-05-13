import { useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { SendBar } from '@/components/terminal/SendBar'
import { TerminalView } from '@/components/terminal/TerminalView'
import { useDataFeed } from '@/hooks/useDataFeed'
import { useSerialPort } from '@/hooks/useSerialPort'
import { bytesToHex } from '@/lib/formatters'
import { useMainStore } from '@/lib/store'

export default function MainApp() {
  const { activePortId } = useMainStore()
  const { frames } = useDataFeed({ portId: activePortId })
  const { send } = useSerialPort()

  const handleSend = useCallback(async (data: number[]) => {
    if (!activePortId)
      return
    try {
      const hexData = bytesToHex(data)
      await send(activePortId, hexData)
    }
    catch (err) {
      console.error('Send failed:', err)
    }
  }, [activePortId, send])

  return (
    <AppLayout
      sidebar={<Sidebar />}
      mainContent={<TerminalView frames={frames} />}
      bottomPanel={<SendBar onSend={handleSend} disabled={!activePortId} />}
    />
  )
}
