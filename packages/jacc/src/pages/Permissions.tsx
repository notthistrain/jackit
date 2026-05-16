import { useState } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { SourceBadge } from '@/components/SourceBadge'
import { Fab } from '@/components/Fab'
import { useT } from '@/i18n'

interface PermissionRule {
  tool: string
  pattern: string
}

export function Permissions() {
  const { t } = useT()
  const { config, writeConfig } = useConfig()
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState<'allow' | 'deny'>('allow')
  const [newTool, setNewTool] = useState('Bash')
  const [newPattern, setNewPattern] = useState('')
  const [newScope, setNewScope] = useState<'global' | 'project'>('project')

  const allowItem = config?.items.find((i) => i.key === 'permissions')
  const permissions = (allowItem?.value as Record<string, PermissionRule[]>) || {}
  const permScope = allowItem?.scope || 'global'

  const allowRules = permissions.allow || []
  const denyRules = permissions.deny || []

  async function handleAdd() {
    if (!newPattern.trim()) return
    const key = newType === 'allow' ? 'allow' : 'deny'
    const current = permissions[key] || []
    const updated = {
      ...permissions,
      [key]: [...current, { tool: newTool, pattern: newPattern }],
    }
    await writeConfig(newScope, 'permissions', updated)
    setNewPattern('')
    setShowAdd(false)
  }

  async function handleDelete(type: 'allow' | 'deny', index: number) {
    const current = [...(permissions[type] || [])]
    current.splice(index, 1)
    const updated = { ...permissions, [type]: current }
    await writeConfig(permScope, 'permissions', updated)
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('permissions.title')}</h2>

      {/* 允许列表 */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-success mb-2 flex items-center gap-1.5">
          <span>✓</span> {t('permissions.allow')}
        </div>
        <div className="bg-card border border-border-light rounded-[4px] overflow-hidden">
          <div className="flex px-3.5 py-2 bg-sidebar border-b border-border-light text-[11px] text-muted font-medium">
            <div className="w-[50px]">{t('permissions.header.type')}</div>
            <div className="w-[50px]">{t('permissions.header.tool')}</div>
            <div className="flex-1">{t('permissions.header.pattern')}</div>
            <div className="w-[50px] text-center">{t('permissions.header.source')}</div>
            <div className="w-[30px]"></div>
          </div>
          {allowRules.map((rule, i) => (
            <div key={i} className="flex items-center px-3.5 py-2 border-b border-border-light/50">
              <div className="w-[50px]">
                <span className="text-[10px] px-1.5 py-0.5 bg-success-light text-success rounded-[2px]">Allow</span>
              </div>
              <div className="w-[50px] text-[11px] text-muted-foreground">{rule.tool}</div>
              <div className="flex-1 text-[11px] font-mono text-foreground">{rule.pattern}</div>
              <div className="w-[50px] text-center"><SourceBadge scope={permScope} /></div>
              <div className="w-[30px] text-center">
                <button onClick={() => handleDelete('allow', i)} className="text-border hover:text-danger text-xs">×</button>
              </div>
            </div>
          ))}
          {allowRules.length === 0 && (
            <div className="px-3.5 py-3 text-[11px] text-muted text-center">{t('permissions.noAllow')}</div>
          )}
        </div>
      </div>

      {/* 拒绝列表 */}
      <div>
        <div className="text-xs font-semibold text-danger mb-2 flex items-center gap-1.5">
          <span>✗</span> {t('permissions.deny')}
        </div>
        <div className="bg-card border border-border-light rounded-[4px] overflow-hidden">
          <div className="flex px-3.5 py-2 bg-sidebar border-b border-border-light text-[11px] text-muted font-medium">
            <div className="w-[50px]">{t('permissions.header.type')}</div>
            <div className="w-[50px]">{t('permissions.header.tool')}</div>
            <div className="flex-1">{t('permissions.header.pattern')}</div>
            <div className="w-[50px] text-center">{t('permissions.header.source')}</div>
            <div className="w-[30px]"></div>
          </div>
          {denyRules.map((rule, i) => (
            <div key={i} className="flex items-center px-3.5 py-2 border-b border-border-light/50">
              <div className="w-[50px]">
                <span className="text-[10px] px-1.5 py-0.5 bg-danger-light text-danger rounded-[2px]">Deny</span>
              </div>
              <div className="w-[50px] text-[11px] text-muted-foreground">{rule.tool}</div>
              <div className="flex-1 text-[11px] font-mono text-foreground">{rule.pattern}</div>
              <div className="w-[50px] text-center"><SourceBadge scope={permScope} /></div>
              <div className="w-[30px] text-center">
                <button onClick={() => handleDelete('deny', i)} className="text-border hover:text-danger text-xs">×</button>
              </div>
            </div>
          ))}
          {denyRules.length === 0 && (
            <div className="px-3.5 py-3 text-[11px] text-muted text-center">{t('permissions.noDeny')}</div>
          )}
        </div>
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="mt-4 p-3 bg-card border border-border-light rounded-[4px]">
          <div className="text-[13px] font-medium text-foreground mb-3">{t('permissions.add.title')}</div>
          <div className="flex gap-2 mb-2">
            <select value={newType} onChange={(e) => setNewType(e.target.value as 'allow' | 'deny')} className="bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs text-foreground">
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
            <select value={newTool} onChange={(e) => setNewTool(e.target.value)} className="bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs text-foreground">
              <option>Bash</option>
              <option>Read</option>
              <option>Write</option>
              <option>Edit</option>
            </select>
            <select value={newScope} onChange={(e) => setNewScope(e.target.value as 'global' | 'project')} className="bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs text-foreground">
              <option value="project">{t('permissions.add.scopeProject')}</option>
              <option value="global">{t('permissions.add.scopeGlobal')}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder={t('permissions.add.pattern')}
              className="flex-1 bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
            />
            <button onClick={handleAdd} className="px-3 py-1.5 bg-primary text-white text-xs rounded-[2px]">{t('permissions.add.submit')}</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 border border-border text-xs text-muted rounded-[2px]">{t('permissions.add.cancel')}</button>
          </div>
        </div>
      )}

      <Fab onClick={() => setShowAdd(true)} />
    </div>
  )
}
