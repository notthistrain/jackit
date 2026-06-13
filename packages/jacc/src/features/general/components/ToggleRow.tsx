import type { ReactNode } from 'react'
import { toggleRow } from './toggle-row.variants'

export interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onToggle: () => void
  badge?: ReactNode
}

export function ToggleRow({ label, description, checked, onToggle, badge }: ToggleRowProps) {
  const styles = toggleRow({ checked })
  return (
    <div className={styles.root()}>
      <div className={styles.info()}>
        <div className={styles.label()}>{label}</div>
        <div className={styles.description()}>{description}</div>
      </div>
      <div className={styles.actions()}>
        <button onClick={onToggle} className={styles.track()}>
          <div className={styles.knob()} />
        </button>
        {badge}
      </div>
    </div>
  )
}
