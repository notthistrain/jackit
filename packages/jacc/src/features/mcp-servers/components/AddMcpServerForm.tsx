import { addMcpServerForm } from './add-mcp-server-form.variants'

export interface AddMcpServerFormProps {
  visible: boolean
  values: { name: string, command: string, args: string }
  onChange: (values: { name: string, command: string, args: string }) => void
  onSubmit: () => void
  onCancel: () => void
  t: (key: string, params?: Record<string, string>) => string
}

export function AddMcpServerForm({
  visible,
  values,
  onChange,
  onSubmit,
  onCancel,
  t,
}: AddMcpServerFormProps) {
  if (!visible)
    return null

  const { root, title, form, input, inputMono, buttons, cancelButton, submitButton } = addMcpServerForm()

  return (
    <div className={root()}>
      <div className={title()}>{t('mcp.add.title')}</div>
      <div className={form()}>
        <input
          value={values.name}
          onChange={e => onChange({ ...values, name: e.target.value })}
          placeholder={t('mcp.add.name')}
          className={input()}
        />
        <input
          value={values.command}
          onChange={e => onChange({ ...values, command: e.target.value })}
          placeholder={t('mcp.add.command')}
          className={inputMono()}
        />
        <input
          value={values.args}
          onChange={e => onChange({ ...values, args: e.target.value })}
          placeholder={t('mcp.add.args')}
          className={inputMono()}
        />
        <div className={buttons()}>
          <button onClick={onCancel} className={cancelButton()}>{t('mcp.add.cancel')}</button>
          <button onClick={onSubmit} className={submitButton()}>{t('mcp.add.submit')}</button>
        </div>
      </div>
    </div>
  )
}
