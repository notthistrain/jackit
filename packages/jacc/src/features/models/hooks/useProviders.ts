import type { CreateProviderInput, Provider, UpdateProviderInput } from '../api/models-api'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/providers/ToastProvider'
import { providersApi } from '../api/models-api'

export type { CreateProviderInput, Provider, UpdateProviderInput }

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setProviders(await providersApi.list())
    }
    catch (e) {
      error(String(e))
    }
    finally {
      setLoading(false)
    }
  }, [error])

  const add = useCallback(async (input: CreateProviderInput) => {
    try {
      await providersApi.create(input)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const update = useCallback(async (id: number, input: UpdateProviderInput) => {
    try {
      await providersApi.update(id, input)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const remove = useCallback(async (id: number) => {
    try {
      await providersApi.delete(id)
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

  return { providers, loading, refresh, add, update, remove }
}
