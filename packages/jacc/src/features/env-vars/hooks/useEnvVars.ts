import { useCallback } from 'react'
import { useConfig } from '@/shared/hooks/useConfig'
import { deleteEnvVar, extractEnv, setEnvVar, splitEnv } from '../api/env-vars-api'

// 已知限制（Plan A）：env 作为单个顶层 key 整体写入，sensitive=false → settings.json。
// 逐变量敏感分流（含密钥变量落 settings.local.json）由 Plan B 引入 catalog 后实现。
export function useEnvVars() {
  const { config, writeConfig } = useConfig()
  const { env, origin } = extractEnv(config)
  const { regularEntries, modelEntries } = splitEnv(env)

  const add = useCallback(async (key: string, value: string) => {
    await writeConfig('env', setEnvVar(env, key, value), false)
  }, [env, writeConfig])

  const remove = useCallback(async (key: string) => {
    await writeConfig('env', deleteEnvVar(env, key), false)
  }, [env, writeConfig])

  const update = useCallback(async (key: string, value: string) => {
    await writeConfig('env', setEnvVar(env, key, value), false)
  }, [env, writeConfig])

  return { regularEntries, modelEntries, origin, add, remove, update }
}
