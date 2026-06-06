# 批次 4：页面组件层 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Models 三层嵌套组件从 `pages/Models.tsx` 拆分为独立的 features 组件（业务逻辑下沉到 hook），为 McpServers / Permissions / EnvVars 建立完整 features 模块（api + hooks + components），并将共享配置 hook 迁移到 `shared/hooks/`，全程零功能回退。

**架构：**
- Models：`ProviderNode` / `ApiKeyNode` / `ModelNode` 三层组件拆为独立文件，各自的交互逻辑（test/add/edit 状态、formatTestResult）提取到 `useModelNode` / `useApiKeyNode` / `useProviderNode` hook，组件做纯展示。
- 配置页：新建 `features/mcp-servers`、`features/permissions`、`features/env-vars`，每个含 `api/`（包装 read_merged_config / write_config 的 key-value 读写为领域函数）+ `hooks/`（封装该领域的派生状态与增删改）+ `components/`（拆分后的 tailwind-variants 化子组件）。
- 共享 hook：`useConfig` / `useSlotBindings` / `useProjects` / `usePreferences` 从 `src/hooks/` 迁移到 `src/shared/hooks/`，更新所有导入。ToastProvider 路径保持 `@/components/toast/ToastProvider` 不变（其迁移属批次 5）。

**技术栈：** React 19 + TypeScript、tailwind-variants、Tauri invoke、Vitest + Testing Library、i18n（扁平 key），别名 `@/` → `src/`。

---

## 文件结构

**共享 hook 迁移（任务 4.1）：**
- 移动：`src/hooks/useConfig.ts` → `src/shared/hooks/useConfig.ts`
- 移动：`src/hooks/useSlotBindings.ts` → `src/shared/hooks/useSlotBindings.ts`
- 移动：`src/hooks/useProjects.ts` → `src/shared/hooks/useProjects.ts`
- 移动：`src/hooks/usePreferences.ts` → `src/shared/hooks/usePreferences.ts`
- 移动：`src/hooks/useSlotBindings.test.ts` → `src/shared/hooks/useSlotBindings.test.ts`
- 更新：所有引用方导入路径（pages、features、ProjectSwitcher 等）

**Models 三层组件（任务 4.2 - 4.5）：**
- 创建：`features/models/hooks/useModelNode.ts` — 删除确认状态
- 创建：`features/models/hooks/useApiKeyNode.ts` — test/add/edit 状态 + formatTestResult + 展开
- 创建：`features/models/hooks/useProviderNode.ts` — add key / edit / 删除确认 + 展开
- 创建：`features/models/components/{ModelNode,ApiKeyNode,ProviderNode}.tsx` + 对应 `.variants.ts` + `.test.tsx`
- 修改：`pages/Models.tsx` — 简化为列表入口（仅 useProviders + ProviderNode 列表 + Fab + AddProviderDialog）

**McpServers 模块（任务 4.6）：**
- 创建：`features/mcp-servers/api/mcp-servers-api.ts` — 类型 + 从 MergedConfig 提取/写回 mcpServers
- 创建：`features/mcp-servers/hooks/useMcpServers.ts` — servers 派生 + save/delete/add
- 创建：`features/mcp-servers/components/{McpServerItem,AddMcpServerForm}.tsx` + variants + 测试
- 修改：`pages/McpServers.tsx` — 简化为入口

**Permissions 模块（任务 4.7）：**
- 创建：`features/permissions/api/permissions-api.ts` — 类型 + allow/deny 读写
- 创建：`features/permissions/hooks/usePermissions.ts` — allowRules/denyRules 派生 + add/remove
- 创建：`features/permissions/components/{PermissionTable,AddPermissionForm}.tsx` + variants + 测试
- 修改：`pages/Permissions.tsx` — 简化为入口

**EnvVars 模块（任务 4.8）：**
- 创建：`features/env-vars/api/env-vars-api.ts` — MODEL_ENV_KEYS + 读写 env
- 创建：`features/env-vars/hooks/useEnvVars.ts` — regular/model 分组派生 + add/delete/update
- 创建：`features/env-vars/components/{EnvVarRow,AddEnvVarForm}.tsx` + variants + 测试
- 修改：`pages/EnvVars.tsx` — 简化为入口

**说明：** Agents / Skills / General 页面不在本批次范围。Agents 是占位页；Skills 已在批次 3 完成；General 依赖批次 5 的 ToastProvider 迁移，本批次仅随任务 4.1 更新其 hook 导入路径。

---

### 任务 4.1：迁移共享配置 hook 到 shared/hooks/

**文件：**
- 移动：`src/hooks/{useConfig,useSlotBindings,useProjects,usePreferences}.ts` → `src/shared/hooks/`
- 移动：`src/hooks/useSlotBindings.test.ts` → `src/shared/hooks/useSlotBindings.test.ts`
- 修改：所有 `@/hooks/...` 引用方

- [ ] **步骤 1：用 git mv 移动 hook 文件（保留历史）**

```bash
cd packages/jacc
git mv src/hooks/useConfig.ts src/shared/hooks/useConfig.ts
git mv src/hooks/useSlotBindings.ts src/shared/hooks/useSlotBindings.ts
git mv src/hooks/useSlotBindings.test.ts src/shared/hooks/useSlotBindings.test.ts
git mv src/hooks/useProjects.ts src/shared/hooks/useProjects.ts
git mv src/hooks/usePreferences.ts src/shared/hooks/usePreferences.ts
```

预期：`src/hooks/` 目录清空（无其他文件），文件出现在 `src/shared/hooks/`

- [ ] **步骤 2：找出所有引用方**

运行：`grep -rln "@/hooks/" src/`
预期：列出所有 import 这些 hook 的文件（pages、ProjectSwitcher、features 等）。逐个把 `@/hooks/useXxx` 改为 `@/shared/hooks/useXxx`。

- [ ] **步骤 3：检查 useSlotBindings.test.ts 内部相对导入**

`useSlotBindings.test.ts` 若用相对路径 import `./useSlotBindings`，移动后仍同目录无需改；若 mock 了 `@/components/toast/ToastProvider` 则保持不变。读取该测试文件确认。

- [ ] **步骤 4：运行验证**

运行：`pnpm test -- --run && pnpm tsc --noEmit && pnpm lint`
预期：全部通过，无 `Cannot find module '@/hooks/...'` 错误

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "refactor(jacc): 迁移共享配置 hook 到 shared/hooks（任务 4.1）"
```

---

### 任务 4.2：拆分 ModelNode（叶子节点）

**文件：**
- 创建：`features/models/hooks/useModelNode.ts`
- 创建：`features/models/components/ModelNode.tsx`
- 创建：`features/models/components/model-node.variants.ts`
- 测试：`features/models/components/ModelNode.test.tsx`

实现需对照 `pages/Models.tsx:24-94` 的现有 ModelNode（行为零回退）。

- [ ] **步骤 1：编写 useModelNode 失败测试**

测试文件 `features/models/hooks/useModelNode.test.ts`：

```typescript
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useModelNode } from './useModelNode'

describe('useModelNode', () => {
  it('toggles confirmDelete', () => {
    const { result } = renderHook(() => useModelNode())
    expect(result.current.confirmDelete).toBe(false)
    act(() => result.current.setConfirmDelete(true))
    expect(result.current.confirmDelete).toBe(true)
  })
})
```

- [ ] **步骤 2：运行确认失败**

运行：`pnpm test useModelNode -- --run`
预期：FAIL（模块不存在）

- [ ] **步骤 3：实现 useModelNode**

```typescript
import { useState } from 'react'

export function useModelNode() {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return { confirmDelete, setConfirmDelete }
}
```

- [ ] **步骤 4：创建 model-node.variants.ts**

把 Models.tsx 顶部的 btnBase/btnGhost/btnDanger 行内样式迁入 slots：

```typescript
import { tv } from 'tailwind-variants'

export const modelNode = tv({
  slots: {
    root: 'flex items-center justify-between pl-24 pr-3 py-2 hover:bg-sidebar/50 rounded-[4px]',
    info: 'min-w-0 flex-1 mr-3',
    nameRow: 'flex items-center gap-2',
    name: 'text-[12px] text-foreground font-medium',
    ctx: 'text-[10px] text-muted',
    result: 'text-[10px] mt-0.5 truncate',
    actions: 'flex gap-1 shrink-0',
    btn: 'text-[11px] px-2 py-1 border border-border rounded-[2px] cursor-pointer',
    testBtn: 'text-[11px] px-2 py-1 border border-border rounded-[2px] cursor-pointer bg-card text-foreground hover:bg-sidebar disabled:opacity-50',
    ghostBtn: 'text-[11px] px-2 py-1 border border-border rounded-[2px] cursor-pointer text-muted hover:bg-sidebar hover:text-foreground',
    dangerBtn: 'text-[11px] px-2 py-1 border border-border rounded-[2px] cursor-pointer text-muted hover:bg-danger/10 hover:text-danger',
  },
  variants: {
    resultOk: { true: { result: 'text-success' }, false: { result: 'text-danger' } },
  },
})
```

- [ ] **步骤 5：实现 ModelNode 组件**

Props 与现有完全一致（model/onTest/onEdit/onRemove/testing/testResult/t），JSX 用 variants 替换行内类名，逻辑用 `useModelNode()`。对照 Models.tsx:24-94 逐行迁移，包含 ConfirmDialog（confirm.deleteModel.*）。

- [ ] **步骤 6：编写组件测试**

`ModelNode.test.tsx`：渲染 model_name、context_size 括号；点击 test 调 onTest(id)；点击 delete 后弹确认框；testResult.id 匹配时展示 msg。

- [ ] **步骤 7：运行验证**

运行：`pnpm test ModelNode useModelNode -- --run`
预期：PASS

- [ ] **步骤 8：Commit**

```bash
git add src/features/models
git commit -m "refactor(jacc): 拆分 ModelNode 组件与 useModelNode（任务 4.2）"
```

---

### 任务 4.3：拆分 ApiKeyNode（中间层）

**文件：**
- 创建：`features/models/hooks/useApiKeyNode.ts`
- 创建：`features/models/components/ApiKeyNode.tsx`
- 创建：`features/models/components/api-key-node.variants.ts`
- 测试：`features/models/components/ApiKeyNode.test.tsx`

对照 `pages/Models.tsx:99-265`。useApiKeyNode 封装 Models.tsx:110-157 的全部状态与处理函数（基于 useModels(apiKey.id)）。

- [ ] **步骤 1：编写 useApiKeyNode 失败测试**

`features/models/hooks/useApiKeyNode.test.ts`（mock `../api/models-api` 的 modelsApi）：

```typescript
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/toast/ToastProvider', () => ({ useToast: () => ({ error: vi.fn() }) }))
vi.mock('../api/models-api', () => ({
  modelsApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    test: vi.fn().mockResolvedValue('CONNECTION_SUCCESS'),
  },
}))

const t = (k: string) => k

describe('useApiKeyNode', () => {
  it('formats test result on success', async () => {
    const { useApiKeyNode } = await import('./useApiKeyNode')
    const { result } = renderHook(() => useApiKeyNode(1, t))
    await act(async () => { await result.current.handleTestModel(5) })
    await waitFor(() => expect(result.current.testResult).toEqual({ id: 5, msg: 'models.testSuccess', ok: true }))
  })
})
```

- [ ] **步骤 2：运行确认失败**

运行：`pnpm test useApiKeyNode -- --run`
预期：FAIL（模块不存在）

- [ ] **步骤 3：实现 useApiKeyNode**

签名 `useApiKeyNode(apiKeyId: number, t: (k: string, p?: Record<string,string>) => string)`。内部 `const { models, add, update, remove, test } = useModels(apiKeyId)`，迁移 Models.tsx:111-157 的：expanded/showAddModel/editingModel/showEditKey/testing/testResult/confirmDeleteKey 状态、formatTestResult、handleTestModel、handleAddModel、handleEditModel。返回这些状态、setter 和处理函数 + models/remove。formatTestResult 逻辑须逐字保留（CONNECTION_SUCCESS / CONNECTION_FAILED:(18) / HTTP_ERROR:(11)）。

- [ ] **步骤 4：创建 api-key-node.variants.ts**

迁移 Models.tsx:162-191 的 header 行内类名为 slots（header/chevron/info/name/masked/actions + 复用 ghostBtn/dangerBtn 同 model-node），list 区 slots（list/empty）。

- [ ] **步骤 5：实现 ApiKeyNode 组件**

Props 与现有一致（apiKey/onRemoveKey/onUpdateKey/t）。用 useApiKeyNode，渲染 header + 展开的 ModelNode 列表（复用任务 4.2 的 ModelNode）+ AddModelDialog（add/edit）+ AddApiKeyDialog（编辑 key）+ ConfirmDialog。逐行对照 Models.tsx:159-264 迁移。

- [ ] **步骤 6：编写组件测试**

`ApiKeyNode.test.tsx`（mock useModels 返回固定 models）：渲染 apiKey.name/api_key_masked；点击展开显示 ModelNode 或 models.empty；点击 addBtn 打开 AddModelDialog；点击 delete 弹 confirm.deleteApiKey。

- [ ] **步骤 7：运行验证**

运行：`pnpm test ApiKeyNode useApiKeyNode -- --run`
预期：PASS

- [ ] **步骤 8：Commit**

```bash
git add src/features/models
git commit -m "refactor(jacc): 拆分 ApiKeyNode 组件与 useApiKeyNode（任务 4.3）"
```

---

### 任务 4.4：拆分 ProviderNode（顶层）

**文件：**
- 创建：`features/models/hooks/useProviderNode.ts`
- 创建：`features/models/components/ProviderNode.tsx`
- 创建：`features/models/components/provider-node.variants.ts`
- 测试：`features/models/components/ProviderNode.test.tsx`

对照 `pages/Models.tsx:270-376`。useProviderNode 基于 useApiKeys(provider.id)。

- [ ] **步骤 1：编写 useProviderNode 失败测试**

`features/models/hooks/useProviderNode.test.ts`：

```typescript
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/toast/ToastProvider', () => ({ useToast: () => ({ error: vi.fn() }) }))
vi.mock('../api/models-api', () => ({
  apiKeysApi: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

describe('useProviderNode', () => {
  it('handleAddKey closes add form', async () => {
    const { useProviderNode } = await import('./useProviderNode')
    const { result } = renderHook(() => useProviderNode(1))
    act(() => result.current.setShowAddKey(true))
    expect(result.current.showAddKey).toBe(true)
    await act(async () => {
      await result.current.handleAddKey({ provider_id: 1, name: 'k', api_key: 'x', notes: null })
    })
    expect(result.current.showAddKey).toBe(false)
  })
})
```

- [ ] **步骤 2：运行确认失败**

运行：`pnpm test useProviderNode -- --run`
预期：FAIL（模块不存在）

- [ ] **步骤 3：实现 useProviderNode**

签名 `useProviderNode(providerId: number)`。内部 `const { apiKeys, add, update, remove } = useApiKeys(providerId)`，迁移 Models.tsx:282-290 的 expanded/showAddKey/showEditProvider/confirmDeleteProvider 状态 + handleAddKey（add 后 setShowAddKey(false)）。返回这些 + apiKeys/update/remove。

- [ ] **步骤 4：创建 provider-node.variants.ts**

迁移 Models.tsx:293-324 的卡片 + header 行内类名为 slots（root/header/chevron/info/name/url/actions + 复用 ghostBtn/dangerBtn），list 区 slots（list/empty）。

- [ ] **步骤 5：实现 ProviderNode 组件**

Props 与现有一致（provider/onRemoveProvider/onUpdateProvider/t）。用 useProviderNode，渲染 header + 展开的 ApiKeyNode 列表（复用任务 4.3）+ AddApiKeyDialog（add）+ AddProviderDialog（编辑）+ ConfirmDialog（confirm.deleteProvider.*）。逐行对照 Models.tsx:292-374。

- [ ] **步骤 6：编写组件测试**

`ProviderNode.test.tsx`（mock useApiKeys）：渲染 provider.name/base_url；展开显示 ApiKeyNode 或 models.empty；点击 apiKeys.addBtn 打开 AddApiKeyDialog；点击删除弹 confirm.deleteProvider。

- [ ] **步骤 7：运行验证**

运行：`pnpm test ProviderNode useProviderNode -- --run`
预期：PASS

- [ ] **步骤 8：Commit**

```bash
git add src/features/models
git commit -m "refactor(jacc): 拆分 ProviderNode 组件与 useProviderNode（任务 4.4）"
```

---

### 任务 4.5：简化 Models.tsx 页面入口

**文件：**
- 修改：`pages/Models.tsx`（从 413 行降到约 40 行）

- [ ] **步骤 1：重写 Models.tsx 为列表入口**

删除内联的三个 Node 组件和 btnBase/btnGhost/btnDanger，改为 import 拆分后的 ProviderNode：

```tsx
import { useState } from 'react'
import { ProviderNode } from '@/features/models/components/ProviderNode'
import { useProviders } from '@/features/models/hooks/useProviders'
import { AddProviderDialog } from '@/features/models/components/AddProviderDialog'
import { useT } from '@/i18n'
import { Fab } from '@/shared/components/ui/Fab'

export function Models() {
  const { t } = useT()
  const { providers, add, update, remove } = useProviders()
  const [showAddProvider, setShowAddProvider] = useState(false)

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('models.title')}</h2>
      <div className="flex flex-col gap-2">
        {providers.map(provider => (
          <ProviderNode
            key={provider.id}
            provider={provider}
            onRemoveProvider={remove}
            onUpdateProvider={update}
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
      <AddProviderDialog open={showAddProvider} onClose={() => setShowAddProvider(false)} onSubmit={add} />
    </div>
  )
}
```

注意 import 顺序须满足 perfectionist/sort-imports（运行 lint 自动修复）。

- [ ] **步骤 2：运行全量验证**

运行：`pnpm test -- --run && pnpm tsc --noEmit && pnpm lint`
预期：全部通过，Models 相关测试无回退

- [ ] **步骤 3：Commit**

```bash
git add src/pages/Models.tsx
git commit -m "refactor(jacc): 简化 Models 页面为列表入口（任务 4.5）"
```

---

### 任务 4.6：建立 McpServers features 模块

**文件：**
- 创建：`features/mcp-servers/api/mcp-servers-api.ts`
- 创建：`features/mcp-servers/hooks/useMcpServers.ts`
- 创建：`features/mcp-servers/components/McpServerItem.tsx` + `mcp-server-item.variants.ts` + 测试
- 创建：`features/mcp-servers/components/AddMcpServerForm.tsx` + `add-mcp-server-form.variants.ts` + 测试
- 修改：`pages/McpServers.tsx`

对照 `pages/McpServers.tsx`（现状全部 175 行）。注意 useConfig 现位于 `@/shared/hooks/useConfig`（任务 4.1 后）。

- [ ] **步骤 1：实现 api 层（纯数据提取，无 React）**

`mcp-servers-api.ts`：定义类型并从 MergedConfig 提取/构造 mcpServers 写入参数：

```typescript
import type { MergedConfig } from '@/shared/hooks/useConfig'

export interface McpServer {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export function extractMcpServers(config: MergedConfig | null): {
  servers: Record<string, McpServer>
  scope: 'global' | 'project'
} {
  const item = config?.items.find(i => i.key === 'mcpServers')
  return {
    servers: (item?.value as Record<string, McpServer>) || {},
    scope: item?.scope || 'global',
  }
}

export function upsertServer(servers: Record<string, McpServer>, name: string, server: McpServer) {
  return { ...servers, [name]: server }
}

export function removeServer(servers: Record<string, McpServer>, name: string) {
  const next = { ...servers }
  delete next[name]
  return next
}
```

- [ ] **步骤 2：编写 useMcpServers 失败测试**

`features/mcp-servers/hooks/useMcpServers.test.ts`（mock `@/shared/hooks/useConfig`）：

```typescript
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const writeConfig = vi.fn().mockResolvedValue(undefined)
vi.mock('@/shared/hooks/useConfig', () => ({
  useConfig: () => ({
    config: { items: [{ key: 'mcpServers', value: { a: { command: 'x' } }, scope: 'global' }] },
    writeConfig,
  }),
}))

describe('useMcpServers', () => {
  it('exposes servers and saves via writeConfig', async () => {
    const { useMcpServers } = await import('./useMcpServers')
    const { result } = renderHook(() => useMcpServers())
    expect(result.current.servers).toHaveProperty('a')
    await act(async () => { await result.current.save('b', { command: 'y' }) })
    expect(writeConfig).toHaveBeenCalledWith('global', 'mcpServers', { a: { command: 'x' }, b: { command: 'y' } })
  })
})
```

- [ ] **步骤 3：运行确认失败**

运行：`pnpm test useMcpServers -- --run`
预期：FAIL（模块不存在）

- [ ] **步骤 4：实现 useMcpServers**

用 useConfig + api 层函数：返回 `{ servers, scope, save(name, server), remove(name), add(name, command, args) }`。save/remove 调 writeConfig(scope, 'mcpServers', ...)。add 解析空格分隔 args（对照 McpServers.tsx:39-52）。

- [ ] **步骤 5：实现组件 + variants（迁移行内样式）**

- `McpServerItem`：受控 props（name, server, expanded, onToggle, onSave, onDelete, t）。迁移 McpServers.tsx:60-152 的折叠卡片 + command/args/env 编辑 + 删除。
- `AddMcpServerForm`：受控 props（visible, values, onChange, onSubmit, onCancel, t）。迁移 McpServers.tsx:157-170。
- variants 文件把所有行内 className 迁入 slots。

- [ ] **步骤 6：编写组件测试**

`McpServerItem.test.tsx`：渲染 name/command；expanded 时显示 command 输入框；点 delete 调 onDelete(name)。`AddMcpServerForm.test.tsx`：visible 时显示输入框；填名+命令后 submit 调 onSubmit。

- [ ] **步骤 7：重写 McpServers.tsx 入口**

用 useMcpServers + 局部 expanded/showAdd 状态，map McpServerItem + AddMcpServerForm + Fab。保留 SourceBadge（传 scope）。

- [ ] **步骤 8：运行验证**

运行：`pnpm test mcp -- --run && pnpm tsc --noEmit && pnpm lint`
预期：PASS

- [ ] **步骤 9：Commit**

```bash
git add src/features/mcp-servers src/pages/McpServers.tsx
git commit -m "refactor(jacc): 建立 McpServers features 模块（任务 4.6）"
```

---

### 任务 4.7：建立 Permissions features 模块

**文件：**
- 创建：`features/permissions/api/permissions-api.ts`
- 创建：`features/permissions/hooks/usePermissions.ts` + 测试
- 创建：`features/permissions/components/PermissionTable.tsx` + `permission-table.variants.ts` + 测试
- 创建：`features/permissions/components/AddPermissionForm.tsx` + `add-permission-form.variants.ts` + 测试
- 修改：`pages/Permissions.tsx`

对照 `pages/Permissions.tsx`（现状 157 行）。

- [ ] **步骤 1：实现 api 层**

`permissions-api.ts`：

```typescript
import type { MergedConfig } from '@/shared/hooks/useConfig'

export interface PermissionRule {
  tool: string
  pattern: string
}

export type PermissionType = 'allow' | 'deny'

export function extractPermissions(config: MergedConfig | null): {
  permissions: Record<string, PermissionRule[]>
  scope: 'global' | 'project'
} {
  const item = config?.items.find(i => i.key === 'permissions')
  return {
    permissions: (item?.value as Record<string, PermissionRule[]>) || {},
    scope: item?.scope || 'global',
  }
}

export function addRule(
  permissions: Record<string, PermissionRule[]>,
  type: PermissionType,
  rule: PermissionRule,
) {
  return { ...permissions, [type]: [...(permissions[type] || []), rule] }
}

export function removeRule(
  permissions: Record<string, PermissionRule[]>,
  type: PermissionType,
  index: number,
) {
  const current = [...(permissions[type] || [])]
  current.splice(index, 1)
  return { ...permissions, [type]: current }
}
```

- [ ] **步骤 2：编写 usePermissions 失败测试**

`usePermissions.test.ts`（mock `@/shared/hooks/useConfig`）：验证 allowRules/denyRules 派生，add 调 writeConfig（注意 add 用的是表单选择的 scope，remove 用 permScope —— 对照 Permissions.tsx:37 与 :46）。

- [ ] **步骤 3：运行确认失败**

运行：`pnpm test usePermissions -- --run`
预期：FAIL（模块不存在）

- [ ] **步骤 4：实现 usePermissions**

返回 `{ allowRules, denyRules, scope, add(type, rule, scope), remove(type, index) }`。add(type, rule, formScope) → writeConfig(formScope, 'permissions', addRule(...))；remove(type, index) → writeConfig(scope, 'permissions', removeRule(...))。

- [ ] **步骤 5：实现组件 + variants**

- `PermissionTable`：受控 props（title, titleColor: 'success'|'danger', rules, scope, emptyText, onDelete, t）。迁移 Permissions.tsx 的表格结构（表头 + 行 + SourceBadge + 删除按钮 + 空态）。allow/deny 两块复用同一组件，仅 variant 不同。
- `AddPermissionForm`：受控 props（visible, type/tool/pattern/scope 及其 setter, onSubmit, onCancel, t）。迁移 Permissions.tsx:122-152。
- variants 把行内 className 迁入 slots（含 titleColor variant 切 success/danger，Allow/Deny badge 颜色）。

- [ ] **步骤 6：编写组件测试**

`PermissionTable.test.tsx`：渲染 rule.tool/pattern；无规则显示 emptyText；点 × 调 onDelete(index)。`AddPermissionForm.test.tsx`：visible 时显示 pattern 输入；submit 调 onSubmit。

- [ ] **步骤 7：重写 Permissions.tsx 入口**

用 usePermissions + 局部表单状态，渲染两个 PermissionTable（allow/deny）+ AddPermissionForm + Fab。

- [ ] **步骤 8：运行验证**

运行：`pnpm test permission -- --run && pnpm tsc --noEmit && pnpm lint`
预期：PASS

- [ ] **步骤 9：Commit**

```bash
git add src/features/permissions src/pages/Permissions.tsx
git commit -m "refactor(jacc): 建立 Permissions features 模块（任务 4.7）"
```

---

### 任务 4.8：建立 EnvVars features 模块

**文件：**
- 创建：`features/env-vars/api/env-vars-api.ts`
- 创建：`features/env-vars/hooks/useEnvVars.ts` + 测试
- 创建：`features/env-vars/components/EnvVarRow.tsx` + `env-var-row.variants.ts` + 测试
- 创建：`features/env-vars/components/AddEnvVarForm.tsx` + `add-env-var-form.variants.ts` + 测试
- 修改：`pages/EnvVars.tsx`

对照 `pages/EnvVars.tsx`（现状 159 行）。

- [ ] **步骤 1：实现 api 层**

`env-vars-api.ts`：

```typescript
import type { MergedConfig } from '@/shared/hooks/useConfig'

export const MODEL_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
]

export function extractEnv(config: MergedConfig | null): {
  env: Record<string, string>
  scope: 'global' | 'project'
} {
  const item = config?.items.find(i => i.key === 'env')
  return {
    env: (item?.value as Record<string, string>) || {},
    scope: item?.scope || 'global',
  }
}

export function splitEnv(env: Record<string, string>) {
  const entries = Object.entries(env)
  return {
    regularEntries: entries.filter(([k]) => !MODEL_ENV_KEYS.includes(k)),
    modelEntries: entries.filter(([k]) => MODEL_ENV_KEYS.includes(k)),
  }
}

export function setEnvVar(env: Record<string, string>, key: string, value: string) {
  return { ...env, [key]: value }
}

export function deleteEnvVar(env: Record<string, string>, key: string) {
  const next = { ...env }
  delete next[key]
  return next
}
```

- [ ] **步骤 2：编写 useEnvVars 失败测试**

`useEnvVars.test.ts`（mock `@/shared/hooks/useConfig`）：验证 regularEntries/modelEntries 分组；add/delete/update 调 writeConfig(scope, 'env', ...)。

- [ ] **步骤 3：运行确认失败**

运行：`pnpm test useEnvVars -- --run`
预期：FAIL（模块不存在）

- [ ] **步骤 4：实现 useEnvVars**

返回 `{ regularEntries, modelEntries, scope, add(key, value), remove(key), update(key, value) }`。注意现有 EnvVars 用 pendingRef + onBlur 提交编辑（EnvVars.tsx:48-58）；update 即对应 handleBlur 的写入逻辑，pendingRef 留在组件层管理（属 UI 局部状态）。

- [ ] **步骤 5：实现组件 + variants**

- `EnvVarRow`：受控 props（envKey, value, scope, readOnly, defaultValue, onLocalChange, onBlur, onDelete, t）。一个组件用 readOnly variant 同时覆盖普通行（可编辑 + 删除）和模型行（只读 + managedByModels 文案，对照 EnvVars.tsx:108-117）。
- `AddEnvVarForm`：受控 props（visible, newKey/newValue 及 setter, onSubmit, onCancel, t）。迁移 EnvVars.tsx:121-153。
- variants 把行内 className 迁入 slots（含 readOnly variant 切 opacity-50）。

- [ ] **步骤 6：编写组件测试**

`EnvVarRow.test.tsx`：普通行渲染 key 与可编辑 input，点 × 调 onDelete(key)；readOnly 行显示 managedByModels 文案、无删除按钮。`AddEnvVarForm.test.tsx`：visible 时显示 name/value 输入，submit 调 onSubmit。

- [ ] **步骤 7：重写 EnvVars.tsx 入口**

用 useEnvVars + 局部 showAdd/newKey/newValue/pendingRef，渲染模型变量提示（modelEntries.length>0）+ 表格（表头 + regularEntries 的 EnvVarRow + modelEntries 的只读 EnvVarRow）+ AddEnvVarForm + Fab。

- [ ] **步骤 8：运行验证**

运行：`pnpm test env -- --run && pnpm tsc --noEmit && pnpm lint`
预期：PASS

- [ ] **步骤 9：Commit**

```bash
git add src/features/env-vars src/pages/EnvVars.tsx
git commit -m "refactor(jacc): 建立 EnvVars features 模块（任务 4.8）"
```

---

### 任务 4.9：批次整体验证

- [ ] **步骤 1：全量测试 + 类型 + lint**

运行：`pnpm test -- --run && pnpm tsc --noEmit && pnpm lint`
预期：全部通过，无回退

- [ ] **步骤 2：确认 src/hooks 已清空**

运行：`ls src/hooks 2>/dev/null || echo "empty"`
预期：目录为空或不存在（所有共享 hook 已迁移）

- [ ] **步骤 3：人工冒烟（可选）**

运行：`pnpm dev`（端口 5172），手动验证 Models 三层展开/增删改、McpServers/Permissions/EnvVars 增删改无回退。

---

## 验证标准（对照设计 3.3）

- ✅ 所有新组件都有对应 `.variants.ts`
- ✅ 所有组件命名导出 + Props 接口导出
- ✅ 组件文件 < 300 行，JSX < 50 行；Models.tsx 从 413 行降至约 40 行
- ✅ 配置页业务逻辑下沉到 features hook，页面仅做装配
- ✅ 无 TypeScript 错误、无 ESLint 警告
- ✅ 测试全绿，功能零回退
