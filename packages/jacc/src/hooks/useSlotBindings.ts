import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'

export interface SlotBinding {
  slot: string
  model_id: number
  model_name: string
  context_size: string | null
  api_key: string
  base_url: string
  provider_name: string
}

export function useSlotBindings() {
  const [bindings, setBindings] = useState<SlotBinding[]>([])
  const [loading, setLoading] = useState(false)
  const { success, error } = useToast()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<SlotBinding[]>('get_slot_bindings')
      setBindings(list)
    } catch (e) {
      error(String(e))
    } finally {
      setLoading(false)
    }
  }, [error])

  const bind = useCallback(async (slot: string, modelId: number) => {
    try {
      await invoke('bind_slot', { slot, modelId })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const unbind = useCallback(async (slot: string) => {
    try {
      await invoke('unbind_slot', { slot })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const setCurrentModel = useCallback(async (slot: string, contextSize: string | null) => {
    try {
      await invoke('set_current_model', { slot, contextSize })
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [error])

  useEffect(() => { refresh() }, [refresh])

  return { bindings, loading, refresh, bind, unbind, setCurrentModel }
}
