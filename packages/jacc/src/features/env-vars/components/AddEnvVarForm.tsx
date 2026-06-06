import { addEnvVarFormVariants } from './add-env-var-form.variants'

export interface AddEnvVarFormProps {
  visible: boolean
  values: { key: string, value: string }
  onChange: (values: { key: string, value: string }) => void
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

  const { container, formRow, inputGroup, label, input, submitBtn, cancelBtn }
    = addEnvVarFormVariants()

  return (
    <div className={container()}>
      <div className={formRow()}>
        <div className={inputGroup()}>
          <div className={label()}>{t('envvars.add.name')}</div>
          <input
            value={values.key}
            onChange={e => onChange({ ...values, key: e.target.value })}
            placeholder="MY_VAR"
            className={input()}
          />
        </div>
        <div className={inputGroup()}>
          <div className={label()}>{t('envvars.add.value')}</div>
          <input
            value={values.value}
            onChange={e => onChange({ ...values, value: e.target.value })}
            placeholder="value"
            className={input()}
          />
        </div>
        <button onClick={onSubmit} className={submitBtn()}>
          {t('envvars.add.submit')}
        </button>
        <button onClick={onCancel} className={cancelBtn()}>
          {t('envvars.add.cancel')}
        </button>
      </div>
    </div>
  )
}
