# Slot 绑定 UI 优化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 用扁平搜索下拉替代 TreeSelect，去除「当前模型」独立区块，将应用操作内联到每个 slot 行中

**架构：** 新建 `useAllModels` hook 扁平化获取所有模型，新建 `ModelSelect` 组件替代 `TreeSelect`，重写 `General.tsx` 槽位区域为行内布局（每行：名称+badge+下拉+context+hover应用按钮+model字符串）

**技术栈：** React 18 + TypeScript + Tauri 2 invoke + Vitest + @testing-library/react

---

### 任务 1：i18n 新增 key

**文件：**
- 修改：`packages/jacc/src/i18n/locales/zh.json`
- 修改：`packages/jacc/src/i18n/locales/en.json`

- [ ] **步骤 1：在 zh.json 末尾（`confirm.deleteModel.message` 之前或任何位置）新增 2 个 key**

在 `zh.json` 中找到 `"general.ctxDefault": "默认",` 这一行附近，在其后添加：

```json
"general.slot.searchPlaceholder": "搜索模型名 / 服务商...",
"general.slot.selectModel": "选择模型...",
```

在 `en.json` 对应位置添加：

```json
"general.slot.searchPlaceholder": "Search model / provider...",
"general.slot.selectModel": "Select model...",
```

- [ ] **步骤 2：验证 JSON 合法**

运行：`cd packages/jacc && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh.json','utf8'));JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8'));console.log('OK')"`

预期：输出 `OK`

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src/i18n/locales/zh.json packages/jacc/src/i18n/locales/en.json
git commit -m "feat(jacc): add i18n keys for ModelSelect component"
```

---

### 任务 2：useAllModels hook（TDD）

**文件：**
- 创建：`packages/jacc/src/hooks/useAllModels.ts`
- 创建：`packages/jacc/src/hooks/useAllModels.test.ts`

此 hook 一次性获取所有 Provider → API Key → Model，扁平化为一个列表供 ModelSelect 使用。

- [ ] **步骤 1：编写失败测试**

创建 `packages/jacc/src/hooks/useAllModels.test.ts`：

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock toast
const mockToast = { success: vi.fn(), error: vi.fn() }
vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => mockToast,
}))

import { invoke } from '@tauri-apps/api/core'
import { useAllModels } from './useAllModels'

describe('useAllModels', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('fetches providers → keys → models and flattens', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([
        { id: 1, name: 'Anthropic', base_url: 'https://api.anthropic.com', notes: null, created_at: '', updated_at: '' },
        { id: 2, name: 'OpenRouter', base_url: 'https://openrouter.ai', notes: null, created_at: '', updated_at: '' },
      ])
      .mockResolvedValueOnce([
        { id: 10, provider_id: 1, name: 'Main Key', api_key_masked: 'sk-***', notes: null, created_at: '', updated_at: '' },
      ])
      .mockResolvedValueOnce([
        { id: 100, api_key_id: 10, model_name: 'claude-opus-4-6', context_size: '200k', created_at: '', updated_at: '' },
        { id: 101, api_key_id: 10, model_name: 'claude-sonnet-4-6', context_size: null, created_at: '', updated_at: '' },
      ])
      .mockResolvedValueOnce([
        { id: 20, provider_id: 2, name: 'router', api_key_masked: 'sk-or-***', notes: null, created_at: '', updated_at: '' },
      ])
      .mockResolvedValueOnce([
        { id: 200, api_key_id: 20, model_name: 'gpt-4o', context_size: null, created_at: '', updated_at: '' },
      ])

    const { result } = renderHook(() => useAllModels())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.models).toEqual([
      { modelId: 100, modelName: 'claude-opus-4-6', providerName: 'Anthropic', keyName: 'Main Key' },
      { modelId: 101, modelName: 'claude-sonnet-4-6', providerName: 'Anthropic', keyName: 'Main Key' },
      { modelId: 200, modelName: 'gpt-4o', providerName: 'OpenRouter', keyName: 'router' },
    ])
  })

  test('returns empty array when no providers', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([])

    const { result } = renderHook(() => useAllModels())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.models).toEqual([])
  })

  test('refresh re-fetches all data', async () => {
    vi.mocked(invoke)
      // initial: empty
      .mockResolvedValueOnce([])
      // refresh: one provider
      .mockResolvedValueOnce([{ id: 1, name: 'P', base_url: '', notes: null, created_at: '', updated_at: '' }])
      .mockResolvedValueOnce([{ id: 10, provider_id: 1, name: 'K', api_key_masked: '', notes: null, created_at: '', updated_at: '' }])
      .mockResolvedValueOnce([{ id: 100, api_key_id: 10, model_name: 'm1', context_size: null, created_at: '', updated_at: '' }])

    const { result } = renderHook(() => useAllModels())
    await waitFor(() => expect(result.current.models).toEqual([]))

    const { act } = await import('@testing-library/react')
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.models).toEqual([
      { modelId: 100, modelName: 'm1', providerName: 'P', keyName: 'K' },
    ])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc && npx vitest run src/hooks/useAllModels.test.ts`

预期：FAIL — `Cannot find module './useAllModels'`

- [ ] **步骤 3：实现 useAllModels hook**

创建 `packages/jacc/src/hooks/useAllModels.ts`：

```ts
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'

export interface FlatModel {
  modelId: number
  modelName: string
  providerName: string
  keyName: string
}

interface ProviderRow {
  id: number
  name: string
}

interface ApiKeyRow {
  id: number
  provider_id: number
  name: string
}

interface ModelRow {
  id: number
  api_key_id: number
  model_name: string
}

export function useAllModels() {
  const [models, setModels] = useState<FlatModel[]>([])
  const [loading, setLoading] = useState(false)
  const { error: toastError } = useToast()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const providers = await invoke<ProviderRow[]>('list_providers')
      const flat: FlatModel[] = []

      for (const provider of providers) {
        const keys = await invoke<ApiKeyRow[]>('list_api_keys', { providerId: provider.id })
        for (const key of keys) {
          const models = await invoke<ModelRow[]>('list_models', { apiKeyId: key.id })
          for (const model of models) {
            flat.push({
              modelId: model.id,
              modelName: model.model_name,
              providerName: provider.name,
              keyName: key.name,
            })
          }
        }
      }

      setModels(flat)
    } catch (e) {
      toastError(String(e))
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { refresh() }, [refresh])

  return { models, loading, refresh }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jacc && npx vitest run src/hooks/useAllModels.test.ts`

预期：3 tests PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/hooks/useAllModels.ts packages/jacc/src/hooks/useAllModels.test.ts
git commit -m "feat(jacc): add useAllModels hook for flat model list"
```

---

### 任务 3：ModelSelect 组件（TDD）

**文件：**
- 创建：`packages/jacc/src/components/ModelSelect.tsx`
- 创建：`packages/jacc/src/components/ModelSelect.test.tsx`

- [ ] **步骤 1：编写失败测试**

创建 `packages/jacc/src/components/ModelSelect.test.tsx`：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

// Mock useAllModels
const mockModels = [
  { modelId: 1, modelName: 'claude-opus-4-6', providerName: 'Anthropic', keyName: 'Main Key' },
  { modelId: 2, modelName: 'claude-sonnet-4-6', providerName: 'Anthropic', keyName: 'Main Key' },
  { modelId: 3, modelName: 'gpt-4o', providerName: 'OpenRouter', keyName: 'router' },
]
const mockRefresh = vi.fn()

vi.mock('@/hooks/useAllModels', () => ({
  useAllModels: () => ({ models: mockModels, loading: false, refresh: mockRefresh }),
}))

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => {
    const map: Record<string, string> = {
      'general.slot.selectModel': '选择模型...',
      'general.slot.searchPlaceholder': '搜索模型名 / 服务商...',
    }
    return map[key] || key
  }}),
}))

import { ModelSelect } from './ModelSelect'

describe('ModelSelect', () => {
  test('renders placeholder when no value', () => {
    render(<ModelSelect value={null} onChange={vi.fn()} />)
    expect(screen.getByText('选择模型...')).toBeTruthy()
  })

  test('renders selected model name when value provided', () => {
    render(<ModelSelect value={1} onChange={vi.fn()} />)
    expect(screen.getByText('claude-opus-4-6')).toBeTruthy()
  })

  test('opens dropdown on click and shows all models', () => {
    render(<ModelSelect value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('选择模型...'))
    expect(screen.getByPlaceholderText('搜索模型名 / 服务商...')).toBeTruthy()
    expect(screen.getByText('claude-opus-4-6')).toBeTruthy()
    expect(screen.getByText('gpt-4o')).toBeTruthy()
  })

  test('filters models by search input', () => {
    render(<ModelSelect value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('选择模型...'))
    const input = screen.getByPlaceholderText('搜索模型名 / 服务商...')
    fireEvent.change(input, { target: { value: 'gpt' } })
    expect(screen.getByText('gpt-4o')).toBeTruthy()
    // claude models should be filtered out (only visible item is gpt)
    const items = screen.getAllByRole('option')
    expect(items).toHaveLength(1)
  })

  test('calls onChange and closes dropdown when model clicked', () => {
    const onChange = vi.fn()
    render(<ModelSelect value={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('选择模型...'))
    // find and click gpt-4o in the dropdown
    fireEvent.click(screen.getByRole('option', { name: /gpt-4o/ }))
    expect(onChange).toHaveBeenCalledWith(3)
    // dropdown should close — search input gone
    expect(screen.queryByPlaceholderText('搜索模型名 / 服务商...')).toBeNull()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc && npx vitest run src/components/ModelSelect.test.tsx`

预期：FAIL — `Cannot find module './ModelSelect'`

- [ ] **步骤 3：实现 ModelSelect 组件**

创建 `packages/jacc/src/components/ModelSelect.tsx`：

```tsx
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAllModels, type FlatModel } from '@/hooks/useAllModels'
import { useT } from '@/i18n'

interface ModelSelectProps {
  value: number | null
  onChange: (modelId: number) => void
}

export function ModelSelect({ value, onChange }: ModelSelectProps) {
  const { t } = useT()
  const { models } = useAllModels()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = models.find((m) => m.modelId === value)

  const filtered = search
    ? models.filter((m) => {
        const q = search.toLowerCase()
        return (
          m.modelName.toLowerCase().includes(q) ||
          m.providerName.toLowerCase().includes(q) ||
          m.keyName.toLowerCase().includes(q)
        )
      })
    : models

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setSearch('')
      setHighlightedIndex(-1)
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  function handleSelect(model: FlatModel) {
    onChange(model.modelId)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(filtered[highlightedIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref} onKeyDown={handleKeyDown}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 border border-border rounded-[2px] text-xs bg-sidebar text-foreground hover:bg-sidebar/80"
      >
        <span className={selected ? '' : 'text-muted'}>
          {selected?.modelName || t('general.slot.selectModel')}
        </span>
        <ChevronDown size={12} className="text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-20 min-w-[280px]">
          <div className="p-1.5 border-b border-border">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(-1) }}
              placeholder={t('general.slot.searchPlaceholder')}
              className="w-full px-2 py-1 text-xs bg-sidebar border border-border rounded-[2px] text-foreground placeholder:text-muted outline-none"
            />
          </div>
          <div ref={listRef} className="max-h-[200px] overflow-y-auto">
            {filtered.map((m, i) => (
              <div
                key={m.modelId}
                role="option"
                aria-label={m.modelName}
                className={`flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer ${
                  highlightedIndex === i ? 'bg-sidebar' : ''
                } ${m.modelId === value ? 'text-primary font-medium' : 'text-foreground'}`}
                onClick={() => handleSelect(m)}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <span>{m.modelName}</span>
                <span className="text-[10px] text-muted shrink-0 ml-2">
                  {m.providerName} · {m.keyName}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-xs text-muted text-center">无匹配结果</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jacc && npx vitest run src/components/ModelSelect.test.tsx`

预期：5 tests PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/components/ModelSelect.tsx packages/jacc/src/components/ModelSelect.test.tsx
git commit -m "feat(jacc): add ModelSelect component with flat searchable dropdown"
```

---

### 任务 4：重写 General.tsx 槽位区域

**文件：**
- 修改：`packages/jacc/src/pages/General.tsx`

此任务重写槽位区域：去掉「当前模型」独立区块，每个 slot 一行，hover 显示应用按钮，当前 slot 蓝色边框 + badge + model 字符串。同时修复 context 回显：`handleApplyCurrentModel` 完成后调用 `config.refresh()`。

- [ ] **步骤 1：重写 General.tsx**

将整个文件替换为以下内容（保留 effortLevel、skipDangerous、language 设置区域不变）：

```tsx
import { useEffect, useState } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { useSlotBindings } from '@/hooks/useSlotBindings'
import { usePreferences } from '@/hooks/usePreferences'
import { SourceBadge } from '@/components/SourceBadge'
import { ModelSelect } from '@/components/ModelSelect'
import { useT, type Locale } from '@/i18n'

type Slot = 'opus' | 'sonnet' | 'haiku'

const SLOTS: Slot[] = ['opus', 'sonnet', 'haiku']

const SLOT_LABELS: Record<Slot, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' }

const CONTEXT_OPTIONS = ['', '1m']

export function General() {
  const { t, locale, setLocale } = useT()
  const { config, loading, refresh: refreshConfig, writeConfig } = useConfig()
  const { bindings, bind, setCurrentModel } = useSlotBindings()
  const { set: setPreference } = usePreferences()

  // 当前激活的 slot 和每个 slot 的 context size
  const [currentSlot, setCurrentSlot] = useState<Slot>('opus')
  const [slotContexts, setSlotContexts] = useState<Record<Slot, string>>({
    opus: '',
    sonnet: '',
    haiku: '',
  })

  // 从 config 的 model 字段回显当前模型设置
  useEffect(() => {
    if (!config) return
    const modelItem = config.items.find(i => i.key === 'model')
    if (modelItem?.value) {
      const val = String(modelItem.value)
      const match = val.match(/^(\w+)(?:\[(.+)\])?$/)
      if (match) {
        const slot = match[1] as Slot
        const ctx = match[2] || ''
        setCurrentSlot(slot)
        setSlotContexts(prev => ({ ...prev, [slot]: ctx }))
      }
    }
  }, [config])

  if (loading || !config) {
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>
  }

  const getItem = (key: string) => config.items.find((i) => i.key === key)
  const effortLevel = getItem('effortLevel')
  const skipDangerous = getItem('skipDangerousModePermissionPrompt')

  function getBinding(slot: Slot) {
    return bindings.find((b) => b.slot === slot)
  }

  async function handleSlotModelChange(slot: Slot, modelId: number) {
    try {
      await bind(slot, modelId)
    } catch {
      // error handled by toast in hook
    }
  }

  async function handleApply(slot: Slot) {
    try {
      await setCurrentModel(slot, slotContexts[slot] || null)
      await refreshConfig()
    } catch {
      // error handled by toast in hook
    }
  }

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale)
    setPreference('locale', newLocale)
  }

  function getModelString() {
    const ctx = slotContexts[currentSlot]
    return `→ model = "${currentSlot}${ctx ? `[${ctx}]` : ''}"`
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-5">{t('general.title')}</h2>

      <div className="flex flex-col gap-2.5">
        {/* 模型槽位 */}
        <div className="p-3 bg-card border border-border-light rounded-[4px]">
          <div className="text-[13px] font-medium text-foreground mb-2.5">{t('general.slots')}</div>
          <div className="flex flex-col gap-2">
            {SLOTS.map((slot) => {
              const binding = getBinding(slot)
              const isCurrent = slot === currentSlot
              const isBound = !!binding
              return (
                <div
                  key={slot}
                  className={`group flex items-center gap-2.5 px-3 py-2 rounded-[4px] transition-colors ${
                    isCurrent
                      ? 'border-2 border-primary bg-primary/5'
                      : 'border border-border-light bg-card hover:bg-sidebar/30'
                  }`}
                >
                  {/* Slot name + badge */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[12px] font-medium text-foreground">{SLOT_LABELS[slot]}</span>
                    {isCurrent && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-[2px] bg-primary text-white leading-none">
                        {t('general.slot.bound').charAt(0)}{/* "已" for zh or first char */}
                      </span>
                    )}
                  </div>

                  {/* Model select */}
                  <ModelSelect
                    value={binding?.model_id ?? null}
                    onChange={(modelId) => handleSlotModelChange(slot, modelId)}
                  />

                  {/* Context size */}
                  <select
                    value={slotContexts[slot]}
                    onChange={(e) => setSlotContexts(prev => ({ ...prev, [slot]: e.target.value }))}
                    disabled={!isBound}
                    className={`text-[11px] px-1.5 py-1 rounded-[2px] border border-border bg-sidebar text-foreground w-[55px] ${
                      !isBound ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="">{t('general.ctxDefault')}</option>
                    {CONTEXT_OPTIONS.filter(c => c).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {/* Apply button — hover only */}
                  {isBound && (
                    <button
                      onClick={() => handleApply(slot)}
                      className="text-[11px] px-2.5 py-1 rounded-[2px] bg-primary text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      {t('general.apply')}
                    </button>
                  )}

                  {/* Model string — current slot only */}
                  {isCurrent && (
                    <span className="text-[10px] font-mono text-muted shrink-0">
                      {getModelString()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Effort Level */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.effortLevel')}</div>
            <div className="text-[11px] text-muted">{t('general.effortLevel.desc')}</div>
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
              <option value="max">max</option>
              <option value="auto">auto</option>
            </select>
            {effortLevel && <SourceBadge scope={effortLevel.scope} />}
          </div>
        </div>

        {/* 跳过危险模式确认 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.skipDangerous')}</div>
            <div className="text-[11px] text-muted">{t('general.skipDangerous.desc')}</div>
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

        {/* 语言 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.language')}</div>
            <div className="text-[11px] text-muted">{t('general.language.desc')}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value as Locale)}
              className="bg-sidebar border border-border text-foreground px-2.5 py-1 rounded-[2px] text-xs"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：TypeScript 编译检查**

运行：`cd packages/jacc && npx tsc --noEmit`

预期：无错误

- [ ] **步骤 3：运行所有前端测试**

运行：`cd packages/jacc && npx vitest run`

预期：所有测试通过

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src/pages/General.tsx
git commit -m "feat(jacc): rewrite slot binding UI with inline apply and context echo fix"
```

---

### 任务 5：删除 TreeSelect + 清理

**文件：**
- 删除：`packages/jacc/src/components/TreeSelect.tsx`

- [ ] **步骤 1：确认 TreeSelect 无其他引用**

运行：`cd packages/jacc && grep -r "TreeSelect" src/ --include="*.ts" --include="*.tsx" -l`

预期：只有 `TreeSelect.tsx` 本身。如果还有其他文件引用，先移除 import。

- [ ] **步骤 2：删除 TreeSelect.tsx**

运行：`rm packages/jacc/src/components/TreeSelect.tsx`

- [ ] **步骤 3：TypeScript 编译检查**

运行：`cd packages/jacc && npx tsc --noEmit`

预期：无错误

- [ ] **步骤 4：运行所有前端测试**

运行：`cd packages/jacc && npx vitest run`

预期：所有测试通过

- [ ] **步骤 5：Commit**

```bash
git add -A packages/jacc/src/components/TreeSelect.tsx
git commit -m "chore(jacc): remove TreeSelect component (replaced by ModelSelect)"
```

---

### 任务 6：最终验证

- [ ] **步骤 1：运行完整测试套件**

运行：`cd packages/jacc && NODE_OPTIONS="--max-old-space-size=8192" npx vitest run`

预期：所有测试通过

- [ ] **步骤 2：TypeScript 严格检查**

运行：`cd packages/jacc && npx tsc --noEmit`

预期：无错误

- [ ] **步骤 3：Final commit（如有未提交变更）**

检查 `git status`，如有未提交的变更则提交。否则无需操作。
