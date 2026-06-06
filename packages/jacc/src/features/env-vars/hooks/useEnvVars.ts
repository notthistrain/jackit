import { useCallback } from 'react'
import { useConfig } from '@/shared/hooks/useConfig'
import { deleteEnvVar, extractEnv, setEnvVar, splitEnv } from '../api/env-vars-api'

export function useEnvVars() {
  const { config, writeConfig } = useConfig()
  const { env, scope } = extractEnv(config)
  const { regularEntries, modelEntries } = splitEnv(env)

  const add = useCallback(async (key: string, value: string) => {
    await writeConfig(scope, 'env', setEnvVar(env, key, value))
  }, [env, scope, writeConfig])

  const remove = useCallback(async (key: string) => {
    await writeConfig(scope, 'env', deleteEnvVar(env, key))
  }, [env, scope, writeConfig])

  const update = useCallback(async (key: string, value: string) => {
    await writeConfig(scope, 'env', setEnvVar(env, key, value))
  }, [env, scope, writeConfig])

  return { regularEntries, modelEntries, scope, add, remove, update }
}
