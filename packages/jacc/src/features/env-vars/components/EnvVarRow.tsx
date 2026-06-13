import { SourceBadge } from '@/shared/components/ui/SourceBadge'
import { envVarRowVariants } from './env-var-row.variants'

export interface EnvVarRowProps {
  envKey: string
  value: string
  scope: 'global' | 'project' | 'models'
  readOnly?: boolean
  onLocalChange?: (key: string, value: string) => void
  onBlur?: (key: string) => void
  onDelete?: (key: string) => void
  t: (key: string, params?: Record<string, string>) => string
}

export function EnvVarRow({
  envKey,
  value,
  scope,
  readOnly = false,
  onLocalChange,
  onBlur,
  onDelete,
  t,
}: EnvVarRowProps) {
  const { root, name, valueCell, input, managedHint, sourceCell, actionCell, deleteBtn }
    = envVarRowVariants({ readOnly })

  return (
    <div className={root()}>
      <div className={name()} title={readOnly ? undefined : envKey}>
        {envKey}
      </div>

      <div className={valueCell()}>
        {readOnly
          ? (
              <div className={managedHint()}>{t('envvars.managedByModels')}</div>
            )
          : (
              <input
                defaultValue={value}
                onChange={e => onLocalChange?.(envKey, e.target.value)}
                onBlur={() => onBlur?.(envKey)}
                className={input()}
              />
            )}
      </div>

      <div className={sourceCell()}>
        <SourceBadge scope={scope} />
      </div>

      <div className={actionCell()}>
        {!readOnly && (
          <button onClick={() => onDelete?.(envKey)} className={deleteBtn()}>
            ×
          </button>
        )}
      </div>
    </div>
  )
}
