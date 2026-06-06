import type { CreateModelInput, Model, UpdateModelInput } from '../api/models-api'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'
import { modelsApi } from '../api/models-api'

export type { CreateModelInput, Model, UpdateModelInput }

export function useModels(apiKeyId: number) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    if (!apiKeyId)
      return
    setLoading(true)
    try {
      setModels(await modelsApi.list(apiKeyId))
    }
    catch (e) {
      error(String(e))
    }
    finally {
      setLoading(false)
    }
  }, [apiKeyId, error])

  const add = useCallback(async (input: CreateModelInput) => {
    try {
      await modelsApi.create(input)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const update = useCallback(async (id: number, input: UpdateModelInput) => {
    try {
      await modelsApi.update(id, input)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const remove = useCallback(async (id: number) => {
    try {
      await modelsApi.delete(id)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const test = useCallback(async (id: number): Promise<string> => {
    return modelsApi.test(id)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { models, loading, refresh, add, update, remove, test }
}
