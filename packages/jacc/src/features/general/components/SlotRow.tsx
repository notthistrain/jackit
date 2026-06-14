import { AlertTriangle } from 'lucide-react'
import { ModelSelect } from '@/features/models'
import { useT } from '@/i18n'
import { slotRow } from './slot-row.variants'

export type SlotRowSlot = 'opus' | 'sonnet' | 'haiku'

export interface SlotRowProps {
  slot: SlotRowSlot
  label: string
  isCurrent: boolean
  isBound: boolean
  isDrifted: boolean
  driftTip: string
  modelValue: number | null
  contextValue: string
  contextOptions: string[]
  modelString: string
  onModelChange: (modelId: number) => void
  onContextChange: (ctx: string) => void
  onApply: () => void
}

export function SlotRow({
  label,
  isCurrent,
  isBound,
  isDrifted,
  driftTip,
  modelValue,
  contextValue,
  contextOptions,
  modelString,
  onModelChange,
  onContextChange,
  onApply,
}: SlotRowProps) {
  const { t } = useT()
  const styles = slotRow({ isCurrent, isBoundCtx: isBound })
  return (
    <div className={styles.root()}>
      <div className={styles.labelGroup()}>
        <span className={styles.label()}>{label}</span>
        {isCurrent && (
          <span className={styles.currentBadge()}>{t('general.slot.current')}</span>
        )}
        {isDrifted && (
          <span title={driftTip} className={styles.driftBadge()}>
            <AlertTriangle size={9} />
            {t('general.slot.drift')}
          </span>
        )}
      </div>

      <ModelSelect value={modelValue} onChange={onModelChange} />

      <select
        value={contextValue}
        onChange={e => onContextChange(e.target.value)}
        disabled={!isBound}
        className={styles.contextSelect()}
      >
        <option value="">{t('general.ctxDefault')}</option>
        {contextOptions.filter(c => c).map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {isBound && (!isCurrent || isDrifted) && (
        <button onClick={onApply} className={styles.applyButton()}>
          {t('general.apply')}
        </button>
      )}

      {isCurrent && (
        <span className={styles.modelString()}>{modelString}</span>
      )}
    </div>
  )
}
