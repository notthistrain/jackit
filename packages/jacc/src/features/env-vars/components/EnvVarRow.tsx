import type { EnvVarMeta } from '../api/env-catalog'
import type { ConfigOrigin } from '@/shared/hooks/useConfig'
import { SourceBadge } from '@/shared/components/ui/SourceBadge'
import { envVarRowVariants } from './env-var-row.variants'
import { EnvValueInput } from './EnvValueInput'

export interface EnvVarRowProps {
  envKey: string
  value: string
  origin: ConfigOrigin | 'models'
  showSource?: boolean
  readOnly?: boolean
  slotManaged?: boolean
  meta?: EnvVarMeta
  onCommit?: (key: string, value: string) => void
  onDelete?: (key: string, origin: ConfigOrigin) => void
  t: (key: string, params?: Record<string, string>) => string
}

export function EnvVarRow({
  envKey,
  value,
  origin,
  showSource,
  readOnly = false,
  slotManaged = false,
  meta,
  onCommit,
  onDelete,
  t,
}: EnvVarRowProps) {
  const { root, name, valueCell, managedHint, sourceCell, actionCell, deleteBtn }
    = envVarRowVariants({ readOnly })
  const masked = readOnly || slotManaged

  return (
    <div className={root()}>
      <div className={name()} title={masked ? undefined : envKey}>
        {envKey}
      </div>

      <div className={valueCell()}>
        {masked
          ? (
              <div className={managedHint()}>
                ••••
                {t('envvars.managedByModels')}
              </div>
            )
          : (
              <EnvValueInput
                type={meta?.type ?? 'string'}
                value={value}
                enumValues={meta?.enumValues}
                default={meta?.default}
                unit={meta?.unit}
                onChange={v => onCommit?.(envKey, v)}
              />
            )}
      </div>

      {showSource && (
        <div className={sourceCell()}>
          <SourceBadge scope={origin} />
        </div>
      )}

      <div className={actionCell()}>
        {!readOnly && !slotManaged && origin !== 'models' && (
          <button onClick={() => onDelete?.(envKey, origin as ConfigOrigin)} className={deleteBtn()}>
            ×
          </button>
        )}
      </div>
    </div>
  )
}
