import { useT } from '@/i18n'
import type { SerialConfig } from '@/hooks/useSerialConfig'
import type { SelectOption } from '@/components/ui/Select'
import { Select } from '@/components/ui/Select'
import { PortSelector } from './PortSelector'
import { serialConfigForm } from './serial-config-form.variants'

interface SerialConfigFormProps {
  config: SerialConfig
  onChange: (partial: Partial<SerialConfig>) => void
}

const BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
]

const DATA_BITS_OPTIONS: SelectOption[] = [5, 6, 7, 8].map(b => ({ value: String(b), label: `${b} bit` }))
const STOP_BITS_OPTIONS: SelectOption[] = [1, 2].map(b => ({ value: String(b), label: `${b} stop` }))
const PARITY_OPTIONS: SelectOption[] = ['none', 'odd', 'even'].map(p => ({ value: p, label: p }))
const FLOW_CONTROL_OPTIONS: SelectOption[] = ['none', 'hardware', 'software'].map(f => ({ value: f, label: f }))

export function SerialConfigForm({ config, onChange }: SerialConfigFormProps) {
  const { t } = useT()
  const { row, label, portRow } = serialConfigForm()

  return (
    <>
      {/* Port selector */}
      <div className={row()}>
        <label className={label()}>{t('connection.port')}</label>
        <div className={portRow()}>
          <div className="flex-1">
            <PortSelector
              value={config.portName}
              onChange={v => onChange({ portName: v })}
            />
          </div>
        </div>
      </div>

      {/* Baud rate */}
      <div className={row()}>
        <label className={label()}>{t('connection.baudRate')}</label>
        <Select
          value={String(config.baudRate)}
          options={BAUD_RATES.map(rate => ({ value: String(rate), label: rate.toLocaleString() }))}
          onChange={v => onChange({ baudRate: Number(v) })}
          className="flex-1"
        />
      </div>

      {/* Advanced: data bits / stop bits / parity / flow control */}
      <div className={row()}>
        <label className={label()}>Advanced</label>
        <div className="flex gap-1 flex-1">
          <Select
            value={String(config.dataBits)}
            options={DATA_BITS_OPTIONS}
            onChange={v => onChange({ dataBits: Number(v) })}
            size="compact"
            className="flex-1"
          />
          <Select
            value={String(config.stopBits)}
            options={STOP_BITS_OPTIONS}
            onChange={v => onChange({ stopBits: Number(v) })}
            size="compact"
            className="flex-1"
          />
          <Select
            value={config.parity}
            options={PARITY_OPTIONS}
            onChange={v => onChange({ parity: v })}
            size="compact"
            className="flex-1"
          />
          <Select
            value={config.flowControl}
            options={FLOW_CONTROL_OPTIONS}
            onChange={v => onChange({ flowControl: v })}
            size="compact"
            className="flex-1"
          />
        </div>
      </div>
    </>
  )
}
