import { useState, useEffect, useCallback, useRef } from 'react'
import { useSerialPort } from '@/hooks/useSerialPort'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
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

  const { root, row, refreshBtn, error } = portSelector()

  const refresh = useCallback(async () => {
    setLoading(true)
    setErrMsg(null)
    try {
      const list = await enumerate()
      setPorts(list)
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

  const portOptions: SelectOption[] = ports.map(p => ({
    value: p.name,
    label: p.name + (p.manufacturer ? ` (${p.manufacturer})` : ''),
  }))

  return (
    <div className={root()}>
      <div className={row()}>
        <Select
          value={value}
          options={portOptions}
          onChange={onChange}
          placeholder={loading ? '...' : 'No ports'}
          disabled={loading || ports.length === 0}
          className="flex-1"
        />
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
