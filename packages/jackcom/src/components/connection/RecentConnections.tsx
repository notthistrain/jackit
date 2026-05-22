import type { SerialConfig } from '@/hooks/useSerialConfig'
import { useCallback, useState } from 'react'
import { connectionDialog } from './connection-dialog.variants'

interface RecentConnectionsProps {
  configs: SerialConfig[]
  onSelect: (config: SerialConfig) => void
}

export function RecentConnections({ configs, onSelect }: RecentConnectionsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { recentList, recentHeader, recentItem, recentPort, recentDetail } = connectionDialog()

  const handleSelect = useCallback((config: SerialConfig) => {
    onSelect(config)
  }, [onSelect])

  return (
    <div className={recentList()}>
      <div className={recentHeader()}>RECENT</div>
      {configs.map((rc, i) => (
        <div
          key={`${rc.portName}-${rc.baudRate}-${i}`}
          onClick={() => handleSelect(rc)}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          className={recentItem({ hovered: hoveredIndex === i })}
        >
          <div className={recentPort()}>{rc.portName}</div>
          <div className={recentDetail()}>
            {rc.baudRate.toLocaleString()}
            {' '}
            {rc.dataBits}
            {rc.parity[0].toUpperCase()}
            {rc.stopBits}
          </div>
        </div>
      ))}
    </div>
  )
}
