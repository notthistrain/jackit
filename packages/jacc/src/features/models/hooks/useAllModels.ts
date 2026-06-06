import type { FlatModel } from '../api/models-api'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'
import { apiKeysApi, modelsApi, providersApi } from '../api/models-api'

export type { FlatModel }

export function useAllModels() {
  const [models, setModels] = useState<FlatModel[]>([])
  const [loading, setLoading] = useState(false)
  const { error: toastError } = useToast()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const providers = await providersApi.list()
      const flat: FlatModel[] = []

      for (const provider of providers) {
        const keys = await apiKeysApi.list(provider.id)
        for (const key of keys) {
          const list = await modelsApi.list(key.id)
          for (const model of list) {
            flat.push({
              modelId: model.id,
              modelName: model.model_name,
              providerName: provider.name,
              keyName: key.name,
            })
          }
        }
      }

      setModels(flat)
    }
    catch (e) {
      toastError(String(e))
    }
    finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { models, loading, refresh }
}
