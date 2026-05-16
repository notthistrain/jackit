# jacc 计划 4：配置页面 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现通用设置、环境变量、权限、MCP 服务器四个配置页面

**架构：** 每个页面是独立的 React 组件，通过 useConfig hook 调用 Tauri 命令读写 settings.json。通用设置用卡片列表，环境变量和权限用紧凑表格。

**技术栈：** React 19, Tailwind CSS 4, @tauri-apps/api

**前置依赖：** 计划 3（前端核心框架）完成

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/hooks/useConfig.ts` | 配置读写 hook |
| `src/pages/General.tsx` | 通用设置页面 |
| `src/pages/EnvVars.tsx` | 环境变量页面 |
| `src/pages/Permissions.tsx` | 权限页面 |
| `src/pages/McpServers.tsx` | MCP 服务器页面 |
| `src/components/Layout.tsx` | 修改：替换占位页面为真实组件 |

---

### 任务 1：useConfig Hook

**文件：**
- 创建：`packages/jacc/src/hooks/useConfig.ts`

- [ ] **步骤 1：创建 useConfig.ts**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'

export interface MergedConfigItem {
  key: string
  value: unknown
  scope: 'global' | 'project'
}

export interface MergedConfig {
  items: MergedConfigItem[]
}

export function useConfig() {
  const { currentProject } = useAppStore()
  const [config, setConfig] = useState<MergedConfig | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!currentProject) return
    setLoading(true)
    try {
      const result = await invoke<MergedConfig>('read_merged_config', {
        projectPath: currentProject,
      })
      setConfig(result)
    } finally {
      setLoading(false)
    }
  }, [currentProject])

  const writeConfig = useCallback(
    async (scope: 'global' | 'project', key: string, value: unknown) => {
      await invoke('write_config', {
        scope,
        projectPath: currentProject,
        key,
        value,
      })
      await refresh()
    },
    [currentProject, refresh],
  )

  const deleteConfig = useCallback(
    async (scope: 'global' | 'project', key: string) => {
      await invoke('delete_config', {
        scope,
        projectPath: currentProject,
        key,
      })
      await refresh()
    },
    [currentProject, refresh],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { config, loading, refresh, writeConfig, deleteConfig }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/hooks/useConfig.ts
git commit -m "feat(jacc): 添加 useConfig hook"
```

---

### 任务 2：通用设置页面

**文件：**
- 创建：`packages/jacc/src/pages/General.tsx`

- [ ] **步骤 1：创建 General.tsx**

```tsx
import { useConfig } from '@/hooks/useConfig'
import { SourceBadge } from '@/components/SourceBadge'

export function General() {
  const { config, loading, writeConfig } = useConfig()

  if (loading || !config) {
    return <div className="p-6 text-xs text-muted">加载中...</div>
  }

  const getItem = (key: string) => config.items.find((i) => i.key === key)

  const model = getItem('model')
  const effortLevel = getItem('effortLevel')
  const skipDangerous = getItem('skipDangerousModePermissionPrompt')
  const enabledPlugins = getItem('enabledPlugins')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-medium text-foreground">通用设置</h2>
        <div className="flex gap-1.5 items-center text-[10px] text-muted">
          图例:
          <SourceBadge scope="project" />
          <SourceBadge scope="global" />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* 模型 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">模型</div>
            <div className="text-[11px] text-muted">当前激活的模型配置</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground bg-sidebar px-2.5 py-1 rounded-[2px] border border-border">
              {(model?.value as string) || '未设置'}
            </span>
            {model && <SourceBadge scope={model.scope} />}
          </div>
        </div>

        {/* Effort Level */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">Effort Level</div>
            <div className="text-[11px] text-muted">推理努力程度</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={(effortLevel?.value as string) || 'high'}
              onChange={(e) =>
                writeConfig(effortLevel?.scope || 'global', 'effortLevel', e.target.value)
              }
              className="bg-sidebar border border-border text-foreground px-2.5 py-1 rounded-[2px] text-xs"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            {effortLevel && <SourceBadge scope={effortLevel.scope} />}
          </div>
        </div>

        {/* 跳过危险模式确认 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">跳过危险模式确认</div>
            <div className="text-[11px] text-muted">skipDangerousModePermissionPrompt</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                writeConfig(
                  skipDangerous?.scope || 'global',
                  'skipDangerousModePermissionPrompt',
                  !(skipDangerous?.value as boolean),
                )
              }
              className={`w-9 h-5 rounded-full relative transition-colors ${
                skipDangerous?.value ? 'bg-primary' : 'bg-border'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                  skipDangerous?.value ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
            {skipDangerous && <SourceBadge scope={skipDangerous.scope} />}
          </div>
        </div>

        {/* 启用的插件 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">启用的插件</div>
            <div className="text-[11px] text-muted">enabledPlugins</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {((enabledPlugins?.value as string[]) || []).map((p) => (
                <span key={p} className="text-[11px] px-2 py-0.5 bg-success-light text-success rounded-[2px]">
                  {p}
                </span>
              ))}
            </div>
            {enabledPlugins && <SourceBadge scope={enabledPlugins.scope} />}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/pages/General.tsx
git commit -m "feat(jacc): 实现通用设置页面"
```

---

### 任务 3：环境变量页面

**文件：**
- 创建：`packages/jacc/src/pages/EnvVars.tsx`

- [ ] **步骤 1：创建 EnvVars.tsx**

```tsx
import { useState } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { SourceBadge } from '@/components/SourceBadge'
import { Fab } from '@/components/Fab'

const MODEL_ENV_KEYS = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL']

export function EnvVars() {
  const { config, writeConfig, deleteConfig } = useConfig()
  const [showAdd, setShowAdd] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const envItem = config?.items.find((i) => i.key === 'env')
  const envObj = (envItem?.value as Record<string, string>) || {}
  const envScope = envItem?.scope || 'global'

  const entries = Object.entries(envObj)
  const regularEntries = entries.filter(([key]) => !MODEL_ENV_KEYS.includes(key))
  const modelEntries = entries.filter(([key]) => MODEL_ENV_KEYS.includes(key))

  async function handleAdd() {
    if (!newKey.trim()) return
    const updated = { ...envObj, [newKey]: newValue }
    await writeConfig(envScope, 'env', updated)
    setNewKey('')
    setNewValue('')
    setShowAdd(false)
  }

  async function handleDelete(key: string) {
    const updated = { ...envObj }
    delete updated[key]
    await writeConfig(envScope, 'env', updated)
  }

  async function handleChange(key: string, value: string) {
    const updated = { ...envObj, [key]: value }
    await writeConfig(envScope, 'env', updated)
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">环境变量</h2>

      {/* 模型变量提示 */}
      {modelEntries.length > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-warning-light border border-warning/30 rounded-[4px] mb-4 text-[11px] text-warning">
          <span>💡</span>
          <span>ANTHROPIC_BASE_URL、ANTHROPIC_AUTH_TOKEN 等模型相关变量由「模型库」统一管理</span>
        </div>
      )}

      {/* 表格 */}
      <div className="bg-card border border-border-light rounded-[4px] overflow-hidden">
        {/* 表头 */}
        <div className="flex px-3.5 py-2 bg-sidebar border-b border-border-light text-[11px] text-muted font-medium">
          <div className="flex-[2]">变量名</div>
          <div className="flex-[3]">值</div>
          <div className="w-[50px] text-center">来源</div>
          <div className="w-[30px]"></div>
        </div>

        {/* 普通变量 */}
        {regularEntries.map(([key, value]) => (
          <div key={key} className="flex items-center px-3.5 py-2.5 border-b border-border-light/50">
            <div className="flex-[2] text-xs font-mono font-medium text-foreground">{key}</div>
            <div className="flex-[3]">
              <input
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-[90%] bg-sidebar border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground"
              />
            </div>
            <div className="w-[50px] text-center">
              <SourceBadge scope={envScope} />
            </div>
            <div className="w-[30px] text-center">
              <button onClick={() => handleDelete(key)} className="text-border hover:text-danger text-sm">
                ×
              </button>
            </div>
          </div>
        ))}

        {/* 模型管理的变量（只读） */}
        {modelEntries.map(([key]) => (
          <div key={key} className="flex items-center px-3.5 py-2.5 border-b border-border-light/50 opacity-50">
            <div className="flex-[2] text-xs font-mono text-muted">{key}</div>
            <div className="flex-[3] text-[11px] text-muted italic">由模型库管理</div>
            <div className="w-[50px] text-center">
              <SourceBadge scope="models" />
            </div>
            <div className="w-[30px]"></div>
          </div>
        ))}
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="mt-3 p-3 bg-card border border-border-light rounded-[4px]">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-[11px] text-muted mb-1">变量名</div>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="MY_VAR"
                className="w-full bg-sidebar border border-border px-2 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
              />
            </div>
            <div className="flex-1">
              <div className="text-[11px] text-muted mb-1">值</div>
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                className="w-full bg-sidebar border border-border px-2 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
              />
            </div>
            <button onClick={handleAdd} className="px-3 py-1.5 bg-primary text-white text-xs rounded-[2px]">
              添加
            </button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 border border-border text-xs text-muted rounded-[2px]">
              取消
            </button>
          </div>
        </div>
      )}

      <Fab onClick={() => setShowAdd(true)} />
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/pages/EnvVars.tsx
git commit -m "feat(jacc): 实现环境变量页面"
```

---

### 任务 4：权限页面

**文件：**
- 创建：`packages/jacc/src/pages/Permissions.tsx`

- [ ] **步骤 1：创建 Permissions.tsx**

```tsx
import { useState } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { SourceBadge } from '@/components/SourceBadge'
import { Fab } from '@/components/Fab'

interface PermissionRule {
  tool: string
  pattern: string
}

export function Permissions() {
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
      <h2 className="text-base font-medium text-foreground mb-4">权限</h2>

      {/* 允许列表 */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-success mb-2 flex items-center gap-1.5">
          <span>✓</span> 允许 (Allow)
        </div>
        <div className="bg-card border border-border-light rounded-[4px] overflow-hidden">
          <div className="flex px-3.5 py-2 bg-sidebar border-b border-border-light text-[11px] text-muted font-medium">
            <div className="w-[50px]">类型</div>
            <div className="w-[50px]">工具</div>
            <div className="flex-1">模式</div>
            <div className="w-[50px] text-center">来源</div>
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
            <div className="px-3.5 py-3 text-[11px] text-muted text-center">暂无允许规则</div>
          )}
        </div>
      </div>

      {/* 拒绝列表 */}
      <div>
        <div className="text-xs font-semibold text-danger mb-2 flex items-center gap-1.5">
          <span>✗</span> 拒绝 (Deny)
        </div>
        <div className="bg-card border border-border-light rounded-[4px] overflow-hidden">
          <div className="flex px-3.5 py-2 bg-sidebar border-b border-border-light text-[11px] text-muted font-medium">
            <div className="w-[50px]">类型</div>
            <div className="w-[50px]">工具</div>
            <div className="flex-1">模式</div>
            <div className="w-[50px] text-center">来源</div>
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
            <div className="px-3.5 py-3 text-[11px] text-muted text-center">暂无拒绝规则</div>
          )}
        </div>
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="mt-4 p-3 bg-card border border-border-light rounded-[4px]">
          <div className="text-[13px] font-medium text-foreground mb-3">添加权限规则</div>
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
              <option value="project">项目级</option>
              <option value="global">全局</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="匹配模式，如 npm run *"
              className="flex-1 bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
            />
            <button onClick={handleAdd} className="px-3 py-1.5 bg-primary text-white text-xs rounded-[2px]">添加</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 border border-border text-xs text-muted rounded-[2px]">取消</button>
          </div>
        </div>
      )}

      <Fab onClick={() => setShowAdd(true)} />
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/pages/Permissions.tsx
git commit -m "feat(jacc): 实现权限配置页面"
```

---

### 任务 5：MCP 服务器页面

**文件：**
- 创建：`packages/jacc/src/pages/McpServers.tsx`

- [ ] **步骤 1：创建 McpServers.tsx**

```tsx
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useConfig } from '@/hooks/useConfig'
import { SourceBadge } from '@/components/SourceBadge'
import { Fab } from '@/components/Fab'

interface McpServer {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export function McpServers() {
  const { config, writeConfig } = useConfig()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newArgs, setNewArgs] = useState('')

  const mcpItem = config?.items.find((i) => i.key === 'mcpServers')
  const servers = (mcpItem?.value as Record<string, McpServer>) || {}
  const mcpScope = mcpItem?.scope || 'global'

  async function handleSave(name: string, server: McpServer) {
    const updated = { ...servers, [name]: server }
    await writeConfig(mcpScope, 'mcpServers', updated)
  }

  async function handleDelete(name: string) {
    const updated = { ...servers }
    delete updated[name]
    await writeConfig(mcpScope, 'mcpServers', updated)
    setExpanded(null)
  }

  async function handleAdd() {
    if (!newName.trim() || !newCommand.trim()) return
    const server: McpServer = {
      command: newCommand,
      args: newArgs ? newArgs.split(' ') : undefined,
    }
    const updated = { ...servers, [newName]: server }
    await writeConfig(mcpScope, 'mcpServers', updated)
    setNewName('')
    setNewCommand('')
    setNewArgs('')
    setShowAdd(false)
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">MCP 服务器</h2>

      <div className="flex flex-col gap-2">
        {Object.entries(servers).map(([name, server]) => (
          <div
            key={name}
            className={`bg-card border rounded-[4px] overflow-hidden ${
              expanded === name ? 'border-primary' : 'border-border-light'
            }`}
          >
            {/* 折叠头 */}
            <div
              onClick={() => setExpanded(expanded === name ? null : name)}
              className="flex items-center justify-between px-4 py-3 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 bg-success rounded-full" />
                <div>
                  <div className="text-[13px] font-medium text-foreground">{name}</div>
                  <div className="text-[11px] text-muted">
                    {server.command} {server.args?.join(' ') || ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SourceBadge scope={mcpScope} />
                {expanded === name ? (
                  <ChevronUp size={14} className="text-muted" />
                ) : (
                  <ChevronDown size={14} className="text-muted" />
                )}
              </div>
            </div>

            {/* 展开详情 */}
            {expanded === name && (
              <div className="px-4 pb-3.5 border-t border-border-light">
                <div className="flex flex-col gap-2.5 pt-3">
                  <div>
                    <div className="text-[11px] text-muted mb-1">命令 (command)</div>
                    <input
                      value={server.command}
                      onChange={(e) => handleSave(name, { ...server, command: e.target.value })}
                      className="w-full bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-muted mb-1">参数 (args)</div>
                    <input
                      value={server.args?.join(' ') || ''}
                      onChange={(e) =>
                        handleSave(name, {
                          ...server,
                          args: e.target.value ? e.target.value.split(' ') : undefined,
                        })
                      }
                      className="w-full bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-muted mb-1">环境变量 (env)</div>
                    <div className="bg-sidebar border border-border rounded-[2px] p-2">
                      {Object.entries(server.env || {}).map(([k, v]) => (
                        <div key={k} className="flex gap-2 items-center mb-1">
                          <input
                            value={k}
                            readOnly
                            className="flex-1 bg-card border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground"
                          />
                          <span className="text-muted">=</span>
                          <input
                            value={v}
                            onChange={(e) => {
                              const newEnv = { ...server.env, [k]: e.target.value }
                              handleSave(name, { ...server, env: newEnv })
                            }}
                            className="flex-1 bg-card border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <button
                      onClick={() => handleDelete(name)}
                      className="text-[11px] px-3 py-1.5 border border-border text-danger rounded-[2px] hover:bg-danger-light"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="mt-3 p-3 bg-card border border-border-light rounded-[4px]">
          <div className="text-[13px] font-medium text-foreground mb-3">添加 MCP 服务器</div>
          <div className="flex flex-col gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="名称，如 playwright" className="bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs text-foreground" />
            <input value={newCommand} onChange={(e) => setNewCommand(e.target.value)} placeholder="命令，如 npx" className="bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground" />
            <input value={newArgs} onChange={(e) => setNewArgs(e.target.value)} placeholder="参数（空格分隔），如 @anthropic/mcp-playwright" className="bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 border border-border text-xs text-muted rounded-[2px]">取消</button>
              <button onClick={handleAdd} className="px-3 py-1.5 bg-primary text-white text-xs rounded-[2px]">添加</button>
            </div>
          </div>
        </div>
      )}

      <Fab onClick={() => setShowAdd(true)} />
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/pages/McpServers.tsx
git commit -m "feat(jacc): 实现 MCP 服务器配置页面"
```

---

### 任务 6：集成页面到 Layout

**文件：**
- 修改：`packages/jacc/src/components/Layout.tsx`

- [ ] **步骤 1：更新 Layout.tsx 的 renderPage 函数**

替换 `PagePlaceholder` 引用为真实页面组件：

```tsx
import { General } from '@/pages/General'
import { EnvVars } from '@/pages/EnvVars'
import { Permissions } from '@/pages/Permissions'
import { McpServers } from '@/pages/McpServers'

// 在 renderPage 中：
case 'general':
  return <General />
case 'envvars':
  return <EnvVars />
case 'permissions':
  return <Permissions />
case 'mcp':
  return <McpServers />
```

- [ ] **步骤 2：验证前端构建**

运行：`cd D:/Project/jackit/packages/jacc && pnpm build`
预期：构建成功

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src/
git commit -m "feat(jacc): 集成配置页面到 Layout"
```
