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

function SelectField({
  label,
  value,
  options,
  onChange,
  formatLabel,
}: {
  label: string
  value: string | number
  options: Array<string | number>
  onChange: (val: string) => void
  formatLabel?: (val: string | number) => string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label style={{
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        width: '70px',
        textAlign: 'right',
        flexShrink: 0,
      }}
      >
        {label}
      </label>
      <select
        value={String(value)}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1,
          padding: '3px 6px',
          fontSize: '12px',
          background: 'var(--color-editor-bg)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: '3px',
          outline: 'none',
        }}
      >
        {options.map(opt => (
          <option key={String(opt)} value={String(opt)}>
            {formatLabel ? formatLabel(opt) : String(opt)}
          </option>
        ))}
      </select>
    </div>
  )
}

export function SerialConfigForm({ config, onChange }: SerialConfigFormProps) {
  const { t } = useT()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '8px 0',
    }}
    >
      {/* Port selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          width: '70px',
          textAlign: 'right',
          flexShrink: 0,
        }}
        >
          Port
        </label>
        <div style={{ flex: 1 }}>
          <PortSelector
            value={config.portName}
            onChange={v => onChange({ portName: v })}
          />
        </div>
      </div>

      {/* Baud rate */}
      <SelectField
        label="Baud Rate"
        value={config.baudRate}
        options={BAUD_RATES}
        onChange={v => onChange({ baudRate: Number(v) })}
        formatLabel={v => Number(v).toLocaleString()}
      />

      {/* Data bits */}
      <SelectField
        label="Data Bits"
        value={config.dataBits}
        options={DATA_BITS}
        onChange={v => onChange({ dataBits: Number(v) })}
      />

      {/* Stop bits */}
      <SelectField
        label="Stop Bits"
        value={config.stopBits}
        options={STOP_BITS}
        onChange={v => onChange({ stopBits: Number(v) })}
      />

      {/* Parity */}
      <SelectField
        label={t('menu.connection.portSettings').split('(')[0].trim() || 'Parity'}
        value={config.parity}
        options={PARITY_OPTIONS}
        onChange={v => onChange({ parity: v })}
      />

      {/* Flow control */}
      <SelectField
        label="Flow Ctrl"
        value={config.flowControl}
        options={FLOW_CONTROL_OPTIONS}
        onChange={v => onChange({ flowControl: v })}
      />
    </div>
  )
}
