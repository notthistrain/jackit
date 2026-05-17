# 模型库层级数据模型 - 前端实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 重写前端 hooks、模型库页面（3 级折叠树）、通用页面（树选择器）适配新的 Provider → APIKey → Model 三层后端。

**架构：** 拆分 hooks 为 4 个独立模块。模型库页面用嵌套 div 实现折叠树。通用页面用自定义 TreeSelect 组件替代平铺下拉。TDD：hooks 先写测试。

**技术栈：** React + TypeScript、vitest + @testing-library/react、Tauri invoke

**前置条件：** 后端计划（2026-05-17-model-library-hierarchy-backend-plan）已完成。

---

## 文件结构

### 创建
- `packages/jacc/src/hooks/useProviders.ts` — Provider CRUD hook
- `packages/jacc/src/hooks/useApiKeys.ts` — APIKey CRUD hook（按 provider_id）
- `packages/jacc/src/hooks/useSlotBindings.ts` — 从 useModels 分离
- `packages/jacc/src/components/TreeSelect.tsx` — 树形选择器（通用页面用）
- `packages/jacc/src/components/dialogs/AddProviderDialog.tsx` — 添加/编辑 Provider
- `packages/jacc/src/components/dialogs/AddApiKeyDialog.tsx` — 添加/编辑 APIKey

### 修改
- `packages/jacc/src/hooks/useModels.ts` — 重写为按 api_key_id 查询
- `packages/jacc/src/hooks/useModels.test.ts` — 适配新 hooks
- `packages/jacc/src/pages/Models.tsx` — 重写为 3 级折叠树
- `packages/jacc/src/pages/General.tsx` — 树选择器替代平铺下拉
- `packages/jacc/src/components/dialogs/AddModelDialog.tsx` — 简化为 api_key_id + model_name
- `packages/jacc/src/i18n/locales/zh.json` — 新增 key
- `packages/jacc/src/i18n/locales/en.json` — 新增 key

### 删除（useModels.ts 中不再需要的接口）
- `CreateModelInput` 中的 `alias`, `base_url`, `api_key`
- `Model` 中的 `alias`, `base_url`, `api_key_masked`

---

### 任务 1：Hooks 重写 + 测试

**文件：**
- 创建：`packages/jacc/src/hooks/useProviders.ts`
- 创建：`packages/jacc/src/hooks/useApiKeys.ts`
- 修改：`packages/jacc/src/hooks/useModels.ts`
- 创建：`packages/jacc/src/hooks/useSlotBindings.ts`
- 修改：`packages/jacc/src/hooks/useModels.test.ts`

- [ ] **步骤 1：编写所有 hook 测试**

重写 `packages/jacc/src/hooks/useModels.test.ts`，覆盖 4 个 hook：

```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { useProviders } from './useProviders'
import { useApiKeys } from './useApiKeys'
import { useModels } from './useModels'
import { useSlotBindings } from './useSlotBindings'

// ── useProviders 测试 ──

describe('useProviders', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('mounts and calls list_providers', async () => {
    const mockProviders = [
      { id: 1, name: 'Anthropic', base_url: 'https://api.anthropic.com', notes: null, created_at: '', updated_at: '' },
    ]
    vi.mocked(invoke).mockResolvedValueOnce(mockProviders)

    const { result } = renderHook(() => useProviders())

    await waitFor(() => {
      expect(result.current.providers).toEqual(mockProviders)
    })
    expect(invoke).toHaveBeenCalledWith('list_providers')
  })

  test('.add() calls add_provider then refreshes', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial list
      .mockResolvedValueOnce({ id: 1, name: 'New', base_url: 'https://new.com', notes: null, created_at: '', updated_at: '' }) // add
      .mockResolvedValueOnce([{ id: 1, name: 'New', base_url: 'https://new.com', notes: null, created_at: '', updated_at: '' }]) // refresh

    const { result } = renderHook(() => useProviders())
    await waitFor(() => expect(result.current.providers).toEqual([]))

    await act(async () => {
      await result.current.add({ name: 'New', base_url: 'https://new.com', notes: null })
    })

    expect(invoke).toHaveBeenCalledWith('add_provider', {
      input: { name: 'New', base_url: 'https://new.com', notes: null },
    })
  })

  test('.remove() calls delete_provider then refreshes', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial list
      .mockResolvedValueOnce(undefined) // delete
      .mockResolvedValueOnce([]) // refresh

    const { result } = renderHook(() => useProviders())
    await waitFor(() => expect(result.current.providers).toEqual([]))

    await act(async () => {
      await result.current.remove(1)
    })

    expect(invoke).toHaveBeenCalledWith('delete_provider', { id: 1 })
  })
})

// ── useApiKeys 测试 ──

describe('useApiKeys', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('calls list_api_keys with provider_id on mount', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { id: 1, provider_id: 10, name: 'Main', api_key_masked: 'sk-ant-1***', notes: null, created_at: '', updated_at: '' },
    ])

    const { result } = renderHook(() => useApiKeys(10))

    await waitFor(() => {
      expect(result.current.apiKeys).toHaveLength(1)
    })
    expect(invoke).toHaveBeenCalledWith('list_api_keys', { provider_id: 10 })
  })

  test('.add() calls add_api_key then refreshes', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial
      .mockResolvedValueOnce(undefined) // add
      .mockResolvedValueOnce([]) // refresh

    const { result } = renderHook(() => useApiKeys(10))
    await waitFor(() => expect(result.current.apiKeys).toEqual([]))

    await act(async () => {
      await result.current.add({ provider_id: 10, name: 'Key', api_key: 'sk-test', notes: null })
    })

    expect(invoke).toHaveBeenCalledWith('add_api_key', {
      input: { provider_id: 10, name: 'Key', api_key: 'sk-test', notes: null },
    })
  })
})

// ── useModels 测试 ──

describe('useModels', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('calls list_models with api_key_id on mount', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { id: 1, api_key_id: 5, model_name: 'claude-opus-4-6', context_size: '200k', created_at: '', updated_at: '' },
    ])

    const { result } = renderHook(() => useModels(5))

    await waitFor(() => {
      expect(result.current.models).toHaveLength(1)
    })
    expect(invoke).toHaveBeenCalledWith('list_models', { api_key_id: 5 })
  })

  test('.add() calls add_model then refreshes', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial
      .mockResolvedValueOnce(undefined) // add
      .mockResolvedValueOnce([]) // refresh

    const { result } = renderHook(() => useModels(5))
    await waitFor(() => expect(result.current.models).toEqual([]))

    await act(async () => {
      await result.current.add({ api_key_id: 5, model_name: 'test', context_size: null })
    })

    expect(invoke).toHaveBeenCalledWith('add_model', {
      input: { api_key_id: 5, model_name: 'test', context_size: null },
    })
  })

  test('.test() calls test_model and returns result', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial list
      .mockResolvedValueOnce('CONNECTION_SUCCESS')

    const { result } = renderHook(() => useModels(5))
    await waitFor(() => expect(result.current.models).toEqual([]))

    let res: string = ''
    await act(async () => {
      res = await result.current.test(1)
    })
    expect(res).toBe('CONNECTION_SUCCESS')
    expect(invoke).toHaveBeenCalledWith('test_model', { id: 1 })
  })
})

// ── useSlotBindings 测试 ──

describe('useSlotBindings', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('calls get_slot_bindings on mount', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { slot: 'opus', model_id: 1, model_name: 'claude-opus-4-6', context_size: null, api_key: 'sk-ant-aaa', base_url: 'https://api.anthropic.com', provider_name: 'Anthropic' },
    ])

    const { result } = renderHook(() => useSlotBindings())

    await waitFor(() => {
      expect(result.current.bindings).toHaveLength(1)
    })
    expect(invoke).toHaveBeenCalledWith('get_slot_bindings')
  })

  test('.bind() calls bind_slot with slot + modelId', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial
      .mockResolvedValueOnce(undefined) // bind
      .mockResolvedValueOnce([]) // refresh

    const { result } = renderHook(() => useSlotBindings())
    await waitFor(() => expect(result.current.bindings).toEqual([]))

    await act(async () => {
      await result.current.bind('opus', 1)
    })

    expect(invoke).toHaveBeenCalledWith('bind_slot', { slot: 'opus', modelId: 1 })
  })

  test('.setCurrentModel() calls set_current_model with slot + contextSize', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([]) // initial
      .mockResolvedValueOnce(undefined) // set_current_model

    const { result } = renderHook(() => useSlotBindings())
    await waitFor(() => expect(result.current.bindings).toEqual([]))

    await act(async () => {
      await result.current.setCurrentModel('opus', '1m')
    })

    expect(invoke).toHaveBeenCalledWith('set_current_model', { slot: 'opus', contextSize: '1m' })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc && npx vitest run src/hooks/useModels.test.ts`
预期：FAIL — useProviders, useApiKeys, useSlotBindings 模块不存在

- [ ] **步骤 3：实现 useProviders hook**

创建 `packages/jacc/src/hooks/useProviders.ts`：

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface Provider {
  id: number
  name: string
  base_url: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateProviderInput {
  name: string
  base_url: string
  notes: string | null
}

export interface UpdateProviderInput {
  name?: string
  base_url?: string
  notes?: string
}

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<Provider[]>('list_providers')
      setProviders(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(async (input: CreateProviderInput) => {
    await invoke('add_provider', { input })
    await refresh()
  }, [refresh])

  const update = useCallback(async (id: number, input: UpdateProviderInput) => {
    await invoke('update_provider', { id, input })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await invoke('delete_provider', { id })
    await refresh()
  }, [refresh])

  useEffect(() => { refresh() }, [refresh])

  return { providers, loading, refresh, add, update, remove }
}
```

- [ ] **步骤 4：实现 useApiKeys hook**

创建 `packages/jacc/src/hooks/useApiKeys.ts`：

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface ApiKeyView {
  id: number
  provider_id: number
  name: string
  api_key_masked: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateApiKeyInput {
  provider_id: number
  name: string
  api_key: string
  notes: string | null
}

export interface UpdateApiKeyInput {
  name?: string
  api_key?: string
  notes?: string
}

export function useApiKeys(providerId: number) {
  const [apiKeys, setApiKeys] = useState<ApiKeyView[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!providerId) return
    setLoading(true)
    try {
      const list = await invoke<ApiKeyView[]>('list_api_keys', { provider_id: providerId })
      setApiKeys(list)
    } finally {
      setLoading(false)
    }
  }, [providerId])

  const add = useCallback(async (input: CreateApiKeyInput) => {
    await invoke('add_api_key', { input })
    await refresh()
  }, [refresh])

  const update = useCallback(async (id: number, input: UpdateApiKeyInput) => {
    await invoke('update_api_key', { id, input })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await invoke('delete_api_key', { id })
    await refresh()
  }, [refresh])

  useEffect(() => { refresh() }, [refresh])

  return { apiKeys, loading, refresh, add, update, remove }
}
```

- [ ] **步骤 5：重写 useModels hook**

完全重写 `packages/jacc/src/hooks/useModels.ts`（移除旧的扁平接口，不再导出 useSlotBindings）：

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface Model {
  id: number
  api_key_id: number
  model_name: string
  context_size: string | null
  created_at: string
  updated_at: string
}

export interface CreateModelInput {
  api_key_id: number
  model_name: string
  context_size: string | null
}

export interface UpdateModelInput {
  model_name?: string
  context_size?: string
}

export function useModels(apiKeyId: number) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!apiKeyId) return
    setLoading(true)
    try {
      const list = await invoke<Model[]>('list_models', { api_key_id: apiKeyId })
      setModels(list)
    } finally {
      setLoading(false)
    }
  }, [apiKeyId])

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

  const test = useCallback(async (id: number): Promise<string> => {
    return invoke<string>('test_model', { id })
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { models, loading, refresh, add, update, remove, test }
}
```

- [ ] **步骤 6：创建 useSlotBindings hook**

创建 `packages/jacc/src/hooks/useSlotBindings.ts`：

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface SlotBinding {
  slot: string
  model_id: number
  model_name: string
  context_size: string | null
  api_key: string
  base_url: string
  provider_name: string
}

export function useSlotBindings() {
  const [bindings, setBindings] = useState<SlotBinding[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<SlotBinding[]>('get_slot_bindings')
      setBindings(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const bind = useCallback(async (slot: string, modelId: number) => {
    await invoke('bind_slot', { slot, modelId })
    await refresh()
  }, [refresh])

  const unbind = useCallback(async (slot: string) => {
    await invoke('unbind_slot', { slot })
    await refresh()
  }, [refresh])

  const setCurrentModel = useCallback(async (slot: string, contextSize: string | null) => {
    await invoke('set_current_model', { slot, contextSize })
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { bindings, loading, refresh, bind, unbind, setCurrentModel }
}
```

- [ ] **步骤 7：运行测试验证通过**

运行：`cd packages/jacc && npx vitest run src/hooks/useModels.test.ts`
预期：所有测试 PASS

- [ ] **步骤 8：Commit**

```bash
git add packages/jacc/src/hooks/
git commit -m "refactor(jacc/hooks): 拆分为 useProviders/useApiKeys/useModels/useSlotBindings"
```

---

### 任务 2：对话框组件

**文件：**
- 创建：`packages/jacc/src/components/dialogs/AddProviderDialog.tsx`
- 创建：`packages/jacc/src/components/dialogs/AddApiKeyDialog.tsx`
- 修改：`packages/jacc/src/components/dialogs/AddModelDialog.tsx`

- [ ] **步骤 1：创建 AddProviderDialog**

创建 `packages/jacc/src/components/dialogs/AddProviderDialog.tsx`：

```typescript
import { useEffect, useState } from 'react'
import type { CreateProviderInput, UpdateProviderInput } from '@/hooks/useProviders'
import { useT } from '@/i18n'

interface ProviderDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateProviderInput) => Promise<void>
  initialValues?: {
    name: string
    base_url: string
    notes: string
  }
}

export function AddProviderDialog({ open, onClose, onSubmit, initialValues }: ProviderDialogProps) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && initialValues) {
      setName(initialValues.name)
      setBaseUrl(initialValues.base_url)
      setNotes(initialValues.notes)
    } else if (!open) {
      setName(''); setBaseUrl(''); setNotes('')
    }
  }, [open, initialValues])

  if (!open) return null
  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!name || !baseUrl) return
    setSubmitting(true)
    try {
      await onSubmit({ name, base_url: baseUrl, notes: notes || null })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[400px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-5">
          {isEdit ? t('providers.dialog.editTitle') : t('providers.dialog.addTitle')}
        </h3>
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="text-[11px] text-muted mb-1">{t('providers.dialog.name')} *</div>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('providers.dialog.namePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('providers.dialog.baseUrl')} *</div>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t('providers.dialog.baseUrlPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('providers.dialog.notes')}</div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={t('providers.dialog.notesPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar">
            {t('models.dialog.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !name || !baseUrl}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50">
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：创建 AddApiKeyDialog**

创建 `packages/jacc/src/components/dialogs/AddApiKeyDialog.tsx`：

```typescript
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CreateApiKeyInput } from '@/hooks/useApiKeys'
import { useT } from '@/i18n'

interface ApiKeyDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateApiKeyInput) => Promise<void>
  providerId: number
  initialValues?: {
    name: string
    api_key: string
    notes: string
  }
}

export function AddApiKeyDialog({ open, onClose, onSubmit, providerId, initialValues }: ApiKeyDialogProps) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [notes, setNotes] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && initialValues) {
      setName(initialValues.name)
      setApiKey(initialValues.api_key)
      setNotes(initialValues.notes)
    } else if (!open) {
      setName(''); setApiKey(''); setNotes('')
    }
  }, [open, initialValues])

  if (!open) return null
  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!name || (!isEdit && !apiKey)) return
    setSubmitting(true)
    try {
      await onSubmit({
        provider_id: providerId,
        name,
        api_key: apiKey,
        notes: notes || null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[400px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-5">
          {isEdit ? t('apiKeys.dialog.editTitle') : t('apiKeys.dialog.addTitle')}
        </h3>
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="text-[11px] text-muted mb-1">{t('apiKeys.dialog.name')} {!isEdit && '*'}</div>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('apiKeys.dialog.namePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">
              {isEdit ? t('models.dialog.apiKeyEdit') : t('models.dialog.apiKey')} {!isEdit && '*'}
            </div>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isEdit ? t('models.dialog.apiKeyEditPlaceholder') : t('models.dialog.apiKeyPlaceholder')}
                className="w-full bg-sidebar border border-border px-3 py-2 pr-9 rounded-[4px] text-xs text-foreground" />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('apiKeys.dialog.notes')}</div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={t('apiKeys.dialog.notesPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar">
            {t('models.dialog.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !name || (!isEdit && !apiKey)}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50">
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：重写 AddModelDialog**

完全重写 `packages/jacc/src/components/dialogs/AddModelDialog.tsx`（简化：只需 api_key_id + model_name + context_size）：

```typescript
import { useEffect, useState } from 'react'
import type { CreateModelInput } from '@/hooks/useModels'
import { useT } from '@/i18n'

interface ModelDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateModelInput) => Promise<void>
  apiKeyId: number
  initialValues?: {
    model_name: string
    context_size: string
  }
}

export function AddModelDialog({ open, onClose, onSubmit, apiKeyId, initialValues }: ModelDialogProps) {
  const { t } = useT()
  const [modelName, setModelName] = useState('')
  const [contextSize, setContextSize] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && initialValues) {
      setModelName(initialValues.model_name)
      setContextSize(initialValues.context_size)
    } else if (!open) {
      setModelName(''); setContextSize('')
    }
  }, [open, initialValues])

  if (!open) return null
  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!modelName) return
    setSubmitting(true)
    try {
      await onSubmit({
        api_key_id: apiKeyId,
        model_name: modelName,
        context_size: contextSize || null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[400px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-5">
          {isEdit ? t('models.dialog.editTitle') : t('models.dialog.addTitle')}
        </h3>
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.modelName')} *</div>
            <input value={modelName} onChange={(e) => setModelName(e.target.value)}
              placeholder={t('models.dialog.modelNamePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.contextSize')}</div>
            <input value={contextSize} onChange={(e) => setContextSize(e.target.value)}
              placeholder={t('models.dialog.contextSizePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar">
            {t('models.dialog.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !modelName}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50">
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 4：TypeScript 编译验证**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：无错误

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/components/dialogs/
git commit -m "feat(jacc): 添加 Provider/APIKey 对话框，简化 ModelDialog"
```

---

### 任务 3：模型库页面 - 3 级折叠树

**文件：**
- 修改：`packages/jacc/src/pages/Models.tsx`

- [ ] **步骤 1：重写 Models.tsx**

完全重写 `packages/jacc/src/pages/Models.tsx`。3 级折叠树，每级可 CRUD。

```typescript
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Fab } from '@/components/Fab'
import { AddApiKeyDialog } from '@/components/dialogs/AddApiKeyDialog'
import { AddModelDialog } from '@/components/dialogs/AddModelDialog'
import { AddProviderDialog } from '@/components/dialogs/AddProviderDialog'
import { useApiKeys, type ApiKeyView } from '@/hooks/useApiKeys'
import { useModels, type Model } from '@/hooks/useModels'
import { useProviders, type Provider } from '@/hooks/useProviders'
import { useT } from '@/i18n'

export function Models() {
  const { t } = useT()
  const { providers, add: addProvider, update: updateProvider, remove: removeProvider } = useProviders()

  // 折叠状态
  const [expandedProviders, setExpandedProviders] = useState<Set<number>>(new Set())
  const [expandedKeys, setExpandedKeys] = useState<Set<number>>(new Set())

  // 对话框状态
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [addKeyFor, setAddKeyFor] = useState<number | null>(null)
  const [editingKey, setEditingKey] = useState<ApiKeyView | null>(null)
  const [addModelFor, setAddModelFor] = useState<number | null>(null)
  const [editingModel, setEditingModel] = useState<{ model: Model; apiKeyId: number } | null>(null)

  // 菜单状态
  const [menuOpen, setMenuOpen] = useState<{ type: string; id: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (menuOpen === null) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  function toggleProvider(id: number) {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleKey(id: number) {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function formatTestResult(raw: string): string {
    if (raw === 'CONNECTION_SUCCESS') return t('models.testSuccess')
    if (raw.startsWith('CONNECTION_FAILED:')) return t('models.testFailed', { error: raw.slice(18) })
    if (raw.startsWith('HTTP_ERROR:')) return t('models.testFailed', { error: raw.slice(11) })
    return raw
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('models.title')}</h2>

      <div className="flex flex-col gap-1">
        {providers.map((provider) => (
          <ProviderNode
            key={provider.id}
            provider={provider}
            expanded={expandedProviders.has(provider.id)}
            onToggle={() => toggleProvider(provider.id)}
            expandedKeys={expandedKeys}
            onToggleKey={toggleKey}
            onEdit={() => setEditingProvider(provider)}
            onDelete={() => removeProvider(provider.id)}
            onAddKey={() => setAddKeyFor(provider.id)}
            onEditKey={(key) => setEditingKey(key)}
            onDeleteKey={(id) => {/* 需要从 useApiKeys 获取 remove */}}
            onAddModel={(apiKeyId) => setAddModelFor(apiKeyId)}
            onEditModel={(model, apiKeyId) => setEditingModel({ model, apiKeyId })}
            onDeleteModel={() => {}}
            onTestModel={() => {}}
            formatTestResult={formatTestResult}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            menuRef={menuRef}
            t={t}
          />
        ))}
      </div>

      {providers.length === 0 && (
        <div className="px-4 py-3 bg-sidebar border border-border-light rounded-[4px] text-xs text-muted text-center">
          {t('models.empty')}
        </div>
      )}

      <Fab onClick={() => setShowAddProvider(true)} />

      {/* 对话框 */}
      <AddProviderDialog
        open={showAddProvider}
        onClose={() => setShowAddProvider(false)}
        onSubmit={addProvider}
      />
      <AddProviderDialog
        open={!!editingProvider}
        onClose={() => setEditingProvider(null)}
        onSubmit={async (input) => {
          if (editingProvider) await updateProvider(editingProvider.id, input)
        }}
        initialValues={editingProvider ? {
          name: editingProvider.name,
          base_url: editingProvider.base_url,
          notes: editingProvider.notes || '',
        } : undefined}
      />
      <AddApiKeyDialog
        open={addKeyFor !== null}
        onClose={() => setAddKeyFor(null)}
        onSubmit={async (input) => { /* 需要 useApiKeys(providerId).add */ }}
        providerId={addKeyFor || 0}
      />
      <AddModelDialog
        open={addModelFor !== null}
        onClose={() => setAddModelFor(null)}
        onSubmit={async (input) => { /* 需要 useModels(apiKeyId).add */ }}
        apiKeyId={addModelFor || 0}
      />
    </div>
  )
}
```

**实现说明：** 上方代码骨架展示了树结构，但存在一个设计挑战——`useApiKeys(providerId)` 和 `useModels(apiKeyId)` 是带参数的 hook，不能在循环中条件调用。实际实现需用子组件来持有这些 hook：

```typescript
// 子组件：持有 useApiKeys hook
function ProviderNode({ provider, expanded, ... }) {
  const { apiKeys, add, remove, update } = useApiKeys(provider.id)
  // 渲染 provider 行 + 展开后的 apiKeys 列表
}

// 子组件：持有 useModels hook
function ApiKeyNode({ apiKey, provider, expanded, ... }) {
  const { models, add, remove, update, test } = useModels(apiKey.id)
  // 渲染 apiKey 行 + 展开后的 models 列表
}
```

每个子组件内部管理自己的展开状态、对话框、菜单、测试结果。这是 React hooks 规则要求的——不能在条件/循环中调用 hooks。

由于组件较大但结构重复（3 级都是列表 + CRUD 操作），实现时提取一个共享的 `ActionMenu` 小组件来减少重复代码。

- [ ] **步骤 2：TypeScript 编译验证**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src/pages/Models.tsx
git commit -m "feat(jacc): 重写模型库页面为 3 级折叠树"
```

---

### 任务 4：TreeSelect 组件 + 通用页面

**文件：**
- 创建：`packages/jacc/src/components/TreeSelect.tsx`
- 修改：`packages/jacc/src/pages/General.tsx`

- [ ] **步骤 1：创建 TreeSelect 组件**

创建 `packages/jacc/src/components/TreeSelect.tsx`。一个下拉面板，显示 Provider → APIKey → Model 树，选择 Model 叶节点。

```typescript
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useProviders } from '@/hooks/useProviders'
import { useApiKeys } from '@/hooks/useApiKeys'
import { useModels, type Model } from '@/hooks/useModels'

interface TreeSelectProps {
  value: number | null  // 选中的 model_id
  onChange: (modelId: number) => void
  placeholder?: string
}

export function TreeSelect({ value, onChange, placeholder = 'Select model...' }: TreeSelectProps) {
  const [open, setOpen] = useState(false)
  const [expandedProviders, setExpandedProviders] = useState<Set<number>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  const { providers } = useProviders()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // 找到当前选中的模型名（用于显示）
  const [selectedLabel, setSelectedLabel] = useState<string>('')
  // 遍历查找选中模型的标签——简化方案：在选中时记录

  function toggleProvider(id: number) {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 bg-sidebar border border-border text-foreground px-2 py-1.5 rounded-[2px] text-xs min-w-[200px]"
      >
        <span className="flex-1 text-left truncate">
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={12} className="text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-20 min-w-[300px] max-h-[300px] overflow-y-auto">
          {providers.map((provider) => (
            <ProviderTreeItem
              key={provider.id}
              provider={provider}
              expanded={expandedProviders.has(provider.id)}
              onToggle={() => toggleProvider(provider.id)}
              selectedModelId={value}
              onSelect={(modelId, label) => {
                onChange(modelId)
                setSelectedLabel(label)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProviderTreeItem({ provider, expanded, onToggle, selectedModelId, onSelect }: {
  provider: { id: number; name: string }
  expanded: boolean
  onToggle: () => void
  selectedModelId: number | null
  onSelect: (modelId: number, label: string) => void
}) {
  const { apiKeys } = useApiKeys(provider.id)

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 hover:bg-sidebar cursor-pointer text-xs font-medium"
        onClick={onToggle}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{provider.name}</span>
      </div>
      {expanded && apiKeys.map((ak) => (
        <ApiKeyTreeItem
          key={ak.id}
          apiKey={ak}
          providerName={provider.name}
          selectedModelId={selectedModelId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function ApiKeyTreeItem({ apiKey, providerName, selectedModelId, onSelect }: {
  apiKey: { id: number; name: string }
  providerName: string
  selectedModelId: number | null
  onSelect: (modelId: number, label: string) => void
}) {
  const { models } = useModels(apiKey.id)

  return (
    <div>
      <div className="px-6 py-1 text-[11px] text-muted">{apiKey.name}</div>
      {models.map((m) => (
        <div
          key={m.id}
          className={`px-8 py-1.5 text-xs cursor-pointer hover:bg-sidebar ${
            selectedModelId === m.id ? 'text-primary font-medium' : 'text-foreground'
          }`}
          onClick={() => onSelect(m.id, `${providerName} / ${apiKey.name} / ${m.model_name}`)}
        >
          {m.model_name}{m.context_size ? ` (${m.context_size})` : ''}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **步骤 2：更新 General.tsx**

替换 `General.tsx` 中的 slot 绑定 UI，使用 TreeSelect 替代平铺下拉。修改导入和 slot 区域：

```typescript
// 替换导入
import { TreeSelect } from '@/components/TreeSelect'
import { useSlotBindings } from '@/hooks/useSlotBindings'
// 移除 useModels 导入（slot 绑定不再需要全量模型列表）

// 在 slot 绑定区域，替换 select 为 TreeSelect：
{SLOTS.map((slot) => {
  const binding = getBinding(slot)
  return (
    <div key={slot} className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted w-[52px]">{SLOT_LABELS[slot]}</span>
      <TreeSelect
        value={binding?.model_id ?? null}
        onChange={(modelId) => handleSlotModelChange(slot, modelId)}
        placeholder={t('general.slot.unbound')}
      />
      <span className={`text-[10px] w-[40px] text-center ${binding ? 'text-success' : 'text-muted'}`}>
        {binding ? binding.provider_name : t('general.slot.unboundLabel')}
      </span>
    </div>
  )
})}
```

`handleSlotModelChange` 更新为：

```typescript
async function handleSlotModelChange(slot: Slot, modelId: number) {
  setSlotError(null)
  try {
    await bind(slot, modelId)
  } catch (e) {
    setSlotError(e instanceof Error ? e.message : String(e))
  }
}
```

unbind 通过 TreeSelect 不提供"清空"选项来处理，或者添加一个"清除绑定"按钮。

- [ ] **步骤 3：TypeScript 编译验证**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：无错误

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src/components/TreeSelect.tsx packages/jacc/src/pages/General.tsx
git commit -m "feat(jacc): 添加 TreeSelect 组件，更新通用页面 slot 绑定"
```

---

### 任务 5：i18n + 清理 + 集成验证

**文件：**
- 修改：`packages/jacc/src/i18n/locales/zh.json`
- 修改：`packages/jacc/src/i18n/locales/en.json`

- [ ] **步骤 1：更新 i18n**

在两个语言文件中添加新的 key（Provider、APIKey 相关）并移除不再需要的旧 key。

**zh.json 新增：**
```json
"providers.dialog.addTitle": "添加服务商",
"providers.dialog.editTitle": "编辑服务商",
"providers.dialog.name": "名称",
"providers.dialog.namePlaceholder": "如：Anthropic 官方",
"providers.dialog.baseUrl": "API 端点 (Base URL)",
"providers.dialog.baseUrlPlaceholder": "https://api.anthropic.com",
"providers.dialog.notes": "备注",
"providers.dialog.notesPlaceholder": "账号类型、到期时间等",
"apiKeys.dialog.addTitle": "添加 API Key",
"apiKeys.dialog.editTitle": "编辑 API Key",
"apiKeys.dialog.name": "名称",
"apiKeys.dialog.namePlaceholder": "如：主 Key",
"apiKeys.dialog.notes": "备注",
"apiKeys.dialog.notesPlaceholder": "用途、额度等"
```

**zh.json 移除：**
```json
"models.dialog.alias": ...,
"models.dialog.aliasPlaceholder": ...,
"models.dialog.baseUrl": ...,
"models.dialog.baseUrlPlaceholder": ...,
"models.dialog.apiKey": ...,
"models.dialog.apiKeyEdit": ...,
"models.dialog.apiKeyPlaceholder": ...,
"models.dialog.apiKeyEditPlaceholder": ...
```

**en.json 新增/移除：** 同上结构的英文版本。

- [ ] **步骤 2：完整编译 + 测试验证**

运行：
```bash
cd packages/jacc && npx tsc --noEmit
cd packages/jacc && npx vitest run
```
预期：TypeScript 无错误，所有 hook 测试通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src/i18n/ packages/jacc/src/pages/ packages/jacc/src/components/ packages/jacc/src/hooks/
git commit -m "feat(jacc): 更新 i18n，清理旧接口引用"
```
