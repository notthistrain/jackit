import { envValueInput } from './env-value-input.variants'

export interface EnvValueInputProps {
  type: 'string' | 'boolean' | 'number' | 'enum'
  value: string
  enumValues?: string[]
  default?: string
  unit?: string
  onChange: (value: string) => void
  className?: string
}

export function EnvValueInput({ type, value, enumValues, default: def, unit, onChange }: EnvValueInputProps) {
  const on = value === '1'
  const { text, select, toggle, toggleLabel, knob } = envValueInput({ on })

  if (type === 'boolean') {
    return (
      <div className="flex items-center">
        <button type="button" aria-pressed={on} onClick={() => onChange(on ? '0' : '1')} className={toggle()}>
          <span className={knob()} />
        </button>
        <span className={toggleLabel()}>
          {on ? '已开启(1)' : '已关闭(0)'}
          {def ? ` · 默认 ${def}` : ''}
        </span>
      </div>
    )
  }

  if (type === 'enum') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={select()}>
        {(enumValues ?? []).map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    )
  }

  return (
    <input
      type={type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={[def && `默认 ${def}`, unit].filter(Boolean).join(' · ')}
      className={text()}
    />
  )
}
