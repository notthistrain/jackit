import type { ReactNode } from 'react'
import { selectRow } from './select-row.variants'

export interface SelectRowOption {
  value: string
  label: string
}

export interface SelectRowProps {
  label: string
  description: string
  value: string
  options: SelectRowOption[]
  onChange: (value: string) => void
  badge?: ReactNode
}

export function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
  badge,
}: SelectRowProps) {
  const styles = selectRow()
  return (
    <div className={styles.root()}>
      <div className={styles.info()}>
        <div className={styles.label()}>{label}</div>
        <div className={styles.description()}>{description}</div>
      </div>
      <div className={styles.actions()}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={styles.select()}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {badge}
      </div>
    </div>
  )
}
