import type { Model } from '@/features/models/hooks/useModels'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { useModelNode } from '../hooks/useModelNode'
import { modelNode } from './model-node.variants'

export interface ModelNodeProps {
  model: Model
  onTest: (id: number) => void
  onEdit: (m: Model) => void
  onRemove: (id: number) => void
  testing: number | null
  testResult: { id: number, msg: string, ok: boolean } | null
  t: (key: string, params?: Record<string, string>) => string
}

export function ModelNode({
  model,
  onTest,
  onEdit,
  onRemove,
  testing,
  testResult,
  t,
}: ModelNodeProps) {
  const { confirmDelete, setConfirmDelete } = useModelNode()
  const { root, info, nameRow, name, ctx, result, actions, testBtn, ghostBtn, dangerBtn }
    = modelNode({ resultOk: testResult?.ok })

  return (
    <div className={root()}>
      <div className={info()}>
        <div className={nameRow()}>
          <span className={name()}>{model.model_name}</span>
          {model.context_size && (
            <span className={ctx()}>
              (
              {model.context_size}
              )
            </span>
          )}
        </div>
        {testResult?.id === model.id && (
          <div className={result()} title={testResult.msg}>
            {testResult.msg}
          </div>
        )}
      </div>
      <div className={actions()}>
        <button
          onClick={() => onTest(model.id)}
          disabled={testing === model.id}
          className={testBtn()}
        >
          {testing === model.id ? '...' : t('models.test')}
        </button>
        <button onClick={() => onEdit(model)} className={ghostBtn()}>
          {t('models.edit')}
        </button>
        <button onClick={() => setConfirmDelete(true)} className={dangerBtn()}>
          {t('models.delete')}
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={t('confirm.deleteModel.title')}
        message={t('confirm.deleteModel.message', { name: model.model_name })}
        confirmLabel={t('models.delete')}
        danger
        onConfirm={() => {
          setConfirmDelete(false)
          onRemove(model.id)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
