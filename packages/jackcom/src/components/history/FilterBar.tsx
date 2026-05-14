import { filterBar } from './filter-bar.variants'

interface FilterBarProps {
  direction: 'all' | 'rx' | 'tx'
  protocol: string | null
  onDirectionChange: (dir: 'all' | 'rx' | 'tx') => void
  onProtocolChange: (proto: string | null) => void
}

export function FilterBar({ direction, protocol, onDirectionChange, onProtocolChange }: FilterBarProps) {
  const { root, label, pill, separator } = filterBar()

  const directions: Array<{ value: 'all' | 'rx' | 'tx'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'rx', label: 'RX' },
    { value: 'tx', label: 'TX' },
  ]
  const protocols: Array<{ value: string | null; label: string }> = [
    { value: null, label: 'All' },
    { value: 'raw', label: 'Raw' },
    { value: 'modbus', label: 'Modbus' },
    { value: 'at', label: 'AT' },
    { value: 'json', label: 'JSON' },
  ]

  return (
    <div className={root()}>
      <span className={label()}>Filter:</span>
      {directions.map(d => (
        <button key={d.value} className={pill({ active: direction === d.value })} onClick={() => onDirectionChange(d.value)}>
          {d.label}
        </button>
      ))}
      <span className={separator()}>|</span>
      {protocols.map(p => (
        <button key={p.label} className={pill({ active: protocol === p.value })} onClick={() => onProtocolChange(p.value)}>
          {p.label}
        </button>
      ))}
    </div>
  )
}
