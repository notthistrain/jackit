import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'

export interface SlotBindingIntent {
  slot: string
  model_id: number
  model_name: string
  provider_id: number
  provider_name: string
  base_url: string
  api_key_masked: string
  context_size: string | null
}

export interface ActualSlotEnv {
  model_name: string | null
  base_url: string | null
  api_key_masked: string | null
}

export interface SlotMatchFlags {
  model_name: boolean
  base_url: boolean
  api_key: boolean
}

export interface SlotBindingFull {
  intent: SlotBindingIntent
  actual: ActualSlotEnv
  matches: SlotMatchFlags
}

export function useSlotBindings() {
  const [bindings, setBindings] = useState<SlotBindingFull[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<SlotBindingFull[]>('get_slot_bindings')
      setBindings(list)
    }
    catch (e) {
      error(String(e))
    }
    finally {
      setLoading(false)
    }
  }, [error])

  const bind = useCallback(
    async (slot: string, modelId: number) => {
      try {
        await invoke('bind_slot', { slot, modelId })
        await refresh()
      }
      catch (e) {
        error(String(e))
        throw e
      }
    },
    [refresh, error],
  )

  const unbind = useCallback(
    async (slot: string) => {
      try {
        await invoke('unbind_slot', { slot })
        await refresh()
      }
      catch (e) {
        error(String(e))
        throw e
      }
    },
    [refresh, error],
  )

  const setCurrentModel = useCallback(
    async (slot: string, contextSize: string | null) => {
      try {
        await invoke('set_current_model', { slot, contextSize })
      }
      catch (e) {
        error(String(e))
        throw e
      }
    },
    [error],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  // 订阅后端 settings-changed event，settings.json 变化时刷新 drift 状态
  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen('settings-changed', () => {
      refresh()
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [refresh])

  return { bindings, loading, refresh, bind, unbind, setCurrentModel }
}
