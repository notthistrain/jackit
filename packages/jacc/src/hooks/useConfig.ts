import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'

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

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoke<MergedConfig>('read_merged_config', {
        projectPath: currentProject || '',
      })
      setConfig(result)
    } finally {
      setLoading(false)
    }
  }, [currentProject])

  const writeConfig = useCallback(
    async (scope: 'global' | 'project', key: string, value: unknown) => {
      await invoke('write_config', {
        scope,
        projectPath: currentProject,
        key,
        value,
      })
      await refresh()
    },
    [currentProject, refresh],
  )

  const deleteConfig = useCallback(
    async (scope: 'global' | 'project', key: string) => {
      await invoke('delete_config', {
        scope,
        projectPath: currentProject,
        key,
      })
      await refresh()
    },
    [currentProject, refresh],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { config, loading, refresh, writeConfig, deleteConfig }
}
