import type { PermissionRule, PermissionType } from '../api/permissions-api'
import { useCallback } from 'react'
import { useConfig } from '@/shared/hooks/useConfig'
import { addRule, extractPermissions, removeRule } from '../api/permissions-api'

export type { PermissionRule, PermissionType }

export function usePermissions() {
  const { config, writeConfig } = useConfig()
  const { permissions, scope } = extractPermissions(config)
  const allowRules = permissions.allow || []
  const denyRules = permissions.deny || []

  const add = useCallback(
    async (type: PermissionType, rule: PermissionRule, formScope: 'global' | 'project') => {
      await writeConfig(formScope, 'permissions', addRule(permissions, type, rule))
    },
    [permissions, writeConfig],
  )

  const remove = useCallback(
    async (type: PermissionType, index: number) => {
      await writeConfig(scope, 'permissions', removeRule(permissions, type, index))
    },
    [permissions, scope, writeConfig],
  )

  return { allowRules, denyRules, scope, add, remove }
}
