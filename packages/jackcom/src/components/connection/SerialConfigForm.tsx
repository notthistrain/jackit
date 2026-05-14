import type { SerialConfig } from '@/hooks/useSerialConfig'

interface SerialConfigFormProps {
  config: SerialConfig
  onChange: (partial: Partial<SerialConfig>) => void
}

const baudRates = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

const selectStyle: React.CSSProperties = {
  background: 'var(--color-sidebar-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '3px',
  padding: '3px 6px',
  color: 'var(--color-text)',
  fontSize: '11px',
  outline: 'none',
  flex: 1,
  textAlign: 'center' as const,
}

const labelStyle: React.CSSProperties = {
  width: '70px',
  color: 'var(--color-text-secondary)',
  textAlign: 'right' as const,
  fontSize: '11px',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

export function SerialConfigForm({ config, onChange }: SerialConfigFormProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={rowStyle}>
        <label style={labelStyle}>Baud Rate</label>
        <select
          value={config.baudRate}
          onChange={e => onChange({ baudRate: Number(e.target.value) })}
          style={{ ...selectStyle, flex: 'none', width: '100%' }}
        >
          {baudRates.map(br => (
            <option key={br} value={br}>{br.toLocaleString()}</option>
          ))}
        </select>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>Advanced</label>
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          <select
            value={config.dataBits}
            onChange={e => onChange({ dataBits: Number(e.target.value) })}
            style={selectStyle}
          >
            <option value={5}>5 bit</option>
            <option value={6}>6 bit</option>
            <option value={7}>7 bit</option>
            <option value={8}>8 bit</option>
          </select>
          <select
            value={config.stopBits}
            onChange={e => onChange({ stopBits: Number(e.target.value) })}
            style={selectStyle}
          >
            <option value={1}>1 stop</option>
            <option value={2}>2 stop</option>
          </select>
          <select
            value={config.parity}
            onChange={e => onChange({ parity: e.target.value })}
            style={selectStyle}
          >
            <option value="none">none</option>
            <option value="odd">odd</option>
            <option value="even">even</option>
          </select>
          <select
            value={config.flowControl}
            onChange={e => onChange({ flowControl: e.target.value })}
            style={selectStyle}
          >
            <option value="none">none</option>
            <option value="hardware">HW</option>
            <option value="software">SW</option>
          </select>
        </div>
      </div>
    </div>
  )
}
