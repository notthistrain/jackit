# jacc 前端重构 - 批次 3：复合组件层

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建 API 抽象层（models-api、skills-api），重构现有 hooks 改用 API 层，重构 4 个对话框组件和 2 个列表组件到 features/ 模块化结构，复用批次 1 的原子组件

**架构：** 建立 `features/models/` 和 `features/skills/` 功能模块（api + hooks + components），API 层为纯函数只调用 Tauri commands，Hook 层管理状态和副作用并保留 useToast 错误处理

**技术栈：** React 19、TypeScript、tailwind-variants、Vitest + Testing Library

**关键决策（用户确认）：**
- API 层创建后立即改造现有 hooks 使用
- 对话框完全复用 Button/Input/Dialog 原子组件
- InstallSkillDialog、SkillList 适度拆分子组件

**测试约定：** 测试文件统一使用具名导入 `import { userEvent } from '@testing-library/user-event'`，断言风格使用 `toBeTruthy()` / `toBeNull()`（与批次 1/2 一致）。

---

## 文件结构

### 新增文件
```
packages/jacc/src/features/
├── models/
│   ├── api/
│   │   └── models-api.ts            # Provider/ApiKey/Model/AllModels API
│   ├── hooks/
│   │   ├── useProviders.ts          # 迁移自 src/hooks/
│   │   ├── useApiKeys.ts
│   │   ├── useModels.ts
│   │   ├── useModels.test.ts        # 随 hook 一起迁移
│   │   ├── useAllModels.ts
│   │   └── useAllModels.test.ts     # 随 hook 一起迁移
│   └── components/
│       ├── AddProviderDialog.tsx
│       ├── add-provider-dialog.variants.ts
│       ├── AddProviderDialog.test.tsx
│       ├── AddApiKeyDialog.tsx
│       ├── add-api-key-dialog.variants.ts
│       ├── AddApiKeyDialog.test.tsx
│       ├── AddModelDialog.tsx
│       ├── add-model-dialog.variants.ts
│       ├── AddModelDialog.test.tsx
│       ├── ModelSelect.tsx
│       ├── model-select.variants.ts
│       └── ModelSelect.test.tsx
└── skills/
    ├── api/
    │   └── skills-api.ts            # Skill 列表/切换/导入/安装 API
    ├── hooks/
    │   └── useSkills.ts             # 迁移自 src/hooks/
    └── components/
        ├── SkillList.tsx
        ├── skill-list.variants.ts
        ├── SkillList.test.tsx
        ├── SkillListItem.tsx        # 拆分：单个技能项
        ├── skill-list-item.variants.ts
        ├── InstallSkillDialog.tsx
        ├── install-skill-dialog.variants.ts
        ├── InstallSkillDialog.test.tsx
        ├── SkillSelectList.tsx      # 拆分：技能选择列表
        └── skill-select-list.variants.ts
```

### 修改文件
```
packages/jacc/src/shared/components/ui/Input.tsx          # 扩展密码显示切换
packages/jacc/src/shared/components/ui/input.variants.ts  # 新增 trailing icon 槽
packages/jacc/src/pages/Models.tsx                        # 更新导入路径
packages/jacc/src/pages/Skills.tsx                        # 更新导入路径
packages/jacc/src/pages/General.tsx                       # 更新导入路径
```

### 删除文件
```
packages/jacc/src/components/dialogs/AddProviderDialog.tsx
packages/jacc/src/components/dialogs/AddApiKeyDialog.tsx
packages/jacc/src/components/dialogs/AddModelDialog.tsx
packages/jacc/src/components/dialogs/InstallSkillDialog.tsx
packages/jacc/src/components/SkillList.tsx
packages/jacc/src/components/ModelSelect.tsx
packages/jacc/src/components/ModelSelect.test.tsx
packages/jacc/src/hooks/useProviders.ts
packages/jacc/src/hooks/useApiKeys.ts
packages/jacc/src/hooks/useModels.ts
packages/jacc/src/hooks/useAllModels.ts
packages/jacc/src/hooks/useSkills.ts
```

---
## 任务 3.1：扩展 Input 组件支持密码显示切换

**文件：**
- 修改：`packages/jacc/src/shared/components/ui/input.variants.ts`
- 修改：`packages/jacc/src/shared/components/ui/Input.tsx`
- 修改：`packages/jacc/src/shared/components/ui/Input.test.tsx`

**原因：** AddApiKeyDialog 需要密码框的显示/隐藏切换。为完全复用原子组件，先扩展 Input。

- [ ] **步骤 1：扩展 input.variants.ts**

读取：`packages/jacc/src/shared/components/ui/input.variants.ts`

**重要：以现有文件为基础增量修改，不要替换现有样式（focus ring、placeholder 等），否则会破坏批次 1 的测试。**

现有文件内容为：

```typescript
import { tv } from 'tailwind-variants'

export const input = tv({
  slots: {
    root: 'w-full bg-sidebar border border-border rounded-[4px] text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
    label: 'text-[11px] text-muted mb-1 block',
    error: 'text-[11px] text-danger mt-1',
  },
  variants: {
    size: {
      sm: { root: 'px-2 py-1' },
      md: { root: 'px-3 py-2' },
    },
    hasError: {
      true: { root: 'border-danger focus:ring-danger' },
    },
    disabled: {
      true: { root: 'opacity-50 cursor-not-allowed' },
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
```

只做两处增量修改：
1. 在 slots 中新增 `wrapper: 'relative'` 和 `trailingButton: 'absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground'`
2. 在 variants 中新增 `hasTrailing: { true: { root: 'pr-9' } }`

修改后：

```typescript
import { tv } from 'tailwind-variants'

export const input = tv({
  slots: {
    root: 'w-full bg-sidebar border border-border rounded-[4px] text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
    label: 'text-[11px] text-muted mb-1 block',
    wrapper: 'relative',
    trailingButton: 'absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground',
    error: 'text-[11px] text-danger mt-1',
  },
  variants: {
    size: {
      sm: { root: 'px-2 py-1' },
      md: { root: 'px-3 py-2' },
    },
    hasError: {
      true: { root: 'border-danger focus:ring-danger' },
    },
    hasTrailing: {
      true: { root: 'pr-9' },
    },
    disabled: {
      true: { root: 'opacity-50 cursor-not-allowed' },
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
```

- [ ] **步骤 2：扩展 Input.tsx 支持 password 切换**

修改：`packages/jacc/src/shared/components/ui/Input.tsx`

新增 `togglePassword` 可选 prop。当 `type="password"` 且 `togglePassword` 为 true 时，渲染眼睛图标按钮切换显示：

```typescript
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { input } from './input.variants'

export interface InputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  type?: 'text' | 'password' | 'email' | 'number'
  togglePassword?: boolean
  className?: string
}

export function Input({
  value,
  onChange,
  placeholder,
  label,
  error,
  disabled,
  size,
  type = 'text',
  togglePassword = false,
  className,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const hasTrailing = type === 'password' && togglePassword
  const effectiveType = hasTrailing && showPassword ? 'text' : type

  const { root, label: labelClass, wrapper, trailingButton, error: errorClass } = input({
    size,
    hasError: !!error,
    hasTrailing,
    disabled,
  })

  return (
    <div className={className}>
      {label && <label className={labelClass()}>{label}</label>}
      <div className={wrapper()}>
        <input
          type={effectiveType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={root()}
        />
        {hasTrailing && (
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className={trailingButton()}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {error && <div className={errorClass()}>{error}</div>}
    </div>
  )
}
```

- [ ] **步骤 3：补充 Input.test.tsx 测试**

在现有 Input.test.tsx 中新增 2 个测试（保留原有测试）：

```typescript
it('renders password toggle when togglePassword is true', () => {
  const { container } = render(
    <Input value="secret" onChange={vi.fn()} type="password" togglePassword />,
  )
  const button = container.querySelector('button')
  expect(button).toBeTruthy()
})

it('toggles password visibility when toggle clicked', async () => {
  const { container } = render(
    <Input value="secret" onChange={vi.fn()} type="password" togglePassword />,
  )
  const inputEl = container.querySelector('input')!
  expect(inputEl.getAttribute('type')).toBe('password')
  await userEvent.click(container.querySelector('button')!)
  expect(inputEl.getAttribute('type')).toBe('text')
})
```

> 确保测试文件顶部已导入 `userEvent`。

- [ ] **步骤 4：运行测试**

```bash
cd packages/jacc && pnpm test Input.test
```

验证：所有测试通过（原有 + 新增 2 个）

- [ ] **步骤 5：提交变更**

```bash
git add packages/jacc/src/shared/components/ui/input.variants.ts \
        packages/jacc/src/shared/components/ui/Input.tsx \
        packages/jacc/src/shared/components/ui/Input.test.tsx
git commit -m "feat(jacc): Input 组件支持密码显示切换（任务 3.1）"
```

---

## 任务 3.2：创建 models-api 抽象层

**文件：**
- 新增：`packages/jacc/src/features/models/api/models-api.ts`
- 新增：`packages/jacc/src/features/models/api/models-api.test.ts`

**架构：** API 层为纯函数，只调用 Tauri commands，错误直接抛出（由 Hook 层处理）。类型定义从现有 hooks 迁移过来。

- [ ] **步骤 1：创建 models-api.ts**

创建：`packages/jacc/src/features/models/api/models-api.ts`

```typescript
import { invoke } from '@tauri-apps/api/core'

// ===== 类型定义 =====
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

export interface FlatModel {
  modelId: number
  modelName: string
  providerName: string
  keyName: string
}

// ===== Provider API =====
export const providersApi = {
  list: () => invoke<Provider[]>('list_providers'),
  create: (input: CreateProviderInput) => invoke<void>('add_provider', { input }),
  update: (id: number, input: UpdateProviderInput) => invoke<void>('update_provider', { id, input }),
  delete: (id: number) => invoke<void>('delete_provider', { id }),
}

// ===== ApiKey API =====
export const apiKeysApi = {
  list: (providerId: number) => invoke<ApiKeyView[]>('list_api_keys', { providerId }),
  create: (input: CreateApiKeyInput) => invoke<void>('add_api_key', { input }),
  update: (id: number, input: UpdateApiKeyInput) => invoke<void>('update_api_key', { id, input }),
  delete: (id: number) => invoke<void>('delete_api_key', { id }),
}

// ===== Model API =====
export const modelsApi = {
  list: (apiKeyId: number) => invoke<Model[]>('list_models', { apiKeyId }),
  create: (input: CreateModelInput) => invoke<void>('add_model', { input }),
  update: (id: number, input: UpdateModelInput) => invoke<void>('update_model', { id, input }),
  delete: (id: number) => invoke<void>('delete_model', { id }),
  test: (id: number) => invoke<string>('test_model', { id }),
}
```

> 重要：command 名称和参数结构必须与现有 hooks 完全一致（list_providers、add_provider 用 { input }、update_model 用 { id, input } 等）。参考 src/hooks/useProviders.ts、useApiKeys.ts、useModels.ts 的现有调用。

- [ ] **步骤 2：创建 models-api.test.ts**

创建：`packages/jacc/src/features/models/api/models-api.test.ts`

```typescript
import { invoke } from '@tauri-apps/api/core'
import { describe, expect, it, vi } from 'vitest'
import { apiKeysApi, modelsApi, providersApi } from './models-api'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('providersApi', () => {
  it('list calls list_providers', () => {
    providersApi.list()
    expect(invoke).toHaveBeenCalledWith('list_providers')
  })

  it('create calls add_provider with input', () => {
    const input = { name: 'X', base_url: 'http://x', notes: null }
    providersApi.create(input)
    expect(invoke).toHaveBeenCalledWith('add_provider', { input })
  })
})

describe('apiKeysApi', () => {
  it('list calls list_api_keys with providerId', () => {
    apiKeysApi.list(1)
    expect(invoke).toHaveBeenCalledWith('list_api_keys', { providerId: 1 })
  })
})

describe('modelsApi', () => {
  it('test calls test_model with id', () => {
    modelsApi.test(5)
    expect(invoke).toHaveBeenCalledWith('test_model', { id: 5 })
  })
})
```

- [ ] **步骤 3：运行测试**

```bash
cd packages/jacc && pnpm test models-api.test
```

验证：所有测试通过

- [ ] **步骤 4：提交变更**

```bash
git add packages/jacc/src/features/models/api/
git commit -m "feat(jacc): 创建 models-api 抽象层（任务 3.2）"
```

---
## 任务 3.3：重构 models hooks 改用 API 层并迁移到 features

**文件：**
- 新增：`packages/jacc/src/features/models/hooks/useProviders.ts`
- 新增：`packages/jacc/src/features/models/hooks/useApiKeys.ts`
- 新增：`packages/jacc/src/features/models/hooks/useModels.ts`
- 新增：`packages/jacc/src/features/models/hooks/useAllModels.ts`
- 删除：`packages/jacc/src/hooks/useProviders.ts`
- 删除：`packages/jacc/src/hooks/useApiKeys.ts`
- 删除：`packages/jacc/src/hooks/useModels.ts`
- 删除：`packages/jacc/src/hooks/useAllModels.ts`

**架构：** Hook 层管理状态和副作用，调用 API 层纯函数，保留 useToast 错误处理。类型从 API 层重新导出（不再重复定义）。

- [ ] **步骤 1：创建 useProviders.ts**

创建：`packages/jacc/src/features/models/hooks/useProviders.ts`

```typescript
import type { CreateProviderInput, Provider, UpdateProviderInput } from '../api/models-api'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'
import { providersApi } from '../api/models-api'

export type { CreateProviderInput, Provider, UpdateProviderInput }

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setProviders(await providersApi.list())
    }
    catch (e) {
      error(String(e))
    }
    finally {
      setLoading(false)
    }
  }, [error])

  const add = useCallback(async (input: CreateProviderInput) => {
    try {
      await providersApi.create(input)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const update = useCallback(async (id: number, input: UpdateProviderInput) => {
    try {
      await providersApi.update(id, input)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const remove = useCallback(async (id: number) => {
    try {
      await providersApi.delete(id)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { providers, loading, refresh, add, update, remove }
}
```

- [ ] **步骤 2：创建 useApiKeys.ts**

创建：`packages/jacc/src/features/models/hooks/useApiKeys.ts`

按相同模式重构：从 `../api/models-api` 导入 `apiKeysApi` 及类型，重新导出 `ApiKeyView`、`CreateApiKeyInput`、`UpdateApiKeyInput`。保留 `useApiKeys(providerId)` 签名、`providerId` 为空时跳过 refresh 的逻辑、useToast 错误处理。`refresh` 调用 `apiKeysApi.list(providerId)`，`add/update/remove` 调用对应 API 后 refresh。

- [ ] **步骤 3：创建 useModels.ts**

创建：`packages/jacc/src/features/models/hooks/useModels.ts`

按相同模式重构：从 `../api/models-api` 导入 `modelsApi` 及类型，重新导出 `Model`、`CreateModelInput`、`UpdateModelInput`。保留 `useModels(apiKeyId)` 签名、`apiKeyId` 为空时跳过、`test(id)` 方法调用 `modelsApi.test(id)`。

- [ ] **步骤 4：创建 useAllModels.ts**

创建：`packages/jacc/src/features/models/hooks/useAllModels.ts`

从 `../api/models-api` 导入 `providersApi`、`apiKeysApi`、`modelsApi` 和 `FlatModel` 类型并重新导出 `FlatModel`。保留嵌套遍历逻辑（providers → apiKeys → models 扁平化为 FlatModel[]），改用 API 层方法调用。保留 useToast 错误处理。

- [ ] **步骤 5：删除旧 hooks**

```bash
git rm packages/jacc/src/hooks/useProviders.ts \
       packages/jacc/src/hooks/useApiKeys.ts \
       packages/jacc/src/hooks/useModels.ts \
       packages/jacc/src/hooks/useAllModels.ts
```

- [ ] **步骤 6：更新所有引用旧 hooks 的导入路径**

查找所有引用，更新导入路径：
```bash
cd packages/jacc && grep -rl "@/hooks/useProviders\|@/hooks/useApiKeys\|@/hooks/useModels\|@/hooks/useAllModels" src/
```

将这些引用更新为 `@/features/models/hooks/<hookName>`。注意 useModels.test.ts 如果存在也需更新或迁移。

- [ ] **步骤 7：验证 TypeScript 编译**

```bash
cd packages/jacc && pnpm tsc --noEmit
```

验证：无新增类型错误

- [ ] **步骤 8：运行所有测试**

```bash
cd packages/jacc && pnpm test
```

验证：所有测试通过

- [ ] **步骤 9：提交变更**

```bash
git add packages/jacc/src/features/models/hooks/ packages/jacc/src/
git commit -m "refactor(jacc): models hooks 迁移到 features 并改用 API 层（任务 3.3）"
```

---
## 任务 3.4：创建 skills-api 抽象层

**文件：**
- 新增：`packages/jacc/src/features/skills/api/skills-api.ts`
- 新增：`packages/jacc/src/features/skills/api/skills-api.test.ts`

**架构：** API 层为纯函数，只调用 Tauri commands。类型从现有 useSkills.ts 迁移。注意所有命令都需要 projectPath 参数（由 Hook 层传入）。

- [ ] **步骤 1：创建 skills-api.ts**

创建：`packages/jacc/src/features/skills/api/skills-api.ts`

```typescript
import { invoke } from '@tauri-apps/api/core'

export interface SkillInfo {
  name: string
  description: string
  enabled: boolean
  source: string
}

export interface GithubInstallResult {
  token: string
  skills: SkillInfo[]
  temp_dir?: string
}

export const skillsApi = {
  list: (projectPath: string) =>
    invoke<SkillInfo[]>('list_skills', { projectPath }),

  toggle: (projectPath: string, name: string, enabled: boolean) =>
    invoke<void>('toggle_skill', { projectPath, name, enabled }),

  import: (projectPath: string, sourcePath: string) =>
    invoke<void>('import_skill', { projectPath, sourcePath }),

  installFromGithub: (projectPath: string, repoUrl: string) =>
    invoke<GithubInstallResult>('install_skill_from_github', { projectPath, repoUrl }),

  confirmInstall: (projectPath: string, token: string, skillNames: string[]) =>
    invoke<void>('confirm_install_skill', { projectPath, token, skillNames }),
}
```

> 重要：command 名称和参数结构必须与现有 src/hooks/useSkills.ts 完全一致。参考其现有 invoke 调用确认参数名（如 confirm_install_skill 的参数）。

- [ ] **步骤 2：创建 skills-api.test.ts**

创建：`packages/jacc/src/features/skills/api/skills-api.test.ts`

```typescript
import { invoke } from '@tauri-apps/api/core'
import { describe, expect, it, vi } from 'vitest'
import { skillsApi } from './skills-api'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('skillsApi', () => {
  it('list calls list_skills with projectPath', () => {
    skillsApi.list('/path')
    expect(invoke).toHaveBeenCalledWith('list_skills', { projectPath: '/path' })
  })

  it('toggle calls toggle_skill with args', () => {
    skillsApi.toggle('/path', 'foo', true)
    expect(invoke).toHaveBeenCalledWith('toggle_skill', { projectPath: '/path', name: 'foo', enabled: true })
  })

  it('installFromGithub calls install_skill_from_github', () => {
    skillsApi.installFromGithub('/path', 'https://repo')
    expect(invoke).toHaveBeenCalledWith('install_skill_from_github', { projectPath: '/path', repoUrl: 'https://repo' })
  })
})
```

- [ ] **步骤 3：运行测试**

```bash
cd packages/jacc && pnpm test skills-api.test
```

验证：所有测试通过

- [ ] **步骤 4：提交变更**

```bash
git add packages/jacc/src/features/skills/api/
git commit -m "feat(jacc): 创建 skills-api 抽象层（任务 3.4）"
```

---

## 任务 3.5：重构 useSkills hook 改用 API 层并迁移到 features

**文件：**
- 新增：`packages/jacc/src/features/skills/hooks/useSkills.ts`
- 删除：`packages/jacc/src/hooks/useSkills.ts`

**架构：** 保留乐观更新逻辑（toggle 立即修改本地状态，失败回滚），改用 skills-api 层。类型从 API 层重新导出。

- [ ] **步骤 1：创建 useSkills.ts**

创建：`packages/jacc/src/features/skills/hooks/useSkills.ts`

```typescript
import type { GithubInstallResult, SkillInfo } from '../api/skills-api'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'
import { useAppStore } from '@/stores/useAppStore'
import { skillsApi } from '../api/skills-api'

export type { GithubInstallResult, SkillInfo }

export function useSkills() {
  const { currentProject } = useAppStore()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    if (!currentProject)
      return
    setLoading(true)
    try {
      setSkills(await skillsApi.list(currentProject))
    }
    catch (e) {
      error(String(e))
    }
    finally {
      setLoading(false)
    }
  }, [currentProject, error])

  const toggle = useCallback(async (name: string, enabled: boolean) => {
    if (!currentProject)
      return
    // 乐观更新
    setSkills(prev => prev.map(s => (s.name === name ? { ...s, enabled } : s)))
    try {
      await skillsApi.toggle(currentProject, name, enabled)
    }
    catch (e) {
      // 失败回滚
      setSkills(prev => prev.map(s => (s.name === name ? { ...s, enabled: !enabled } : s)))
      error(String(e))
    }
  }, [currentProject, error])

  const importSkill = useCallback(async (sourcePath: string) => {
    if (!currentProject)
      return
    try {
      await skillsApi.import(currentProject, sourcePath)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [currentProject, refresh, error])

  const installFromGithub = useCallback(async (repoUrl: string): Promise<GithubInstallResult> => {
    if (!currentProject)
      return { token: '', temp_dir: '', skills: [] }
    try {
      return await skillsApi.installFromGithub(currentProject, repoUrl)
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [currentProject, error])

  const confirmInstall = useCallback(async (token: string, skillNames: string[]) => {
    if (!currentProject)
      return
    try {
      await skillsApi.confirmInstall(currentProject, token, skillNames)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [currentProject, refresh, error])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { skills, loading, refresh, toggle, importSkill, installFromGithub, confirmInstall }
}
```

> 注意：核对现有 useSkills.ts 的完整方法签名和参数，确保迁移后行为一致。

- [ ] **步骤 2：删除旧 hook 并更新引用**

```bash
git rm packages/jacc/src/hooks/useSkills.ts
cd packages/jacc && grep -rl "@/hooks/useSkills" src/
```

将所有引用更新为 `@/features/skills/hooks/useSkills`。

- [ ] **步骤 3：验证编译和测试**

```bash
cd packages/jacc && pnpm tsc --noEmit
cd packages/jacc && pnpm test
```

验证：编译通过，所有测试通过

- [ ] **步骤 4：提交变更**

```bash
git add packages/jacc/src/features/skills/hooks/ packages/jacc/src/
git commit -m "refactor(jacc): useSkills 迁移到 features 并改用 API 层（任务 3.5）"
```

---
## 任务 3.6：重构 AddProviderDialog 复用原子组件

**文件：**
- 新增：`packages/jacc/src/features/models/components/add-provider-dialog.variants.ts`
- 新增：`packages/jacc/src/features/models/components/AddProviderDialog.tsx`
- 新增：`packages/jacc/src/features/models/components/AddProviderDialog.test.tsx`
- 删除：`packages/jacc/src/components/dialogs/AddProviderDialog.tsx`

**架构：** 复用 Dialog 外壳、Input 输入框、Button 按钮。表单逻辑（name/baseUrl/notes 状态、编辑模式、提交）保留。

- [ ] **步骤 1：创建 add-provider-dialog.variants.ts**

创建：`packages/jacc/src/features/models/components/add-provider-dialog.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const addProviderDialog = tv({
  slots: {
    form: 'flex flex-col gap-3.5',
    footer: 'flex justify-end gap-2',
  },
})
```

- [ ] **步骤 2：创建 AddProviderDialog.tsx**

创建：`packages/jacc/src/features/models/components/AddProviderDialog.tsx`

复用 Dialog 作为外壳（传 title、footer），Input 替换原生 input，Button 替换原生 button。保留：
- props 接口（open、onClose、onSubmit、initialValues）
- name/baseUrl/notes 状态和 useEffect 初始化逻辑
- isEdit 判断、handleSubmit 提交（含 submitting 状态）
- 校验：name 和 baseUrl 必填

```typescript
import type { CreateProviderInput } from '../api/models-api'
import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { Button } from '@/shared/components/ui/Button'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Input } from '@/shared/components/ui/Input'
import { addProviderDialog } from './add-provider-dialog.variants'

export interface AddProviderDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateProviderInput) => Promise<void>
  initialValues?: {
    name: string
    base_url: string
    notes: string
  }
}

export function AddProviderDialog({ open, onClose, onSubmit, initialValues }: AddProviderDialogProps) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { form, footer } = addProviderDialog()

  useEffect(() => {
    if (open && initialValues) {
      setName(initialValues.name)
      setBaseUrl(initialValues.base_url)
      setNotes(initialValues.notes)
    }
    else if (!open) {
      setName('')
      setBaseUrl('')
      setNotes('')
    }
  }, [open, initialValues])

  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!name || !baseUrl)
      return
    setSubmitting(true)
    try {
      await onSubmit({ name, base_url: baseUrl, notes: notes || null })
      onClose()
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t('providers.dialog.editTitle') : t('providers.dialog.addTitle')}
      footer={(
        <div className={footer()}>
          <Button variant="ghost" onClick={onClose}>
            {t('models.dialog.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name || !baseUrl}
          >
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </Button>
        </div>
      )}
    >
      <div className={form()}>
        <Input
          label={`${t('providers.dialog.name')} *`}
          value={name}
          onChange={setName}
          placeholder={t('providers.dialog.namePlaceholder')}
        />
        <Input
          label={`${t('providers.dialog.baseUrl')} *`}
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder={t('providers.dialog.baseUrlPlaceholder')}
        />
        <Input
          label={t('providers.dialog.notes')}
          value={notes}
          onChange={setNotes}
          placeholder={t('providers.dialog.notesPlaceholder')}
        />
      </div>
    </Dialog>
  )
}
```

> 注意：Dialog 的 onClose 会绑定 ESC 和遮罩点击。原组件没有这些行为但增强是合理的。确认 Dialog 的 size 默认值适合（原宽度 400px，可能需要 size="md"，核对 dialog.variants.ts 的尺寸定义，必要时调整）。

- [ ] **步骤 3：创建 AddProviderDialog.test.tsx**

创建测试，覆盖：
- open=false 不渲染
- open=true 渲染标题和输入框
- 填写表单后点击保存调用 onSubmit
- 编辑模式显示 initialValues

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddProviderDialog } from './AddProviderDialog'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

describe('addProviderDialog', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <AddProviderDialog open={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders inputs when open', () => {
    render(<AddProviderDialog open onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('providers.dialog.addTitle')).toBeTruthy()
  })

  it('calls onSubmit with form values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <AddProviderDialog open onClose={vi.fn()} onSubmit={onSubmit} />,
    )
    const inputs = container.querySelectorAll('input')
    await userEvent.type(inputs[0], 'MyProvider')
    await userEvent.type(inputs[1], 'http://api.test')
    await userEvent.click(screen.getByText('models.dialog.save'))
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'MyProvider',
      base_url: 'http://api.test',
      notes: null,
    })
  })
})
```

- [ ] **步骤 4：删除旧文件**

```bash
git rm packages/jacc/src/components/dialogs/AddProviderDialog.tsx
```

- [ ] **步骤 5：运行测试**

```bash
cd packages/jacc && pnpm test AddProviderDialog.test
```

- [ ] **步骤 6：提交变更**

```bash
git add packages/jacc/src/features/models/components/add-provider-dialog.variants.ts \
        packages/jacc/src/features/models/components/AddProviderDialog.tsx \
        packages/jacc/src/features/models/components/AddProviderDialog.test.tsx
git rm packages/jacc/src/components/dialogs/AddProviderDialog.tsx
git commit -m "refactor(jacc): AddProviderDialog 复用原子组件迁移到 features（任务 3.6）"
```

---

## 任务 3.7：重构 AddApiKeyDialog 复用原子组件（含密码切换）

**文件：**
- 新增：`packages/jacc/src/features/models/components/add-api-key-dialog.variants.ts`
- 新增：`packages/jacc/src/features/models/components/AddApiKeyDialog.tsx`
- 新增：`packages/jacc/src/features/models/components/AddApiKeyDialog.test.tsx`
- 删除：`packages/jacc/src/components/dialogs/AddApiKeyDialog.tsx`

**架构：** 复用 Dialog/Input/Button。API Key 输入框使用任务 3.1 扩展的 `togglePassword` prop。

- [ ] **步骤 1：创建 add-api-key-dialog.variants.ts**

与 add-provider-dialog.variants.ts 相同结构（form + footer slots）。

- [ ] **步骤 2：创建 AddApiKeyDialog.tsx**

参照 AddProviderDialog 模式。关键差异：
- props 含 `providerId: number`
- 状态：name、apiKey、notes（移除原 showKey 状态，由 Input 内部管理）
- API Key 输入框用 `<Input type="password" togglePassword ... />`
- 校验：name 必填，非编辑模式 apiKey 也必填
- 提交：`onSubmit({ provider_id: providerId, name, api_key: apiKey, notes: notes || null })`
- 编辑模式下 API Key 标签和 placeholder 不同（参考原组件的 apiKeyEdit 文案）

从 `../api/models-api` 导入 `CreateApiKeyInput` 类型。

- [ ] **步骤 3：创建 AddApiKeyDialog.test.tsx**

覆盖：关闭不渲染、打开渲染、密码切换按钮存在、填表提交调用 onSubmit（含 provider_id）、编辑模式。

- [ ] **步骤 4：删除旧文件并提交**

```bash
git add packages/jacc/src/features/models/components/add-api-key-dialog.variants.ts \
        packages/jacc/src/features/models/components/AddApiKeyDialog.tsx \
        packages/jacc/src/features/models/components/AddApiKeyDialog.test.tsx
git rm packages/jacc/src/components/dialogs/AddApiKeyDialog.tsx
git commit -m "refactor(jacc): AddApiKeyDialog 复用原子组件迁移到 features（任务 3.7）"
```

---

## 任务 3.8：重构 AddModelDialog 复用原子组件

**文件：**
- 新增：`packages/jacc/src/features/models/components/add-model-dialog.variants.ts`
- 新增：`packages/jacc/src/features/models/components/AddModelDialog.tsx`
- 新增：`packages/jacc/src/features/models/components/AddModelDialog.test.tsx`
- 删除：`packages/jacc/src/components/dialogs/AddModelDialog.tsx`

**架构：** 复用 Dialog/Input/Button。最简单的对话框。

- [ ] **步骤 1：创建 add-model-dialog.variants.ts**

与其他对话框 variants 相同结构（form + footer slots）。

- [ ] **步骤 2：创建 AddModelDialog.tsx**

参照 AddProviderDialog 模式。关键差异：
- props 含 `apiKeyId: number`
- 状态：modelName、contextSize
- 校验：modelName 必填
- 提交：`onSubmit({ api_key_id: apiKeyId, model_name: modelName, context_size: contextSize || null })`

从 `../api/models-api` 导入 `CreateModelInput` 类型。

- [ ] **步骤 3：创建 AddModelDialog.test.tsx**

覆盖：关闭不渲染、打开渲染、填表提交调用 onSubmit（含 api_key_id）、编辑模式。

- [ ] **步骤 4：删除旧文件并提交**

```bash
git add packages/jacc/src/features/models/components/add-model-dialog.variants.ts \
        packages/jacc/src/features/models/components/AddModelDialog.tsx \
        packages/jacc/src/features/models/components/AddModelDialog.test.tsx
git rm packages/jacc/src/components/dialogs/AddModelDialog.tsx
git commit -m "refactor(jacc): AddModelDialog 复用原子组件迁移到 features（任务 3.8）"
```

---
## 任务 3.9：重构 ModelSelect 组件

**文件：**
- 新增：`packages/jacc/src/features/models/components/model-select.variants.ts`
- 新增：`packages/jacc/src/features/models/components/ModelSelect.tsx`
- 新增：`packages/jacc/src/features/models/components/ModelSelect.test.tsx`
- 删除：`packages/jacc/src/components/ModelSelect.tsx`
- 删除：`packages/jacc/src/components/ModelSelect.test.tsx`

**架构：** 下拉选择器，内联样式提取到 variants。保留键盘导航（上下箭头、Enter、Escape）、搜索过滤、外部点击关闭逻辑。useAllModels 改从 features 导入。

- [ ] **步骤 1：创建 model-select.variants.ts**

提取现有内联样式到 slots：

```typescript
import { tv } from 'tailwind-variants'

export const modelSelect = tv({
  slots: {
    root: 'relative',
    trigger: 'flex items-center gap-1 px-2 py-1 border border-border rounded-[2px] text-xs bg-sidebar text-foreground hover:bg-sidebar/80',
    triggerText: '',
    triggerPlaceholder: 'text-muted',
    triggerIcon: 'text-muted shrink-0',
    dropdown: 'absolute left-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-20 min-w-[280px]',
    searchWrapper: 'p-1.5 border-b border-border',
    search: 'w-full px-2 py-1 text-xs bg-sidebar border border-border rounded-[2px] text-foreground placeholder:text-muted outline-none',
    list: 'max-h-[200px] overflow-y-auto',
    option: 'flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer',
    optionMeta: 'text-[10px] text-muted shrink-0 ml-2',
    empty: 'px-2.5 py-2 text-xs text-muted text-center',
  },
  variants: {
    highlighted: {
      true: { option: 'bg-sidebar' },
    },
    selected: {
      true: { option: 'text-primary font-medium' },
      false: { option: 'text-foreground' },
    },
  },
})
```

- [ ] **步骤 2：创建 ModelSelect.tsx**

迁移现有 ModelSelect.tsx 逻辑，将内联 className 替换为 variants slots。关键保留：
- props 接口（value、onChange）
- useAllModels 改从 `../hooks/useAllModels` 导入
- 搜索过滤、键盘导航（handleKeyDown）、外部点击关闭、打开时聚焦搜索框
- option 的 highlighted 和 selected 状态用 variants 表达
- 空结果文案改用 i18n：原代码硬编码"无匹配结果"。i18n 为扁平键结构，`general.slot.noMatch` 当前不存在，需在 `zh.json` / `en.json` 的 `general.slot.*` 区域新增（zh: "无匹配结果"，en: "No matches"），然后改用 `t('general.slot.noMatch')`

- [ ] **步骤 3：创建 ModelSelect.test.tsx**

参考原 ModelSelect.test.tsx 的测试用例迁移。mock useAllModels（从 features 路径）和 useT。覆盖：渲染触发按钮、点击展开、选择模型调用 onChange。

- [ ] **步骤 4：删除旧文件并提交**

```bash
git add packages/jacc/src/features/models/components/model-select.variants.ts \
        packages/jacc/src/features/models/components/ModelSelect.tsx \
        packages/jacc/src/features/models/components/ModelSelect.test.tsx
git rm packages/jacc/src/components/ModelSelect.tsx packages/jacc/src/components/ModelSelect.test.tsx
git commit -m "refactor(jacc): ModelSelect 迁移到 features 并 tailwind-variants 化（任务 3.9）"
```

---

## 任务 3.10：重构 InstallSkillDialog 并拆分 SkillSelectList

**文件：**
- 新增：`packages/jacc/src/features/skills/components/skill-select-list.variants.ts`
- 新增：`packages/jacc/src/features/skills/components/SkillSelectList.tsx`
- 新增：`packages/jacc/src/features/skills/components/SkillSelectList.test.tsx`
- 新增：`packages/jacc/src/features/skills/components/install-skill-dialog.variants.ts`
- 新增：`packages/jacc/src/features/skills/components/InstallSkillDialog.tsx`
- 新增：`packages/jacc/src/features/skills/components/InstallSkillDialog.test.tsx`
- 删除：`packages/jacc/src/components/dialogs/InstallSkillDialog.tsx`

**架构：** 拆分技能选择列表为独立子组件 SkillSelectList（受控组件，接收 skills + selected + onToggle）。InstallSkillDialog 复用 Dialog 外壳，保留 fetch/install 两阶段流程和错误状态展示。

- [ ] **步骤 1：创建 SkillSelectList 子组件**

创建 `skill-select-list.variants.ts`：

```typescript
import { tv } from 'tailwind-variants'

export const skillSelectList = tv({
  slots: {
    root: 'flex flex-col gap-1.5 max-h-[200px] overflow-y-auto',
    item: 'flex items-center gap-2 px-3 py-2 rounded-[4px] cursor-pointer border',
    checkbox: 'accent-success',
    name: 'text-xs font-medium text-foreground',
    description: 'text-[10px] text-muted',
  },
  variants: {
    selected: {
      true: { item: 'bg-success-light border-success/30' },
      false: { item: 'bg-sidebar border-border' },
    },
  },
})
```

创建 `SkillSelectList.tsx`（受控子组件）：

```typescript
import type { SkillInfo } from '../api/skills-api'
import { skillSelectList } from './skill-select-list.variants'

export interface SkillSelectListProps {
  skills: SkillInfo[]
  selected: Set<string>
  onToggle: (name: string) => void
}

export function SkillSelectList({ skills, selected, onToggle }: SkillSelectListProps) {
  const { root, item, checkbox, name: nameClass, description } = skillSelectList()

  return (
    <div className={root()}>
      {skills.map(skill => (
        <label key={skill.name} className={item({ selected: selected.has(skill.name) })}>
          <input
            type="checkbox"
            checked={selected.has(skill.name)}
            onChange={() => onToggle(skill.name)}
            className={checkbox()}
          />
          <div>
            <div className={nameClass()}>{skill.name}</div>
            <div className={description()}>{skill.description}</div>
          </div>
        </label>
      ))}
    </div>
  )
}
```

创建 `SkillSelectList.test.tsx`：覆盖渲染技能列表、点击 checkbox 调用 onToggle、selected 状态样式。

- [ ] **步骤 2：创建 install-skill-dialog.variants.ts**

```typescript
import { tv } from 'tailwind-variants'

export const installSkillDialog = tv({
  slots: {
    section: 'mb-4',
    label: 'text-[11px] text-muted mb-1',
    fetchRow: 'flex gap-2',
    statusBox: 'mb-4 px-3.5 py-2.5 bg-sidebar border border-border-light rounded-[4px] text-[11px] text-muted',
    errorBox: 'mb-4 px-3.5 py-2.5 bg-danger-light border border-danger/30 rounded-[4px] text-[11px] text-danger',
    selectLabel: 'text-[11px] text-muted mb-2',
    footer: 'flex justify-end gap-2',
  },
})
```

- [ ] **步骤 3：创建 InstallSkillDialog.tsx**

复用 Dialog 外壳和 SkillSelectList 子组件。保留两阶段流程：
- 第一阶段：输入 repoUrl，点击 fetch 调用 onFetch 获取 token + skills
- fetching 状态显示 cloning 提示
- error 状态显示错误框
- 第二阶段：available.length > 0 显示 SkillSelectList，选择后点击 install 调用 onConfirm
- 保留 repoUrl、fetching、available、selected、installing、token、error 状态
- toggleSkill 逻辑传给 SkillSelectList 的 onToggle
- fetch 按钮可复用 Button（variant primary，size sm），但因布局耦合（与输入框同行）可保留原生 button 或用 Button + className，自行判断

> **偏差说明（实现确认）：** fetch 按钮（与输入框同行，布局耦合）和 footer 的取消/安装按钮均保留原生 `<button>`。安装按钮使用 `bg-success` 成功配色，而 Button 原子组件仅有 primary/ghost/danger variant，无 success，故保留原生 button 维持配色一致性。这是"对话框完全复用原子组件"决策在此处的合理折扣。

从 `../api/skills-api` 导入 `GithubInstallResult`、`SkillInfo` 类型（不再在组件内重复定义 GithubInstallResult）。

props 接口保持：open、onClose、onFetch、onConfirm。

- [ ] **步骤 4：创建 InstallSkillDialog.test.tsx**

覆盖：关闭不渲染、打开渲染输入框、fetch 调用 onFetch、fetch 后显示技能列表、选择并 install 调用 onConfirm。mock useT。

- [ ] **步骤 5：删除旧文件并提交**

```bash
git add packages/jacc/src/features/skills/components/skill-select-list.variants.ts \
        packages/jacc/src/features/skills/components/SkillSelectList.tsx \
        packages/jacc/src/features/skills/components/SkillSelectList.test.tsx \
        packages/jacc/src/features/skills/components/install-skill-dialog.variants.ts \
        packages/jacc/src/features/skills/components/InstallSkillDialog.tsx \
        packages/jacc/src/features/skills/components/InstallSkillDialog.test.tsx
git rm packages/jacc/src/components/dialogs/InstallSkillDialog.tsx
git commit -m "refactor(jacc): InstallSkillDialog 拆分 SkillSelectList 迁移到 features（任务 3.10）"
```

---

## 任务 3.11：重构 SkillList 并拆分 SkillListItem

**文件：**
- 新增：`packages/jacc/src/features/skills/components/skill-list-item.variants.ts`
- 新增：`packages/jacc/src/features/skills/components/SkillListItem.tsx`
- 新增：`packages/jacc/src/features/skills/components/SkillListItem.test.tsx`
- 新增：`packages/jacc/src/features/skills/components/skill-list.variants.ts`
- 新增：`packages/jacc/src/features/skills/components/SkillList.tsx`
- 新增：`packages/jacc/src/features/skills/components/SkillList.test.tsx`
- 删除：`packages/jacc/src/components/SkillList.tsx`

**架构：** 拆分单个技能项为 SkillListItem（受控子组件，含开关切换、SourceBadge、只读标识）。SkillList 保留 tab 切换、搜索、FAB 菜单、InstallSkillDialog 集成。

- [ ] **步骤 1：创建 SkillListItem 子组件**

创建 `skill-list-item.variants.ts`，提取单个技能项的内联样式（卡片、图标、名称、描述、开关 toggle）。注意 toggle 开关的展开/收起状态用 variants（enabled true/false）表达。

创建 `SkillListItem.tsx`（受控子组件）：

```typescript
export interface SkillListItemProps {
  skill: SkillInfo
  toggling: boolean
  onToggle: (name: string, enabled: boolean) => void
}
```

保留：技能图标、名称、描述、SourceBadge（从 `@/shared/components/ui/SourceBadge` 导入）、user 来源显示只读文案、其他来源显示开关按钮。开关切换调用 onToggle。

创建 `SkillListItem.test.tsx`：覆盖渲染技能信息、点击开关调用 onToggle、user 来源显示只读。

- [ ] **步骤 2：创建 skill-list.variants.ts**

提取 SkillList 容器样式：tab 栏、tab 按钮（active 变体）、搜索框、列表容器、FAB 菜单。

- [ ] **步骤 3：创建 SkillList.tsx**

迁移现有逻辑，使用 SkillListItem 渲染每项。保留：
- props 接口（skills、loading、onToggle、onImport、onInstallFromGithub、onConfirmInstall）
- tab 状态（enabled/disabled）、搜索过滤、toggling 状态
- FAB 菜单（导入本地 / GitHub 安装）
- InstallSkillDialog 集成（从 `./InstallSkillDialog` 导入）
- Fab 从 `@/shared/components/ui/Fab` 导入
- loading 状态显示

SkillInfo 类型从 `../api/skills-api` 导入。

- [ ] **步骤 4：创建 SkillList.test.tsx**

覆盖：loading 显示、渲染技能列表、tab 切换、搜索过滤。mock useT、InstallSkillDialog、Fab。

- [ ] **步骤 5：删除旧文件并提交**

```bash
git add packages/jacc/src/features/skills/components/skill-list-item.variants.ts \
        packages/jacc/src/features/skills/components/SkillListItem.tsx \
        packages/jacc/src/features/skills/components/SkillListItem.test.tsx \
        packages/jacc/src/features/skills/components/skill-list.variants.ts \
        packages/jacc/src/features/skills/components/SkillList.tsx \
        packages/jacc/src/features/skills/components/SkillList.test.tsx
git rm packages/jacc/src/components/SkillList.tsx
git commit -m "refactor(jacc): SkillList 拆分 SkillListItem 迁移到 features（任务 3.11）"
```

---

## 任务 3.12：更新页面导入路径并最终验证

**文件：**
- 修改：`packages/jacc/src/pages/Models.tsx`
- 修改：`packages/jacc/src/pages/Skills.tsx`
- 修改：`packages/jacc/src/pages/General.tsx`
- 修改：其他引用了已迁移组件/hooks 的文件

- [ ] **步骤 1：查找所有需要更新的引用**

```bash
cd packages/jacc && grep -rl "@/components/dialogs/Add\|@/components/dialogs/Install\|@/components/SkillList\|@/components/ModelSelect" src/
```

- [ ] **步骤 2：更新导入路径**

更新所有引用到 features 路径：
- `@/components/dialogs/AddProviderDialog` → `@/features/models/components/AddProviderDialog`
- `@/components/dialogs/AddApiKeyDialog` → `@/features/models/components/AddApiKeyDialog`
- `@/components/dialogs/AddModelDialog` → `@/features/models/components/AddModelDialog`
- `@/components/dialogs/InstallSkillDialog` → `@/features/skills/components/InstallSkillDialog`
- `@/components/SkillList` → `@/features/skills/components/SkillList`
- `@/components/ModelSelect` → `@/features/models/components/ModelSelect`

- [ ] **步骤 3：验证 TypeScript 编译**

```bash
cd packages/jacc && pnpm tsc --noEmit
```

验证：无新增类型错误

- [ ] **步骤 4：运行所有测试**

```bash
cd packages/jacc && pnpm test
```

验证：所有测试通过

- [ ] **步骤 5：运行 ESLint**

```bash
cd packages/jacc && pnpm lint
```

验证：无 ESLint 错误（如有自动可修复项，运行 pnpm lint:fix 后重新提交）

- [ ] **步骤 6：清理空目录**

确认 `src/components/dialogs/` 是否已空，若空则保留（git 不跟踪空目录会自动消失）。检查 `src/hooks/` 中是否还有其他 hooks（如 usePreferences、useProjects 等不在本批次范围，应保留）。

- [ ] **步骤 7：提交变更**

```bash
git add packages/jacc/src/pages/
git commit -m "refactor(jacc): 更新页面导入路径到 features 模块（任务 3.12）"
```

---

## 验证

完成所有任务后，执行以下验证：

```bash
# 1. 运行所有测试
cd packages/jacc && pnpm test

# 2. TypeScript 编译检查
cd packages/jacc && pnpm tsc --noEmit

# 3. ESLint 检查
cd packages/jacc && pnpm lint

# 4. 启动开发服务器
cd packages/jacc && pnpm dev:jacc
```

**预期结果：**
- ✅ 所有测试通过（预计新增约 30+ 个测试）
- ✅ TypeScript 编译无新增错误
- ✅ ESLint 检查通过
- ✅ 开发服务器正常启动，Models/Skills 页面功能正常

---

## 总结

**批次 3 完成后：**
- ✅ 建立 `features/models/` 和 `features/skills/` 功能模块
- ✅ API 抽象层（models-api、skills-api）创建并被 hooks 使用
- ✅ 所有 models/skills hooks 迁移到 features 并改用 API 层
- ✅ 4 个对话框组件复用原子组件（Dialog/Input/Button）
- ✅ Input 组件扩展支持密码显示切换
- ✅ ModelSelect 迁移并 tailwind-variants 化
- ✅ InstallSkillDialog 拆分 SkillSelectList 子组件
- ✅ SkillList 拆分 SkillListItem 子组件
- ✅ 所有页面导入路径已更新

**架构改进：**
- API 层和 Hook 层分离（纯函数 + 状态管理）
- 功能模块化（features/ 按业务组织）
- 复杂组件拆分为可独立测试的子组件
- 原子组件复用最大化

**下一步：**
- 批次 4：页面组件层（Models 三层嵌套、各页面重构）





