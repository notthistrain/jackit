import { useState } from 'react'
import { AddPermissionForm } from '@/features/permissions/components/AddPermissionForm'
import { PermissionTable } from '@/features/permissions/components/PermissionTable'
import { usePermissions } from '@/features/permissions/hooks/usePermissions'
import { useT } from '@/i18n'
import { Fab } from '@/shared/components/ui/Fab'

export function Permissions() {
  const { t } = useT()
  const { allowRules, denyRules, scope, add, remove } = usePermissions()
  const [showAdd, setShowAdd] = useState(false)
  const [newValues, setNewValues] = useState<{
    type: 'allow' | 'deny'
    tool: string
    pattern: string
    scope: 'global' | 'project'
  }>({ type: 'allow', tool: 'Bash', pattern: '', scope: 'project' })

  async function handleSubmit() {
    if (!newValues.pattern.trim())
      return
    await add(newValues.type, { tool: newValues.tool, pattern: newValues.pattern }, newValues.scope)
    setNewValues(v => ({ ...v, pattern: '' }))
    setShowAdd(false)
  }

  const headers = {
    type: t('permissions.header.type'),
    tool: t('permissions.header.tool'),
    pattern: t('permissions.header.pattern'),
    source: t('permissions.header.source'),
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('permissions.title')}</h2>

      <PermissionTable
        kind="allow"
        title={t('permissions.allow')}
        rules={allowRules}
        scope={scope}
        emptyText={t('permissions.noAllow')}
        badgeText="Allow"
        iconText="✓"
        headers={headers}
        onDelete={i => remove('allow', i)}
      />

      <PermissionTable
        kind="deny"
        title={t('permissions.deny')}
        rules={denyRules}
        scope={scope}
        emptyText={t('permissions.noDeny')}
        badgeText="Deny"
        iconText="✗"
        headers={headers}
        onDelete={i => remove('deny', i)}
      />

      <AddPermissionForm
        visible={showAdd}
        values={newValues}
        onChange={setNewValues}
        onSubmit={handleSubmit}
        onCancel={() => setShowAdd(false)}
        t={t}
      />

      <Fab onClick={() => setShowAdd(true)} />
    </div>
  )
}
