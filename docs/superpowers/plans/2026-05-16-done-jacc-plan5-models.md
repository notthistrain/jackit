# jacc 计划 5：模型库页面 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现模型库页面，包括模型 CRUD、槽位切换、激活、测试连接和添加模型弹窗

**架构：** 模型数据存 SQLite，通过 useModels hook 调用 Tauri 命令。页面顶部槽位下拉切换 Opus/Sonnet/Haiku，列表展示模型，FAB 触发添加弹窗。

**技术栈：** React 19, Tailwind CSS 4, @tauri-apps/api, Zustand

**前置依赖：** 计划 3（前端核心框架）完成

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/hooks/useModels.ts` | 模型库 CRUD hook |
| `src/pages/Models.tsx` | 模型库页面 |
| `src/components/dialogs/AddModelDialog.tsx` | 添加/编辑模型弹窗 |

---

### 任务 1：useModels Hook

**文件：**
- 创建：`packages/jacc/src/hooks/useModels.ts`

- [ ] **步骤 1：创建 useModels.ts**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface Model {
  id: number
  alias: string
  base_url: string
  api_key: string
  model_name: string
  slot: string | null
  created_at: string
  updated_at: string
}

export interface CreateModelInput {
  alias: string
  base_url: string
  api_key: string
  model_name: string
  slot: string | null
}

export interface UpdateModelInput {
  alias?: string
  base_url?: string
  api_key?: string
  model_name?: string
}

export function useModels() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<Model[]>('list_models')
      setModels(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(async (input: CreateModelInput) => {
    await invoke('add_model', { input })
    await refresh()
  }, [refresh])

  const update = useCallback(async (id: number, input: UpdateModelInput) => {
    await invoke('update_model', { id, input })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await invoke('delete_model', { id })
    await refresh()
  }, [refresh])

  const activate = useCallback(async (id: number, slot: string) => {
    await invoke('activate_model', { id, slot })
    await refresh()
  }, [refresh])

  const test = useCallback(async (id: number): Promise<string> => {
    return invoke<string>('test_model', { id })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { models, loading, refresh, add, update, remove, activate, test }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/hooks/useModels.ts
git commit -m "feat(jacc): 添加 useModels hook"
```

---

### 任务 2：AddModelDialog 组件

**文件：**
- 创建：`packages/jacc/src/components/dialogs/AddModelDialog.tsx`

- [ ] **步骤 1：创建 AddModelDialog.tsx**

```tsx
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type { CreateModelInput } from '@/hooks/useModels'

interface AddModelDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateModelInput) => Promise<void>
}

export function AddModelDialog({ open, onClose, onSubmit }: AddModelDialogProps) {
  const [alias, setAlias] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [slot, setSlot] = useState<string>('')
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  async function handleSubmit() {
    if (!alias || !baseUrl || !apiKey || !modelName) return
    setSubmitting(true)
    try {
      await onSubmit({
        alias,
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName,
        slot: slot || null,
      })
      // 重置表单
      setAlias('')
      setBaseUrl('')
      setApiKey('')
      setModelName('')
      setSlot('')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[400px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-5">添加模型配置</h3>

        <div className="flex flex-col gap-3.5">
          <div>
            <div className="text-[11px] text-muted mb-1">别名 *</div>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="如：Claude Opus 官方"
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">API 端点 (Base URL) *</div>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.anthropic.com"
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">API Key *</div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-sidebar border border-border px-3 py-2 pr-9 rounded-[4px] text-xs text-foreground"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">模型名称 *</div>
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="claude-opus-4-6"
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">默认槽位</div>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            >
              <option value="">不绑定</option>
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !alias || !baseUrl || !apiKey || !modelName}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/components/dialogs/AddModelDialog.tsx
git commit -m "feat(jacc): 添加模型弹窗组件"
```

---

### 任务 3：Models 页面

**文件：**
- 创建：`packages/jacc/src/pages/Models.tsx`

- [ ] **步骤 1：创建 Models.tsx**

```tsx
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Fab } from '@/components/Fab'
import { AddModelDialog } from '@/components/dialogs/AddModelDialog'
import { useModels } from '@/hooks/useModels'

type Slot = 'opus' | 'sonnet' | 'haiku'

export function Models() {
  const { models, add, activate, test, remove } = useModels()
  const [currentSlot, setCurrentSlot] = useState<Slot>('opus')
  const [showAdd, setShowAdd] = useState(false)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null)
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

  const activeModel = models.find((m) => m.slot === currentSlot)

  async function handleTest(id: number) {
    setTesting(id)
    setTestResult(null)
    try {
      const msg = await test(id)
      setTestResult({ id, msg, ok: true })
    } catch (e) {
      setTestResult({ id, msg: String(e), ok: false })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="p-6">
      {/* 标题 + 槽位切换 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-foreground">模型库</h2>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground">当前槽位:</span>
          <select
            value={currentSlot}
            onChange={(e) => setCurrentSlot(e.target.value as Slot)}
            className="bg-card border border-border px-3 py-1.5 rounded-[4px] text-xs font-medium text-foreground"
          >
            <option value="opus">Opus</option>
            <option value="sonnet">Sonnet</option>
            <option value="haiku">Haiku</option>
          </select>
        </div>
      </div>

      {/* 当前激活模型 */}
      {activeModel && (
        <div className="flex items-center justify-between px-4 py-3 bg-primary-light border border-primary/30 rounded-[4px] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <div>
              <div className="text-[13px] font-semibold text-foreground">{activeModel.alias}</div>
              <div className="text-[11px] text-muted">
                {activeModel.base_url} · {activeModel.model_name}
              </div>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 bg-primary text-white rounded-[12px]">已激活</span>
        </div>
      )}

      {!activeModel && (
        <div className="px-4 py-3 bg-sidebar border border-border-light rounded-[4px] mb-4 text-xs text-muted text-center">
          当前槽位未绑定模型
        </div>
      )}

      {/* 模型列表 */}
      <div className="flex flex-col gap-2">
        {models
          .filter((m) => m.slot !== currentSlot)
          .map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between px-4 py-3 bg-card border border-border-light rounded-[4px]"
            >
              <div>
                <div className="text-[13px] font-medium text-foreground">{model.alias}</div>
                <div className="text-[11px] text-muted">
                  {model.base_url} · {model.model_name}
                </div>
                {testResult?.id === model.id && (
                  <div className={`text-[10px] mt-1 ${testResult.ok ? 'text-success' : 'text-danger'}`}>
                    {testResult.msg}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => activate(model.id, currentSlot)}
                  className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar"
                >
                  激活
                </button>
                <button
                  onClick={() => handleTest(model.id)}
                  disabled={testing === model.id}
                  className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar disabled:opacity-50"
                >
                  {testing === model.id ? '...' : '测试'}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === model.id ? null : model.id)}
                    className="text-[11px] px-2 py-1 bg-card border border-border rounded-[2px] text-muted hover:bg-sidebar"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuOpen === model.id && (
                    <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-10 py-1 min-w-[80px]">
                      <button
                        onClick={() => { remove(model.id); setMenuOpen(null) }}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-danger hover:bg-sidebar"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>

      <Fab onClick={() => setShowAdd(true)} />
      <AddModelDialog open={showAdd} onClose={() => setShowAdd(false)} onSubmit={add} />
    </div>
  )
}
```

- [ ] **步骤 2：在 Layout.tsx 中集成 Models 页面**

```tsx
import { Models } from '@/pages/Models'

// 在 renderPage switch 中：
case 'models':
  return <Models />
```

- [ ] **步骤 3：验证前端构建**

运行：`cd D:/Project/jackit/packages/jacc && pnpm build`
预期：构建成功

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src/
git commit -m "feat(jacc): 实现模型库页面（列表/槽位切换/激活/测试/添加）"
```
