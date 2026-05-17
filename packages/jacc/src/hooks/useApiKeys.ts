import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

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

  const refresh = useCallback(async () => {
    if (!providerId) return
    setLoading(true)
    try {
      const list = await invoke<ApiKeyView[]>('list_api_keys', { provider_id: providerId })
      setApiKeys(list)
    } finally {
      setLoading(false)
    }
  }, [providerId])

  const add = useCallback(async (input: CreateApiKeyInput) => {
    await invoke('add_api_key', { input })
    await refresh()
  }, [refresh])

  const update = useCallback(async (id: number, input: UpdateApiKeyInput) => {
    await invoke('update_api_key', { id, input })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await invoke('delete_api_key', { id })
    await refresh()
  }, [refresh])

  useEffect(() => { refresh() }, [refresh])

  return { apiKeys, loading, refresh, add, update, remove }
}
