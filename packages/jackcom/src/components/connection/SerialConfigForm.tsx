import { useT } from '@/i18n'
import type { SerialConfig } from '@/hooks/useSerialConfig'
import { PortSelector } from './PortSelector'
import { serialConfigForm } from './serial-config-form.variants'

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

export function SerialConfigForm({ config, onChange }: SerialConfigFormProps) {
  const { t } = useT()
  const { row, label, select, compactSelect, portRow } = serialConfigForm()

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
        <select
          value={String(config.baudRate)}
          onChange={e => onChange({ baudRate: Number(e.target.value) })}
          className={select()}
        >
          {BAUD_RATES.map(rate => (
            <option key={rate} value={String(rate)}>
              {rate.toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      {/* Advanced: data bits / stop bits / parity / flow control in one row */}
      <div className={row()}>
        <label className={label()}>Advanced</label>
        <div className="flex gap-1 flex-1">
          <select
            value={String(config.dataBits)}
            onChange={e => onChange({ dataBits: Number(e.target.value) })}
            className={compactSelect()}
          >
            {DATA_BITS.map(b => (
              <option key={b} value={String(b)}>{b} bit</option>
            ))}
          </select>
          <select
            value={String(config.stopBits)}
            onChange={e => onChange({ stopBits: Number(e.target.value) })}
            className={compactSelect()}
          >
            {STOP_BITS.map(b => (
              <option key={b} value={String(b)}>{b} stop</option>
            ))}
          </select>
          <select
            value={config.parity}
            onChange={e => onChange({ parity: e.target.value })}
            className={compactSelect()}
          >
            {PARITY_OPTIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={config.flowControl}
            onChange={e => onChange({ flowControl: e.target.value })}
            className={compactSelect()}
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
