import type { EnvVarMeta } from '../api/env-catalog'
import { addEnvVarFormVariants } from './add-env-var-form.variants'
import { EnvValueInput } from './EnvValueInput'
import { EnvVarCombobox } from './EnvVarCombobox'

export interface AddEnvVarFormProps {
  visible: boolean
  values: { meta: EnvVarMeta | null, value: string }
  onChange: (values: { meta: EnvVarMeta | null, value: string }) => void
  onSubmit: () => void
  onCancel: () => void
  t: (key: string, params?: Record<string, string>) => string
}

export function AddEnvVarForm({
  visible,
  values,
  onChange,
  onSubmit,
  onCancel,
  t,
}: AddEnvVarFormProps) {
  if (!visible)
    return null

  const { container, formRow, inputGroup, label, submitBtn, cancelBtn }
    = addEnvVarFormVariants()

  return (
    <div className={container()}>
      <div className={formRow()}>
        <div className={inputGroup()}>
          <div className={label()}>{t('envvars.add.name')}</div>
          <EnvVarCombobox
            value={values.meta?.name ?? ''}
            onSelect={meta => onChange({ meta, value: '' })}
          />
        </div>
        <div className={inputGroup()}>
          <div className={label()}>{t('envvars.add.value')}</div>
          <EnvValueInput
            type={values.meta?.type ?? 'string'}
            value={values.value}
            enumValues={values.meta?.enumValues}
            default={values.meta?.default}
            unit={values.meta?.unit}
            onChange={value => onChange({ ...values, value })}
            t={t}
          />
        </div>
        <button type="button" onClick={onSubmit} className={submitBtn()}>
          {t('envvars.add.submit')}
        </button>
        <button type="button" onClick={onCancel} className={cancelBtn()}>
          {t('envvars.add.cancel')}
        </button>
      </div>
    </div>
  )
}
