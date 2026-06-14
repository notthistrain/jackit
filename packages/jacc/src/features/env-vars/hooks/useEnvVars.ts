import type { ConfigOrigin } from '@/shared/hooks/useConfig'
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '@/providers/ToastProvider'
import { useAppStore } from '@/stores/useAppStore'
import { findEnvMeta } from '../api/env-catalog'
import { MODEL_ENV_KEYS } from '../api/env-vars-api'

export interface EnvEntry { key: string, value: string, origin: ConfigOrigin }
interface EnvLayer { vars: EnvEntry[] }
interface WriteResult { wrote_local: boolean, gitignore_updated: boolean }

// 逐变量敏感分流：含密钥变量（catalog sensitive=true）落 settings.local.json，
// 非敏感落 settings.json。槽位托管变量（MODEL_ENV_KEYS）展示但不可在此编辑。
export function useEnvVars() {
  const { configScope, currentProject } = useAppStore()
  const [entries, setEntries] = useState<EnvEntry[]>([])
  const { success, error } = useToast()
  const { t } = useT()
  // stale guard：快速切换 scope/project 时只采纳最后一次读取
  const reqId = useRef(0)
  const needsProject = configScope === 'project' && !currentProject

  const refresh = useCallback(async () => {
    if (needsProject) {
      setEntries([])
      return
    }
    const id = ++reqId.current
    try {
      const layer = await invoke<EnvLayer>('read_env_layer', { scope: configScope, projectPath: currentProject })
      if (id === reqId.current)
        setEntries(layer.vars.map(v => ({ ...v, value: String(v.value) })))
    }
    catch (e) {
      if (id === reqId.current)
        error(String(e))
    }
  }, [configScope, currentProject, needsProject, error])

  const setVar = useCallback(async (key: string, value: string) => {
    const sensitive = findEnvMeta(key)?.sensitive ?? false
    const res = await invoke<WriteResult>('set_env_var', {
      scope: configScope,
      projectPath: currentProject,
      key,
      value,
      sensitive,
    })
    if (res.wrote_local)
      success(t('config.wroteLocal'))
    await refresh()
  }, [configScope, currentProject, refresh, success, t])

  const remove = useCallback(async (key: string, origin: ConfigOrigin) => {
    await invoke('delete_env_var', { scope: configScope, projectPath: currentProject, key, origin })
    await refresh()
  }, [configScope, currentProject, refresh])

  useEffect(() => {
    refresh()
  }, [refresh])

  // 槽位托管变量（由「通用」页槽位写入）：展示但不可在此编辑
  const modelKeys = MODEL_ENV_KEYS as readonly string[]
  const regularEntries = entries.filter(e => !modelKeys.includes(e.key))
  const modelEntries = entries.filter(e => modelKeys.includes(e.key))

  return { entries, regularEntries, modelEntries, needsProject, refresh, setVar, remove }
}
