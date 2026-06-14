import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '@/providers/ToastProvider'
import { useAppStore } from '@/stores/useAppStore'

export type ConfigOrigin = 'global' | 'shared' | 'local'

export interface LayerConfigItem {
  key: string
  value: unknown
  origin: ConfigOrigin
}

export interface LayerConfig {
  items: LayerConfigItem[]
}

interface WriteConfigResult {
  wrote_local: boolean
  gitignore_updated: boolean
}

export function useConfig() {
  const { configScope, currentProject } = useAppStore()
  const [config, setConfig] = useState<LayerConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToast()
  const { t } = useT()

  const needsProject = configScope === 'project' && !currentProject

  const refresh = useCallback(async () => {
    if (needsProject) {
      setConfig({ items: [] })
      return
    }
    setLoading(true)
    try {
      const result = await invoke<LayerConfig>('read_config_layer', {
        scope: configScope,
        projectPath: currentProject,
      })
      setConfig(result)
    }
    catch (e) { error(String(e)) }
    finally { setLoading(false) }
  }, [configScope, currentProject, needsProject, error])

  const writeConfig = useCallback(
    async (key: string, value: unknown, sensitive: boolean) => {
      const res = await invoke<WriteConfigResult>('write_config', {
        scope: configScope,
        projectPath: currentProject,
        key,
        value,
        sensitive,
      })
      if (res.wrote_local)
        success(t('config.wroteLocal'))
      await refresh()
    },
    [configScope, currentProject, refresh, success, t],
  )

  const deleteConfig = useCallback(
    async (key: string, origin: ConfigOrigin) => {
      await invoke('delete_config', {
        scope: configScope,
        projectPath: currentProject,
        key,
        origin,
      })
      await refresh()
    },
    [configScope, currentProject, refresh],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { config, loading, needsProject, refresh, writeConfig, deleteConfig }
}
