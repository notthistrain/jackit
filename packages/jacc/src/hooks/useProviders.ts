import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'

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
  const { success, error } = useToast()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<Provider[]>('list_providers')
      setProviders(list)
    } catch (e) {
      error(String(e))
    } finally {
      setLoading(false)
    }
  }, [error])

  const add = useCallback(async (input: CreateProviderInput) => {
    try {
      await invoke('add_provider', { input })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const update = useCallback(async (id: number, input: UpdateProviderInput) => {
    try {
      await invoke('update_provider', { id, input })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const remove = useCallback(async (id: number) => {
    try {
      await invoke('delete_provider', { id })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  useEffect(() => { refresh() }, [refresh])

  return { providers, loading, refresh, add, update, remove }
}
