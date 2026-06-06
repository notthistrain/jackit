import type { ApiKeyView, CreateApiKeyInput, UpdateApiKeyInput } from '../api/models-api'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'
import { apiKeysApi } from '../api/models-api'

export type { ApiKeyView, CreateApiKeyInput, UpdateApiKeyInput }

export function useApiKeys(providerId: number) {
  const [apiKeys, setApiKeys] = useState<ApiKeyView[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    if (!providerId)
      return
    setLoading(true)
    try {
      setApiKeys(await apiKeysApi.list(providerId))
    }
    catch (e) {
      error(String(e))
    }
    finally {
      setLoading(false)
    }
  }, [providerId, error])

  const add = useCallback(async (input: CreateApiKeyInput) => {
    try {
      await apiKeysApi.create(input)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const update = useCallback(async (id: number, input: UpdateApiKeyInput) => {
    try {
      await apiKeysApi.update(id, input)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const remove = useCallback(async (id: number) => {
    try {
      await apiKeysApi.delete(id)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { apiKeys, loading, refresh, add, update, remove }
}
