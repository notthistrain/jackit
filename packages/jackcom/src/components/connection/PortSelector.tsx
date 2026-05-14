import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface PortInfo {
  name: string
  manufacturer: string | null
}

interface PortSelectorProps {
  value: string
  onChange: (portName: string) => void
}

export function PortSelector({ value, onChange }: PortSelectorProps) {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<PortInfo[]>('enumerate_ports')
      setPorts(list)
    } catch {
      setPorts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1,
          background: 'var(--color-sidebar-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '3px',
          padding: '4px 8px',
          color: 'var(--color-text)',
          fontSize: '12px',
          outline: 'none',
        }}
      >
        <option value="">-- Select Port --</option>
        {ports.map(p => (
          <option key={p.name} value={p.name}>
            {p.name}{p.manufacturer ? ` (${p.manufacturer})` : ''}
          </option>
        ))}
      </select>
      <button
        onClick={refresh}
        disabled={loading}
        style={{
          background: 'var(--color-sidebar-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '3px',
          padding: '4px 8px',
          color: 'var(--color-text-secondary)',
          cursor: loading ? 'wait' : 'pointer',
          fontSize: '12px',
        }}
      >
        ↻
      </button>
    </div>
  )
}
