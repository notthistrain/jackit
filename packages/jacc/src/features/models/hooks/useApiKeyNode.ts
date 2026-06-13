import type { Model } from '@/features/models/hooks/useModels'
import { useState } from 'react'
import { useModels } from '@/features/models/hooks/useModels'

export function useApiKeyNode(
  apiKeyId: number,
  t: (key: string, params?: Record<string, string>) => string,
) {
  const { models, add, update, remove, test } = useModels(apiKeyId)
  const [expanded, setExpanded] = useState(false)
  const [showAddModel, setShowAddModel] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [showEditKey, setShowEditKey] = useState(false)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number, msg: string, ok: boolean } | null>(null)
  const [confirmDeleteKey, setConfirmDeleteKey] = useState(false)

  function formatTestResult(raw: string): string {
    if (raw === 'CONNECTION_SUCCESS')
      return t('models.testSuccess')
    if (raw.startsWith('CONNECTION_FAILED:'))
      return t('models.testFailed', { error: raw.slice(18) })
    if (raw.startsWith('HTTP_ERROR:'))
      return t('models.testFailed', { error: raw.slice(11) })
    return raw
  }

  async function handleTestModel(id: number) {
    setTesting(id)
    setTestResult(null)
    try {
      const msg = await test(id)
      setTestResult({ id, msg: formatTestResult(msg), ok: true })
    }
    catch (e) {
      setTestResult({ id, msg: formatTestResult(String(e)), ok: false })
    }
    finally {
      setTesting(null)
    }
  }

  async function handleAddModel(input: { api_key_id: number, model_name: string, context_size: string | null }) {
    await add(input)
    setShowAddModel(false)
  }

  async function handleEditModel(input: { api_key_id: number, model_name: string, context_size: string | null }) {
    if (editingModel) {
      await update(editingModel.id, {
        model_name: input.model_name,
        context_size: input.context_size === null ? undefined : input.context_size,
      })
    }
    setEditingModel(null)
  }

  return {
    models,
    remove,
    expanded,
    showAddModel,
    editingModel,
    showEditKey,
    testing,
    testResult,
    confirmDeleteKey,
    setExpanded,
    setShowAddModel,
    setEditingModel,
    setShowEditKey,
    setConfirmDeleteKey,
    handleTestModel,
    handleAddModel,
    handleEditModel,
  }
}
