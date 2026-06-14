import { useRef, useState } from 'react'
import { AddEnvVarForm } from '@/features/env-vars/components/AddEnvVarForm'
import { EnvVarRow } from '@/features/env-vars/components/EnvVarRow'
import { useEnvVars } from '@/features/env-vars/hooks/useEnvVars'
import { useT } from '@/i18n'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Fab } from '@/shared/components/ui/Fab'
import { ScopeSwitcher } from '@/shared/components/ui/ScopeSwitcher'
import { useSelectProject } from '@/shared/hooks/useSelectProject'
import { useAppStore } from '@/stores/useAppStore'

export function EnvVars() {
  const { t } = useT()
  const { configScope, currentProject, setConfigScope } = useAppStore()
  const { regularEntries, modelEntries, origin, add, remove, update } = useEnvVars()
  const selectProject = useSelectProject()
  const [showAdd, setShowAdd] = useState(false)
  const [newValues, setNewValues] = useState({ key: '', value: '' })
  const pendingRef = useRef<Record<string, string>>({})
  const showSource = configScope === 'project'
  const needsProject = configScope === 'project' && !currentProject

  function handleLocalChange(key: string, value: string) {
    pendingRef.current[key] = value
  }

  async function handleBlur(key: string) {
    if (key in pendingRef.current) {
      const v = pendingRef.current[key]
      delete pendingRef.current[key]
      await update(key, v)
    }
  }

  async function handleSubmit() {
    if (!newValues.key.trim())
      return
    await add(newValues.key, newValues.value)
    setNewValues({ key: '', value: '' })
    setShowAdd(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-foreground">{t('envvars.title')}</h2>
        <ScopeSwitcher value={configScope} onChange={setConfigScope} />
      </div>

      {needsProject
        ? <EmptyState onSelectProject={selectProject} />
        : (
            <>
              {modelEntries.length > 0 && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-warning-light border border-warning/30 rounded-[4px] mb-4 text-[11px] text-warning">
                  <span>💡</span>
                  <span>{t('envvars.modelHint')}</span>
                </div>
              )}

              <div className="bg-card border border-border-light rounded-[4px] overflow-hidden">
                <div className="flex px-3.5 py-2 bg-sidebar border-b border-border-light text-[11px] text-muted font-medium">
                  <div className="flex-[2]">{t('envvars.header.name')}</div>
                  <div className="flex-[3]">{t('envvars.header.value')}</div>
                  {showSource && <div className="w-[50px] text-center">{t('envvars.header.source')}</div>}
                  <div className="w-[30px]"></div>
                </div>

                {regularEntries.map(([k, v]) => (
                  <EnvVarRow
                    key={k}
                    envKey={k}
                    value={v}
                    origin={origin}
                    showSource={showSource}
                    onLocalChange={handleLocalChange}
                    onBlur={handleBlur}
                    onDelete={remove}
                    t={t}
                  />
                ))}

                {modelEntries.map(([k, v]) => (
                  <EnvVarRow
                    key={k}
                    envKey={k}
                    value={v}
                    origin="models"
                    showSource
                    readOnly
                    t={t}
                  />
                ))}
              </div>

              <AddEnvVarForm
                visible={showAdd}
                values={newValues}
                onChange={setNewValues}
                onSubmit={handleSubmit}
                onCancel={() => setShowAdd(false)}
                t={t}
              />

              <Fab onClick={() => setShowAdd(true)} />
            </>
          )}
    </div>
  )
}
