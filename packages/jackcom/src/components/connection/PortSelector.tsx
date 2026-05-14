import { useState, useEffect, useCallback, useRef } from 'react'
import { useSerialPort } from '@/hooks/useSerialPort'
import { portSelector } from './port-selector.variants'

interface PortInfo {
  name: string
  manufacturer: string | null
  product: string | null
  serial_number: string | null
  port_type: string
}

interface PortSelectorProps {
  value: string
  onChange: (portName: string) => void
}

export function PortSelector({ value, onChange }: PortSelectorProps) {
  const { enumerate } = useSerialPort()
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrMsg] = useState<string | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const { root, row, select, refreshBtn, error } = portSelector()

  const refresh = useCallback(async () => {
    setLoading(true)
    setErrMsg(null)
    try {
      const list = await enumerate()
      setPorts(list)
      // Auto-select first port if no value set
      if (!valueRef.current && list.length > 0) {
        onChangeRef.current(list[0].name)
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [enumerate])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className={root()}>
      <div className={row()}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={loading || ports.length === 0}
          className={select()}
        >
          {ports.length === 0 && (
            <option value="">{loading ? '...' : 'No ports'}</option>
          )}
          {ports.map(p => (
            <option key={p.name} value={p.name}>
              {p.name}{p.manufacturer ? ` (${p.manufacturer})` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh"
          className={refreshBtn({ loading })}
        >
          {loading ? '...' : 'R'}
        </button>
      </div>
      {errorMsg && (
        <span className={error()}>{errorMsg}</span>
      )}
    </div>
  )
}
