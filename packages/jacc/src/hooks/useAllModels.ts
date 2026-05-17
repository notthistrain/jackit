import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'

export interface FlatModel {
  modelId: number
  modelName: string
  providerName: string
  keyName: string
}

interface ProviderRow {
  id: number
  name: string
}

interface ApiKeyRow {
  id: number
  provider_id: number
  name: string
}

interface ModelRow {
  id: number
  api_key_id: number
  model_name: string
}

export function useAllModels() {
  const [models, setModels] = useState<FlatModel[]>([])
  const [loading, setLoading] = useState(false)
  const { error: toastError } = useToast()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const providers = await invoke<ProviderRow[]>('list_providers')
      const flat: FlatModel[] = []

      for (const provider of providers) {
        const keys = await invoke<ApiKeyRow[]>('list_api_keys', { providerId: provider.id })
        for (const key of keys) {
          const models = await invoke<ModelRow[]>('list_models', { apiKeyId: key.id })
          for (const model of models) {
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
    } catch (e) {
      toastError(String(e))
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { refresh() }, [refresh])

  return { models, loading, refresh }
}
