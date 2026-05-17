import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface Provider {
  id: number
  name: string
  base_url: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateProviderInput {
  name: string
  base_url: string
  notes: string | null
}

export interface UpdateProviderInput {
  name?: string
  base_url?: string
  notes?: string
}

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<Provider[]>('list_providers')
      setProviders(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(async (input: CreateProviderInput) => {
    await invoke('add_provider', { input })
    await refresh()
  }, [refresh])

  const update = useCallback(async (id: number, input: UpdateProviderInput) => {
    await invoke('update_provider', { id, input })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await invoke('delete_provider', { id })
    await refresh()
  }, [refresh])

  useEffect(() => { refresh() }, [refresh])

  return { providers, loading, refresh, add, update, remove }
}
