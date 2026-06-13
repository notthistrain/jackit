# jacc 前端重构设计

## 概述

对 jacc 前端进行全面重构，完全对齐 jackcom 的架构模式，应用 React 19 最佳实践，优化业务逻辑。

**目标：**
- 完全对齐 jackcom 的 `tailwind-variants` 架构
- 重新设计组件层次（features/ 模块化）
- 优化业务逻辑（API 层 + Hook 层分离）
- 严格遵循 React 19 最佳实践（适用于 Tauri 桌面应用的部分）
- 同步更新测试覆盖（组件代码行覆盖率 > 80%）

**策略：** 自底向上重构，分 5 个批次完成

**工作量：** 5.5 天

---

## 第一部分：架构设计

### 1.1 目录结构重组

**当前结构（jacc）：**
```
src/
├── components/          # 扁平化，混杂各种组件
├── pages/              # 页面组件
├── hooks/              # 所有 hooks
├── stores/             # Zustand stores
└── lib/                # 工具函数
```

**目标结构（对齐 jackcom + React 19 最佳实践）：**
```
src/
├── features/                    # 功能模块（新增）
│   ├── models/                  # 模型管理功能
│   │   ├── components/
│   │   │   ├── ModelNode.tsx
│   │   │   ├── model-node.variants.ts
│   │   │   ├── ApiKeyNode.tsx
│   │   │   ├── api-key-node.variants.ts
│   │   │   ├── ProviderNode.tsx
│   │   │   └── provider-node.variants.ts
│   │   ├── hooks/
│   │   │   ├── useModels.ts
│   │   │   ├── useApiKeys.ts
│   │   │   └── useProviders.ts
│   │   ├── api/                 # API 调用层（新增）
│   │   │   └── models-api.ts
│   │   └── index.ts             # 公开导出
│   ├── skills/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── index.ts
│   ├── agents/
│   ├── mcp-servers/
│   ├── permissions/
│   └── env-vars/
├── shared/                      # 跨功能共享（重命名自 components）
│   ├── components/
│   │   ├── ui/                  # 原子组件
│   │   │   ├── Button.tsx
│   │   │   ├── button.variants.ts
│   │   │   ├── Input.tsx
│   │   │   ├── input.variants.ts
│   │   │   ├── Dialog.tsx
│   │   │   ├── dialog.variants.ts
│   │   │   ├── CollapsibleCard.tsx
│   │   │   └── collapsible-card.variants.ts
│   │   └── layout/              # 布局组件
│   │       ├── Layout.tsx
│   │       ├── layout.variants.ts
│   │       ├── Sidebar.tsx
│   │       ├── sidebar.variants.ts
│   │       ├── TitleBar.tsx
│   │       └── title-bar.variants.ts
│   └── hooks/                   # 通用 hooks
│       ├── useDebounce.ts
│       └── useKeyboardShortcut.ts
├── stores/                      # 全局状态（保留）
│   └── useAppStore.ts
├── providers/                   # Context providers（新增）
│   ├── ToastProvider.tsx
│   └── toast-provider.variants.ts
├── pages/                       # 页面入口（简化为路由组件）
│   ├── Models.tsx
│   ├── Skills.tsx
│   └── ...
└── lib/                         # 工具函数（保留）
```

**关键变化：**
- ✅ 按功能模块组织（`features/`），而非按技术类型
- ✅ 每个功能模块内部完整（组件 + hooks + API）
- ✅ 共享代码明确分离（`shared/`）
- ✅ 页面组件简化为路由入口，业务逻辑下沉到 features

---

### 1.2 依赖调整

**移除：**
```json
"class-variance-authority": "catalog:"
```

**新增：**
```json
"tailwind-variants": "catalog:"
```

**保持不变：**
- `zustand` - 用于全局 UI 状态
- `react`、`react-dom` - 核心库
- `lucide-react` - 图标库
- `tailwind-merge`、`clsx` - 样式工具

---

### 1.3 变体系统设计

**基础变体模式（完全对齐 jackcom）：**

```typescript
// 示例：button.variants.ts
import { tv } from 'tailwind-variants'

export const button = tv({
  slots: {
    root: 'inline-flex items-center justify-center rounded-[4px] text-xs font-medium transition-colors',
    icon: 'shrink-0',
  },
  variants: {
    variant: {
      primary: {
        root: 'bg-primary text-white hover:bg-primary/90',
      },
      ghost: {
        root: 'text-muted hover:bg-sidebar hover:text-foreground',
      },
      danger: {
        root: 'text-muted hover:bg-danger/10 hover:text-danger',
      },
    },
    size: {
      sm: {
        root: 'px-2 py-1',
        icon: 'w-3 h-3',
      },
      md: {
        root: 'px-3 py-2',
        icon: 'w-4 h-4',
      },
    },
    disabled: {
      true: {
        root: 'opacity-50 cursor-not-allowed',
      },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})
```

**组件使用模式：**

```tsx
// Button.tsx
import { button } from './button.variants'

interface ButtonProps {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

export function Button({ variant, size, disabled, children, onClick }: ButtonProps) {
  const { root, icon } = button({ variant, size, disabled })

  return (
    <button className={root()} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
```

---

## 第二部分：业务逻辑优化

### 2.1 状态管理重构

**当前问题：**
- hooks 直接调用 Tauri commands，没有 API 抽象层
- 错误处理分散在各个组件中
- 没有统一的加载状态管理

**优化方案：**

```typescript
// features/models/api/models-api.ts
import { invoke } from '@tauri-apps/api/core'

export interface Model {
  id: number
  api_key_id: number
  model_name: string
  context_size: string | null
}

export interface CreateModelInput {
  api_key_id: number
  model_name: string
  context_size: string | null
}

// API 层：纯函数，只负责调用 Tauri commands
// 错误直接抛出，由 Hook 层处理
export const modelsApi = {
  list: (apiKeyId: number) =>
    invoke<Model[]>('get_models', { apiKeyId }),

  create: (input: CreateModelInput) =>
    invoke<Model>('add_model', input),

  update: (id: number, input: Partial<CreateModelInput>) =>
    invoke<Model>('update_model', { id, ...input }),

  delete: (id: number) =>
    invoke<void>('delete_model', { id }),

  test: (id: number) =>
    invoke<string>('test_model', { id }),
}
```

```typescript
// features/models/hooks/useModels.ts
import { useCallback, useEffect, useState } from 'react'
import { modelsApi } from '../api/models-api'
import type { CreateModelInput, Model } from '../api/models-api'

// Hook 层：管理状态和副作用
export function useModels(apiKeyId: number) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载列表
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await modelsApi.list(apiKeyId)
      setModels(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [apiKeyId])

  useEffect(() => {
    load()
  }, [load])

  // 添加
  const add = useCallback(async (input: CreateModelInput) => {
    const newModel = await modelsApi.create(input)
    setModels(prev => [...prev, newModel])
  }, [])

  // 更新
  const update = useCallback(async (id: number, input: Partial<CreateModelInput>) => {
    const updated = await modelsApi.update(id, input)
    setModels(prev => prev.map(m => m.id === id ? updated : m))
  }, [])

  // 删除
  const remove = useCallback(async (id: number) => {
    await modelsApi.delete(id)
    setModels(prev => prev.filter(m => m.id !== id))
  }, [])

  // 测试
  const test = useCallback((id: number) => modelsApi.test(id), [])

  return { models, loading, error, add, update, remove, test, reload: load }
}
```

**错误处理策略：**
- API 层：直接抛出错误（让 Hook 层处理）
- Hook 层：捕获错误并存储到状态
- 组件层：从 Hook 获取 error 状态并内联展示（不使用全局 Toast）

**关键改进：**
- ✅ API 层和 Hook 层分离
- ✅ 统一的错误处理
- ✅ 统一的加载状态
- ✅ 乐观更新（立即更新 UI，无需重新加载）

---

### 2.2 组件拆分策略

**当前问题：**
- `Models.tsx` 有 413 行，包含 3 个嵌套组件（ProviderNode、ApiKeyNode、ModelNode）
- 组件职责不清晰，难以测试和复用

**优化方案：**

**拆分前（Models.tsx - 413 行）：**
```tsx
// 所有组件都在一个文件中
function ModelNode() { /* 50 行 */ }
function ApiKeyNode() { /* 100 行 */ }
function ProviderNode() { /* 100 行 */ }
export function Models() { /* 150 行 */ }
```

**拆分后（按功能模块组织）：**
```
features/models/
├── components/
│   ├── ModelNode.tsx              # 60 行（独立组件）
│   ├── model-node.variants.ts     # 20 行
│   ├── ApiKeyNode.tsx              # 80 行
│   ├── api-key-node.variants.ts    # 25 行
│   ├── ProviderNode.tsx            # 90 行
│   ├── provider-node.variants.ts   # 30 行
│   └── ModelsList.tsx              # 主列表组件，40 行
├── hooks/
│   ├── useModels.ts
│   ├── useApiKeys.ts
│   └── useProviders.ts
└── api/
    └── models-api.ts
```

**组件职责划分：**

```tsx
// ModelNode.tsx - 叶子节点，只负责展示单个模型
export function ModelNode({ model, onTest, onEdit, onRemove }: ModelNodeProps) {
  const { t } = useT()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { root, content, actions, button } = modelNode()

  return (
    <div className={root()}>
      <div className={content()}>
        <span>{model.model_name}</span>
        {model.context_size && <span>({model.context_size})</span>}
      </div>
      <div className={actions()}>
        <button onClick={() => onTest(model.id)} className={button({ variant: 'primary' })}>
          {t('models.test')}
        </button>
        <button onClick={() => onEdit(model)} className={button({ variant: 'ghost' })}>
          {t('models.edit')}
        </button>
        <button onClick={() => setConfirmDelete(true)} className={button({ variant: 'danger' })}>
          {t('models.delete')}
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onConfirm={() => onRemove(model.id)}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
```

```tsx
// ApiKeyNode.tsx - 中间层，管理模型列表
export function ApiKeyNode({ apiKey, onRemove, onUpdate }: ApiKeyNodeProps) {
  const { models, add, update, remove, test } = useModels(apiKey.id)
  const [expanded, setExpanded] = useState(false)
  const { root, header, list } = apiKeyNode({ expanded })

  return (
    <div className={root()}>
      <div className={header()} onClick={() => setExpanded(v => !v)}>
        {/* API Key 信息 */}
      </div>
      {expanded && (
        <div className={list()}>
          {models.map(model => (
            <ModelNode
              key={model.id}
              model={model}
              onTest={test}
              onEdit={/* ... */}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**通用组件抽离：**

Models 的三层嵌套是业务特有的，不抽离为公共组件。但可以抽离真正通用的原子组件：

```
shared/components/ui/
├── CollapsibleCard.tsx          # 可折叠卡片（通用）
├── collapsible-card.variants.ts
├── ActionButton.tsx              # 操作按钮（通用）
└── action-button.variants.ts
```

这样：
- Models 的 `ProviderNode`、`ApiKeyNode`、`ModelNode` 使用 `CollapsibleCard`
- McpServers 的服务器项也使用 `CollapsibleCard`
- 按钮统一使用 `ActionButton`

**关键改进：**
- ✅ 每个组件 < 100 行，职责单一
- ✅ 组件可独立测试
- ✅ 样式和逻辑分离
- ✅ 符合 React 19 最佳实践（命名导出、Props 接口导出）

---

### 2.3 React 19 最佳实践应用

**适用于 Tauri 桌面应用的部分：**

#### 1. 命名导出 + Props 接口导出

```tsx
// ❌ 当前（部分组件使用默认导出）
export default function App() { ... }

// ✅ 优化后（所有组件使用命名导出）
export interface AppProps {
  // ...
}

export function App(props: AppProps) { ... }
```

#### 2. 组件结构标准化

```tsx
// ✅ 标准组件结构
export function UserCard({ user, onEdit }: UserCardProps) {
  // 1. Hooks 在最前面
  const { t } = useT()
  const [isOpen, setIsOpen] = useState(false)

  // 2. 派生状态（不使用 useEffect）
  const fullName = `${user.firstName} ${user.lastName}`

  // 3. 事件处理器
  const handleEdit = useCallback(() => onEdit(user.id), [onEdit, user.id])

  // 4. 提前返回
  if (!user) return null

  // 5. JSX（< 50 行）
  const { root, content } = userCard()
  return (
    <div className={root()}>
      <div className={content()}>{fullName}</div>
      <button onClick={handleEdit}>{t('edit')}</button>
    </div>
  )
}
```

#### 3. 状态管理分层

```tsx
// ✅ 服务器状态 → 自定义 hooks + useState（保持简单）
// 未来可选：TanStack Query

// ✅ 全局 UI 状态 → Zustand
export const useAppStore = create<AppState>()((set) => ({
  currentPage: 'general',
  setPage: (page) => set({ currentPage: page }),
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}))

// ✅ 局部 UI 状态 → useState
function Dialog() {
  const [open, setOpen] = useState(false)
  // ...
}
```

#### 4. 避免常见陷阱

```tsx
// ❌ 渲染陷阱
{count && <Component />}  // count=0 时渲染 "0"

// ✅ 显式布尔值
{count > 0 && <Component />}

// ❌ 状态突变
array.push(item)
setArray(array)

// ✅ 不可变更新
setArray([...array, item])

// ❌ 不稳定的 key
<Item key={Math.random()} />

// ✅ 稳定的 key
<Item key={item.id} />
```

**不适用的 React 19 特性（SSR 场景）：**
- ❌ Server Components（Tauri 是客户端应用）
- ❌ `use()` hook（用于 Suspense + Promise，当前不需要）
- ❌ `useActionState`（用于 Server Actions，当前不需要）

---

## 第三部分：实施计划

### 3.1 五个批次的详细任务

#### **批次 1：基础设施层**（0.5 天）

**任务：**
1. 安装 `tailwind-variants`，移除 `class-variance-authority`
2. 创建基础变体工具函数
3. 创建通用原子组件（基于 Models 和 McpServers 的折叠卡片需求，设计通用的 CollapsibleCard 组件）

**产出：**
```
shared/components/ui/
├── Button.tsx
├── button.variants.ts
├── Input.tsx
├── input.variants.ts
├── Dialog.tsx
├── dialog.variants.ts
├── CollapsibleCard.tsx
├── collapsible-card.variants.ts
├── ActionButton.tsx
└── action-button.variants.ts
```

**测试：**
- Button 组件的各种变体（primary、ghost、danger）
- CollapsibleCard 的展开/折叠状态

---

#### **批次 2：原子组件层**（1 天）

**任务：**
1. 重构布局组件（TitleBar、Sidebar）
2. 重构小组件（Fab、EmptyState、SourceBadge、ProjectSwitcher）
3. 重构对话框基础组件（ConfirmDialog）

**产出：**
```
shared/components/layout/
├── Layout.tsx
├── layout.variants.ts
├── Sidebar.tsx
├── sidebar.variants.ts
├── TitleBar.tsx
└── title-bar.variants.ts

shared/components/ui/
├── Fab.tsx
├── fab.variants.ts
├── EmptyState.tsx
├── empty-state.variants.ts
├── SourceBadge.tsx
├── source-badge.variants.ts
├── ConfirmDialog.tsx
└── confirm-dialog.variants.ts
```

**测试：**
- Sidebar 导航切换
- TitleBar 窗口控制
- ConfirmDialog 确认/取消流程

---

#### **批次 3：复合组件层**（1.5 天）

**任务：**
1. 重构对话框组件（AddProviderDialog、AddApiKeyDialog、AddModelDialog、InstallSkillDialog）
2. 重构列表组件（SkillList、ModelSelect、ProjectSwitcher）
3. 创建 API 抽象层

**产出：**
```
features/models/
├── api/
│   └── models-api.ts
├── components/
│   ├── AddProviderDialog.tsx
│   ├── add-provider-dialog.variants.ts
│   ├── AddApiKeyDialog.tsx
│   ├── add-api-key-dialog.variants.ts
│   ├── AddModelDialog.tsx
│   └── add-model-dialog.variants.ts

features/skills/
├── api/
│   └── skills-api.ts
├── components/
│   ├── SkillList.tsx
│   ├── skill-list.variants.ts
│   ├── InstallSkillDialog.tsx
│   └── install-skill-dialog.variants.ts
```

**测试：**
- 对话框表单验证
- 对话框提交流程
- SkillList 的启用/禁用切换

---

#### **批次 4：页面组件层**（2 天）

**任务：**
1. 重构 Models 页面（三层嵌套组件）
2. 重构 Skills、Agents 页面
3. 重构 McpServers、Permissions、EnvVars、General 页面
4. 优化业务逻辑（API 层 + Hook 层分离）

**产出：**
```
features/models/
├── components/
│   ├── ModelNode.tsx
│   ├── model-node.variants.ts
│   ├── ApiKeyNode.tsx
│   ├── api-key-node.variants.ts
│   ├── ProviderNode.tsx
│   ├── provider-node.variants.ts
│   └── ModelsList.tsx
├── hooks/
│   ├── useModels.ts
│   ├── useApiKeys.ts
│   └── useProviders.ts
└── api/
    └── models-api.ts

pages/
├── Models.tsx
├── Skills.tsx
├── Agents.tsx
├── McpServers.tsx
├── Permissions.tsx
├── EnvVars.tsx
└── General.tsx
```

**测试：**
- Models 页面的三层展开/折叠
- Models 的增删改查操作
- Skills 的安装/卸载流程
- McpServers 的配置编辑

---

#### **批次 5：布局组件层 + 收尾**（0.5 天）

**任务：**
1. 重构 App.tsx 和 Layout.tsx
2. 重构 ToastProvider（移动到 providers/ 目录）
3. 统一测试覆盖
4. 文档更新

**产出：**
```
App.tsx
providers/
├── ToastProvider.tsx
└── toast-provider.variants.ts
```

**测试：**
- 端到端测试（完整用户流程）
- Toast 通知显示
- 主题切换

---

### 3.2 测试策略

**测试覆盖目标：**
- 组件代码的行覆盖率 > 80%（使用 Vitest 的 coverage 功能衡量）
- 所有变体组件的状态变化
- 所有用户交互流程
- 所有 API 调用的成功/失败场景

**测试工具：**
- Vitest + Testing Library（已有）
- 参考 jackcom 的测试模式

**示例测试：**
```tsx
// ModelNode.test.tsx
import { render, screen, userEvent } from '@testing-library/react'
import { ModelNode } from './ModelNode'

describe('ModelNode', () => {
  const mockModel = {
    id: 1,
    api_key_id: 1,
    model_name: 'gpt-4',
    context_size: '128k',
  }

  it('renders model information', () => {
    render(<ModelNode model={mockModel} onTest={vi.fn()} onEdit={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByText('gpt-4')).toBeInTheDocument()
    expect(screen.getByText('(128k)')).toBeInTheDocument()
  })

  it('calls onTest when test button clicked', async () => {
    const onTest = vi.fn()
    render(<ModelNode model={mockModel} onTest={onTest} onEdit={vi.fn()} onRemove={vi.fn()} />)
    await userEvent.click(screen.getByText('Test'))
    expect(onTest).toHaveBeenCalledWith(1)
  })

  it('shows confirm dialog before delete', async () => {
    render(<ModelNode model={mockModel} onTest={vi.fn()} onEdit={vi.fn()} onRemove={vi.fn()} />)
    await userEvent.click(screen.getByText('Delete'))
    expect(screen.getByText(/confirm/i)).toBeInTheDocument()
  })
})
```

---

### 3.3 验证标准

**每个批次完成后的验证清单：**

✅ 所有组件都有对应的 `.variants.ts` 文件
✅ 所有组件使用命名导出
✅ 所有 Props 接口已导出
✅ 组件文件 < 300 行，JSX < 50 行
✅ 测试覆盖率 > 80%
✅ 无 TypeScript 错误
✅ 无 ESLint 警告
✅ 应用正常运行，无功能回退

---

## 总结

**核心目标：**
1. ✅ 完全对齐 jackcom 的 tailwind-variants 架构
2. ✅ 重新设计组件层次（features/ 模块化）
3. ✅ 优化业务逻辑（API 层 + Hook 层分离）
4. ✅ 严格遵循 React 19 最佳实践（适用于 Tauri 桌面应用的部分）
5. ✅ 同步更新测试覆盖（组件代码行覆盖率 > 80%）

**工作量：5.5 天**

**风险控制：**
- 自底向上重构，每个批次可独立验证
- 不影响现有功能，可随时回滚
- 测试先行，保证质量

**关键改进：**
- 代码质量：组件职责单一，易于测试和维护
- 架构清晰：features/ 模块化，依赖关系明确
- 样式管理：tailwind-variants 统一管理，支持变体和主题
- 业务逻辑：API 层和 Hook 层分离，错误处理统一
- 最佳实践：遵循 React 19 规范，避免常见陷阱
