import { useState, useEffect, useCallback } from 'react'
import { useSerialPort } from '@/hooks/useSerialPort'

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
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await enumerate()
      setPorts(list)
      // Auto-select first port if no value set
      if (!value && list.length > 0) {
        onChange(list[0].name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [enumerate, value, onChange])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={loading || ports.length === 0}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '12px',
            background: 'var(--color-editor-bg)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            outline: 'none',
          }}
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
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: 'var(--color-border)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? '...' : 'R'}
        </button>
      </div>
      {error && (
        <span style={{ fontSize: '11px', color: '#e06c75' }}>{error}</span>
      )}
    </div>
  )
}
