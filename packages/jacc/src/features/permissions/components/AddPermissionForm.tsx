import { addPermissionFormVariants } from './add-permission-form.variants'

export interface AddPermissionFormProps {
  visible: boolean
  values: {
    type: 'allow' | 'deny'
    tool: string
    pattern: string
    scope: 'global' | 'project'
  }
  onChange: (values: AddPermissionFormProps['values']) => void
  onSubmit: () => void
  onCancel: () => void
  t: (key: string, params?: Record<string, string>) => string
}

export function AddPermissionForm({
  visible,
  values,
  onChange,
  onSubmit,
  onCancel,
  t,
}: AddPermissionFormProps) {
  if (!visible)
    return null

  const styles = addPermissionFormVariants()

  const tools = ['Bash', 'Read', 'Write', 'Edit']

  return (
    <div className={styles.root()}>
      <div className={styles.title()}>{t('permissions.add.title')}</div>
      <div className={styles.selectRow()}>
        <select
          value={values.type}
          onChange={e => onChange({ ...values, type: e.target.value as 'allow' | 'deny' })}
          className={styles.select()}
        >
          <option value="allow">Allow</option>
          <option value="deny">Deny</option>
        </select>
        <select
          value={values.tool}
          onChange={e => onChange({ ...values, tool: e.target.value })}
          className={styles.select()}
        >
          {tools.map(tool => (
            <option key={tool} value={tool}>{tool}</option>
          ))}
        </select>
        <select
          value={values.scope}
          onChange={e => onChange({ ...values, scope: e.target.value as 'global' | 'project' })}
          className={styles.select()}
        >
          <option value="project">{t('permissions.add.scopeProject')}</option>
          <option value="global">{t('permissions.add.scopeGlobal')}</option>
        </select>
      </div>
      <div className={styles.inputRow()}>
        <input
          value={values.pattern}
          onChange={e => onChange({ ...values, pattern: e.target.value })}
          placeholder={t('permissions.add.pattern')}
          className={styles.input()}
        />
        <button onClick={onSubmit} className={styles.submitButton()}>
          {t('permissions.add.submit')}
        </button>
        <button onClick={onCancel} className={styles.cancelButton()}>
          {t('permissions.add.cancel')}
        </button>
      </div>
    </div>
  )
}
