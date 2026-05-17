import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'

export interface Model {
  id: number
  api_key_id: number
  model_name: string
  context_size: string | null
  created_at: string
  updated_at: string
}

export interface CreateModelInput {
  api_key_id: number
  model_name: string
  context_size: string | null
}

export interface UpdateModelInput {
  model_name?: string
  context_size?: string
}

export function useModels(apiKeyId: number) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    if (!apiKeyId) return
    setLoading(true)
    try {
      const list = await invoke<Model[]>('list_models', { apiKeyId })
      setModels(list)
    } catch (e) {
      error(String(e))
    } finally {
      setLoading(false)
    }
  }, [apiKeyId, error])

  const add = useCallback(async (input: CreateModelInput) => {
    try {
      await invoke('add_model', { input })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const update = useCallback(async (id: number, input: UpdateModelInput) => {
    try {
      await invoke('update_model', { id, input })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const remove = useCallback(async (id: number) => {
    try {
      await invoke('delete_model', { id })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const test = useCallback(async (id: number): Promise<string> => {
    return invoke<string>('test_model', { id })
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { models, loading, refresh, add, update, remove, test }
}
