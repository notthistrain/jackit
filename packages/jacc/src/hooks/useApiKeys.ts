import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'

export interface ApiKeyView {
  id: number
  provider_id: number
  name: string
  api_key_masked: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateApiKeyInput {
  provider_id: number
  name: string
  api_key: string
  notes: string | null
}

export interface UpdateApiKeyInput {
  name?: string
  api_key?: string
  notes?: string
}

export function useApiKeys(providerId: number) {
  const [apiKeys, setApiKeys] = useState<ApiKeyView[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    if (!providerId) return
    setLoading(true)
    try {
      const list = await invoke<ApiKeyView[]>('list_api_keys', { providerId })
      setApiKeys(list)
    } catch (e) {
      error(String(e))
    } finally {
      setLoading(false)
    }
  }, [providerId, error])

  const add = useCallback(async (input: CreateApiKeyInput) => {
    try {
      await invoke('add_api_key', { input })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const update = useCallback(async (id: number, input: UpdateApiKeyInput) => {
    try {
      await invoke('update_api_key', { id, input })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const remove = useCallback(async (id: number) => {
    try {
      await invoke('delete_api_key', { id })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  useEffect(() => { refresh() }, [refresh])

  return { apiKeys, loading, refresh, add, update, remove }
}
