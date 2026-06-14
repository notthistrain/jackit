import { envValueInput } from './env-value-input.variants'

export interface EnvValueInputProps {
  type: 'string' | 'boolean' | 'number' | 'enum'
  value: string
  enumValues?: string[]
  default?: string
  unit?: string
  onChange: (value: string) => void
  t: (key: string, params?: Record<string, string>) => string
  className?: string
}

export function EnvValueInput({ type, value, enumValues, default: def, unit, onChange, t }: EnvValueInputProps) {
  // 兼容历史值：字面 '1'/'true' 或 JSON boolean true 均视为开；写入统一归一为 '0'/'1'
  const on = value === '1' || value === 'true'
  const { text, select, toggle, toggleLabel, knob } = envValueInput({ on })

  if (type === 'boolean') {
    return (
      <div className="flex items-center">
        <button type="button" aria-pressed={on} onClick={() => onChange(on ? '0' : '1')} className={toggle()}>
          <span className={knob()} />
        </button>
        <span className={toggleLabel()}>
          {t(on ? 'envvars.value.on' : 'envvars.value.off')}
          {def ? ` · ${t('envvars.value.default')} ${def}` : ''}
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

  const defLabel = def ? `${t('envvars.value.default')} ${def}` : null
  return (
    <input
      type={type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={[defLabel, unit].filter(Boolean).join(' · ')}
      className={text()}
    />
  )
}
