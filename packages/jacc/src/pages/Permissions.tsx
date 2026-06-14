import { useEffect, useRef, useState } from 'react'
import { AddPermissionForm } from '@/features/permissions/components/AddPermissionForm'
import { PermissionTable } from '@/features/permissions/components/PermissionTable'
import { usePermissions } from '@/features/permissions/hooks/usePermissions'
import { useT } from '@/i18n'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Fab } from '@/shared/components/ui/Fab'
import { ScopeSwitcher } from '@/shared/components/ui/ScopeSwitcher'
import { useSelectProject } from '@/shared/hooks/useSelectProject'
import { useAppStore } from '@/stores/useAppStore'

export function Permissions() {
  const { t } = useT()
  const { configScope, currentProject, setConfigScope } = useAppStore()
  const { allowRules, denyRules, origin, add, remove } = usePermissions()
  const selectProject = useSelectProject()
  const [showAdd, setShowAdd] = useState(false)
  const [newValues, setNewValues] = useState<{ type: 'allow' | 'deny', tool: string, pattern: string }>(
    { type: 'allow', tool: 'Bash', pattern: '' },
  )
  const showSource = configScope === 'project'
  const needsProject = configScope === 'project' && !currentProject
  // 新增表单置于列表顶部，打开时滚到可视区，避免规则多时表单被挤出屏幕
  const formRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (showAdd)
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showAdd])

  async function handleSubmit() {
    if (!newValues.pattern.trim())
      return
    await add(newValues.type, { tool: newValues.tool, pattern: newValues.pattern })
    setNewValues(v => ({ ...v, pattern: '' }))
    setShowAdd(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-foreground">{t('permissions.title')}</h2>
        <ScopeSwitcher value={configScope} onChange={setConfigScope} />
      </div>

      {needsProject
        ? <EmptyState onSelectProject={selectProject} />
        : (
            <>
              <div ref={formRef}>
                <AddPermissionForm
                  visible={showAdd}
                  values={newValues}
                  onChange={setNewValues}
                  onSubmit={handleSubmit}
                  onCancel={() => setShowAdd(false)}
                  t={t}
                />
              </div>
              <PermissionTable
                kind="allow"
                rules={allowRules}
                origin={origin}
                showSource={showSource}
                onDelete={i => remove('allow', i)}
                t={t}
              />
              <PermissionTable
                kind="deny"
                rules={denyRules}
                origin={origin}
                showSource={showSource}
                onDelete={i => remove('deny', i)}
                t={t}
              />
              <Fab onClick={() => setShowAdd(true)} />
            </>
          )}
    </div>
  )
}
