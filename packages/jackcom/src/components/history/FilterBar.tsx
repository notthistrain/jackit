interface FilterBarProps {
  direction: 'all' | 'rx' | 'tx'
  protocol: string | null
  onDirectionChange: (dir: 'all' | 'rx' | 'tx') => void
  onProtocolChange: (proto: string | null) => void
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '1px 6px',
  borderRadius: '2px',
  fontSize: '10px',
  cursor: 'pointer',
  background: active ? '#094771' : 'transparent',
  color: active ? '#fff' : 'var(--color-text-secondary)',
  border: 'none',
})

export function FilterBar({ direction, protocol, onDirectionChange, onProtocolChange }: FilterBarProps) {
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
    <div style={{
      padding: '4px 10px',
      background: 'var(--color-sidebar-bg)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>Filter:</span>
      {directions.map(d => (
        <button key={d.value} style={pillStyle(direction === d.value)} onClick={() => onDirectionChange(d.value)}>
          {d.label}
        </button>
      ))}
      <span style={{ color: 'var(--color-border)' }}>|</span>
      {protocols.map(p => (
        <button key={p.label} style={pillStyle(protocol === p.value)} onClick={() => onProtocolChange(p.value)}>
          {p.label}
        </button>
      ))}
    </div>
  )
}
