import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

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

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<SlotBinding[]>('get_slot_bindings')
      setBindings(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const bind = useCallback(async (slot: string, modelId: number) => {
    await invoke('bind_slot', { slot, modelId })
    await refresh()
  }, [refresh])

  const unbind = useCallback(async (slot: string) => {
    await invoke('unbind_slot', { slot })
    await refresh()
  }, [refresh])

  const setCurrentModel = useCallback(async (slot: string, contextSize: string | null) => {
    await invoke('set_current_model', { slot, contextSize })
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { bindings, loading, refresh, bind, unbind, setCurrentModel }
}
