import type { PermissionRule, PermissionType } from '../api/permissions-api'
import { useCallback } from 'react'
import { useConfig } from '@/shared/hooks/useConfig'
import { addRule, extractPermissions, removeRule } from '../api/permissions-api'

export type { PermissionRule, PermissionType }

export function usePermissions() {
  const { config, writeConfig } = useConfig()
  const { permissions, origin } = extractPermissions(config)
  const allowRules = permissions.allow || []
  const denyRules = permissions.deny || []

  const add = useCallback(
    async (type: PermissionType, rule: PermissionRule) => {
      await writeConfig('permissions', addRule(permissions, type, rule), false)
    },
    [permissions, writeConfig],
  )

  const remove = useCallback(
    async (type: PermissionType, index: number) => {
      await writeConfig('permissions', removeRule(permissions, type, index), false)
    },
    [permissions, writeConfig],
  )

  return { allowRules, denyRules, origin, add, remove }
}
