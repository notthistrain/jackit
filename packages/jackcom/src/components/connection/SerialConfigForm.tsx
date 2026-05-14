import { useT } from '@/i18n'
import type { SerialConfig } from '@/hooks/useSerialConfig'
import { PortSelector } from './PortSelector'

interface SerialConfigFormProps {
  config: SerialConfig
  onChange: (partial: Partial<SerialConfig>) => void
}

const BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
]

const DATA_BITS = [5, 6, 7, 8]
const STOP_BITS = [1, 2]
const PARITY_OPTIONS = ['none', 'odd', 'even']
const FLOW_CONTROL_OPTIONS = ['none', 'hardware', 'software']

const rowLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#858585',
  textAlign: 'right',
  width: '70px',
  flexShrink: 0,
}

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: '3px 6px',
  fontSize: '11px',
  background: '#3c3c3c',
  color: '#d4d4d4',
  border: '1px solid #4c4c4c',
  borderRadius: '3px',
  outline: 'none',
}

const compactSelectStyle: React.CSSProperties = {
  flex: 1,
  padding: '3px 6px',
  fontSize: '10px',
  background: '#3c3c3c',
  color: '#d4d4d4',
  border: '1px solid #4c4c4c',
  borderRadius: '3px',
  outline: 'none',
  textAlign: 'center',
}

export function SerialConfigForm({ config, onChange }: SerialConfigFormProps) {
  const { t } = useT()

  return (
    <>
      {/* Port selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={rowLabelStyle}>{t('connection.port')}</label>
        <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
          <div style={{ flex: 1 }}>
            <PortSelector
              value={config.portName}
              onChange={v => onChange({ portName: v })}
            />
          </div>
        </div>
      </div>

      {/* Baud rate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={rowLabelStyle}>{t('connection.baudRate')}</label>
        <select
          value={String(config.baudRate)}
          onChange={e => onChange({ baudRate: Number(e.target.value) })}
          style={selectStyle}
        >
          {BAUD_RATES.map(rate => (
            <option key={rate} value={String(rate)}>
              {rate.toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      {/* Advanced: data bits / stop bits / parity / flow control in one row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={rowLabelStyle}>Advanced</label>
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          <select
            value={String(config.dataBits)}
            onChange={e => onChange({ dataBits: Number(e.target.value) })}
            style={compactSelectStyle}
          >
            {DATA_BITS.map(b => (
              <option key={b} value={String(b)}>{b} bit</option>
            ))}
          </select>
          <select
            value={String(config.stopBits)}
            onChange={e => onChange({ stopBits: Number(e.target.value) })}
            style={compactSelectStyle}
          >
            {STOP_BITS.map(b => (
              <option key={b} value={String(b)}>{b} stop</option>
            ))}
          </select>
          <select
            value={config.parity}
            onChange={e => onChange({ parity: e.target.value })}
            style={compactSelectStyle}
          >
            {PARITY_OPTIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={config.flowControl}
            onChange={e => onChange({ flowControl: e.target.value })}
            style={compactSelectStyle}
          >
            {FLOW_CONTROL_OPTIONS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}
