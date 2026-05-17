import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useToast } from '@/components/toast/ToastProvider'

export interface MergedConfigItem {
  key: string
  value: unknown
  scope: 'global' | 'project'
}

export interface MergedConfig {
  items: MergedConfigItem[]
}

export function useConfig() {
  const { currentProject } = useAppStore()
  const [config, setConfig] = useState<MergedConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoke<MergedConfig>('read_merged_config', {
        projectPath: currentProject || '',
      })
      setConfig(result)
    } catch (e) {
      error(String(e))
    } finally {
      setLoading(false)
    }
  }, [currentProject, error])

  const writeConfig = useCallback(
    async (scope: 'global' | 'project', key: string, value: unknown) => {
      try {
        await invoke('write_config', {
          scope,
          projectPath: currentProject,
          key,
          value,
        })
        await refresh()
      } catch (e) {
        error(String(e))
        throw e
      }
    },
    [currentProject, refresh, error],
  )

  const deleteConfig = useCallback(
    async (scope: 'global' | 'project', key: string) => {
      try {
        await invoke('delete_config', {
          scope,
          projectPath: currentProject,
          key,
        })
        await refresh()
      } catch (e) {
        error(String(e))
        throw e
      }
    },
    [currentProject, refresh, error],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { config, loading, refresh, writeConfig, deleteConfig }
}
