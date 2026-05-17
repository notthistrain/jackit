import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface Model {
  id: number
  alias: string
  base_url: string
  api_key_masked: string
  model_name: string
  context_size: string | null
  created_at: string
  updated_at: string
}

export interface CreateModelInput {
  alias: string
  base_url: string
  api_key: string
  model_name: string
  context_size: string | null
}

export interface UpdateModelInput {
  alias?: string
  base_url?: string
  api_key?: string
  model_name?: string
  context_size?: string
}

export interface SlotBinding {
  slot: string
  model_id: number
  alias: string
  base_url: string
  model_name: string
  context_size: string | null
}

export function useModels() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<Model[]>('list_models')
      setModels(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(async (input: CreateModelInput) => {
    await invoke('add_model', { input })
    await refresh()
  }, [refresh])

  const update = useCallback(async (id: number, input: UpdateModelInput) => {
    await invoke('update_model', { id, input })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await invoke('delete_model', { id })
    await refresh()
  }, [refresh])

  const test = useCallback(async (id: number): Promise<string> => {
    return invoke<string>('test_model', { id })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { models, loading, refresh, add, update, remove, test }
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

  useEffect(() => {
    refresh()
  }, [refresh])

  return { bindings, loading, refresh, bind, unbind, setCurrentModel }
}
