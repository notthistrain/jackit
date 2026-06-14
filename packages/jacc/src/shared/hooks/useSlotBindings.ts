import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/providers/ToastProvider'
import { useAppStore } from '@/stores/useAppStore'

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
  const { configScope, currentProject } = useAppStore()
  const [bindings, setBindings] = useState<SlotBindingFull[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()
  // stale guard：快速切换 scope/project 时只采纳最后一次读取
  const reqId = useRef(0)

  const needsProject = configScope === 'project' && !currentProject

  const refresh = useCallback(async () => {
    if (needsProject) {
      setBindings([])
      return
    }
    const id = ++reqId.current
    setLoading(true)
    try {
      const list = await invoke<SlotBindingFull[]>('get_slot_bindings', {
        scope: configScope,
        projectPath: currentProject,
      })
      if (id === reqId.current)
        setBindings(list)
    }
    catch (e) {
      if (id === reqId.current)
        error(String(e))
    }
    finally {
      if (id === reqId.current)
        setLoading(false)
    }
  }, [configScope, currentProject, needsProject, error])

  const bind = useCallback(
    async (slot: string, modelId: number) => {
      try {
        await invoke('bind_slot', { slot, modelId, scope: configScope, projectPath: currentProject })
        await refresh()
      }
      catch (e) {
        error(String(e))
        throw e
      }
    },
    [refresh, error, configScope, currentProject],
  )

  const unbind = useCallback(
    async (slot: string) => {
      try {
        await invoke('unbind_slot', { slot, scope: configScope, projectPath: currentProject })
        await refresh()
      }
      catch (e) {
        error(String(e))
        throw e
      }
    },
    [refresh, error, configScope, currentProject],
  )

  const setCurrentModel = useCallback(
    async (slot: string, contextSize: string | null) => {
      try {
        await invoke('set_current_model', {
          slot,
          contextSize,
          scope: configScope,
          projectPath: currentProject,
        })
        // 写盘后显式刷新 binding/drift：项目级写 settings.local.json，
        // 文件 watcher 不认该文件（仅认 settings.json），不显式刷新则 UI 不更新。
        await refresh()
      }
      catch (e) {
        error(String(e))
        throw e
      }
    },
    [refresh, error, configScope, currentProject],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  // 订阅后端 settings-changed event：settings.json 被外部修改时刷新 drift。
  // 注意 watcher 仅认 settings.json；bind/unbind/setCurrentModel 均已显式 refresh，
  // 此监听器主要用于捕获本应用之外的文件改动。
  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined
    listen('settings-changed', () => {
      refresh()
    }).then((fn) => {
      // 卸载早于 listen resolve 时，立刻注销刚拿到的句柄，避免泄漏
      if (cancelled)
        fn()
      else
        unlisten = fn
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [refresh])

  return { bindings, loading, needsProject, refresh, bind, unbind, setCurrentModel }
}
