import type { ConfigOrigin, LayerConfig } from '@/shared/hooks/useConfig'

export interface PermissionRule {
  tool: string
  pattern: string
}

export type PermissionType = 'allow' | 'deny'

export function extractPermissions(config: LayerConfig | null): {
  permissions: Record<string, PermissionRule[]>
  origin: ConfigOrigin
} {
  const item = config?.items.find(i => i.key === 'permissions')
  return {
    permissions: (item?.value as Record<string, PermissionRule[]>) || {},
    origin: item?.origin || 'global',
  }
}

export function addRule(
  permissions: Record<string, PermissionRule[]>,
  type: PermissionType,
  rule: PermissionRule,
): Record<string, PermissionRule[]> {
  return { ...permissions, [type]: [...(permissions[type] || []), rule] }
}

export function removeRule(
  permissions: Record<string, PermissionRule[]>,
  type: PermissionType,
  index: number,
): Record<string, PermissionRule[]> {
  const current = [...(permissions[type] || [])]
  current.splice(index, 1)
  return { ...permissions, [type]: current }
}
