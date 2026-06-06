# 批次 5：布局组件层 + 收尾 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `ToastProvider` 迁移到 `src/providers/`、`Layout` 迁移到 `src/shared/components/layout/`，分别引入 `tailwind-variants` 文件并补齐组件测试，清理 `src/components/` 与 `src/hooks/` 空目录，全程零功能回退。

**架构：**
- `ToastProvider`：从 `src/components/toast/ToastProvider.tsx` 迁出到 `src/providers/ToastProvider.tsx`，新增 `src/providers/toast-provider.variants.ts`（容器 / 单条 toast 的成功/错误变体 / 消息 / 关闭按钮），补齐 `ToastProvider.test.tsx`（消费 success/error/超出 provider throw/关闭按钮）。所有 9 个生产代码引用与 6 个测试 mock 路径同步迁移。
- `Layout`：从 `src/components/Layout.tsx` 迁出到 `src/shared/components/layout/Layout.tsx`，新增 `layout.variants.ts`（root / body / main 三个 slot），补齐 `Layout.test.tsx`（路由切换、未选项目时 EmptyState 占位）。`App.tsx` 同步更新导入。
- 收尾：删除空的 `src/components/`、`src/components/toast/`、`src/hooks/` 目录，确认仓库无残留 `@/components/...` 或 `@/hooks/...` 导入。

**技术栈：** React 19 + TypeScript、tailwind-variants、Tauri invoke、Vitest + Testing Library，别名 `@/` → `src/`。

---

## 文件结构

**ToastProvider 迁移（任务 5.1）：**
- 创建：`src/providers/ToastProvider.tsx` — 命名导出 `ToastProvider` + `useToast`，消费 variants
- 创建：`src/providers/toast-provider.variants.ts` — `container` / `toast`（`tone: 'success' | 'error'`） / `message` / `closeButton`
- 创建：`src/providers/ToastProvider.test.tsx` — 4 个用例
- 删除：`src/components/toast/ToastProvider.tsx`
- 修改：`src/App.tsx`、`src/shared/hooks/{useConfig,useProjects,useSlotBindings}.ts`、`src/features/skills/hooks/useSkills.ts`、`src/features/models/hooks/{useAllModels,useApiKeys,useModels,useProviders}.ts` —— 共 9 个生产 import 改为 `@/providers/ToastProvider`
- 修改：`src/features/models/components/ProviderNode.test.tsx`、`src/features/models/hooks/{useApiKeyNode,useProviderNode,useAllModels,useModels}.test.ts`、`src/shared/hooks/useSlotBindings.test.ts` —— 共 6 个 `vi.mock('@/components/toast/ToastProvider', ...)` 改为 `vi.mock('@/providers/ToastProvider', ...)`

**Layout 迁移（任务 5.2）：**
- 创建：`src/shared/components/layout/Layout.tsx` — 消费 variants，命名导出
- 创建：`src/shared/components/layout/layout.variants.ts` — `root` / `body` / `main`
- 创建：`src/shared/components/layout/Layout.test.tsx`
- 删除：`src/components/Layout.tsx`
- 修改：`src/App.tsx` — 改导入路径

**收尾清理（任务 5.3）：**
- 删除：空目录 `src/components/toast/`、`src/components/`、`src/hooks/`

**批次整体验证（任务 5.4）：**
- 运行：`pnpm --filter jacc test`、`pnpm --filter jacc lint`、`pnpm --filter jacc tsc --noEmit`、可选 `pnpm --filter jacc dev` 启动冒烟

---

### 任务 5.1：迁移 ToastProvider 到 src/providers/ 并引入 variants

**文件：**
- 创建：`packages/jacc/src/providers/toast-provider.variants.ts`
- 创建：`packages/jacc/src/providers/ToastProvider.tsx`
- 创建：`packages/jacc/src/providers/ToastProvider.test.tsx`
- 删除：`packages/jacc/src/components/toast/ToastProvider.tsx`
- 修改（9 个生产）：`src/App.tsx`、`src/shared/hooks/{useConfig,useProjects,useSlotBindings}.ts`、`src/features/skills/hooks/useSkills.ts`、`src/features/models/hooks/{useAllModels,useApiKeys,useModels,useProviders}.ts`
- 修改（6 个测试 mock）：`src/features/models/components/ProviderNode.test.tsx`、`src/features/models/hooks/{useApiKeyNode,useProviderNode,useAllModels,useModels}.test.ts`、`src/shared/hooks/useSlotBindings.test.ts`

- [ ] **步骤 1：编写失败的 ToastProvider 测试**

写入 `packages/jacc/src/providers/ToastProvider.test.tsx`：

```tsx
import { act, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './ToastProvider'

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

describe('toastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders success toast and auto-dismisses after 2s', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => {
      result.current.success('saved')
    })
    expect(screen.getByText('saved')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('saved')).toBeNull()
  })

  it('renders error toast and auto-dismisses after 4s', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => {
      result.current.error('boom')
    })
    expect(screen.getByText('boom')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('boom')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('boom')).toBeNull()
  })

  it('close button removes toast immediately', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => {
      result.current.success('hello')
    })
    const closeBtn = screen.getByRole('button')
    act(() => {
      closeBtn.click()
    })
    expect(screen.queryByText('hello')).toBeNull()
  })

  it('throws when useToast called outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useToast())).toThrow(/useToast must be used within ToastProvider/)
    spy.mockRestore()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc && pnpm exec vitest run src/providers/ToastProvider.test.tsx`
预期：FAIL，报错 `Failed to resolve import "./ToastProvider"`

- [ ] **步骤 3：创建 toast-provider.variants.ts**

写入 `packages/jacc/src/providers/toast-provider.variants.ts`：

```ts
import { tv } from 'tailwind-variants'

export const toastProvider = tv({
  slots: {
    container: 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[360px]',
    toast: 'flex items-center gap-2 px-3 py-2 rounded-[4px] text-xs shadow-md border animate-in slide-in-from-right',
    message: 'flex-1 break-all',
    closeButton: 'shrink-0 opacity-60 hover:opacity-100 text-[10px]',
  },
  variants: {
    tone: {
      success: { toast: 'bg-success-light border-success/30 text-success' },
      error: { toast: 'bg-danger-light border-danger/30 text-danger' },
    },
  },
  defaultVariants: { tone: 'success' },
})
```

- [ ] **步骤 4：创建 ToastProvider.tsx（消费 variants，零行为变化）**

写入 `packages/jacc/src/providers/ToastProvider.tsx`：

```tsx
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { toastProvider } from './toast-provider.variants'

interface ToastItem {
  id: number
  type: 'success' | 'error'
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx)
    throw new Error('useToast must be used within ToastProvider')
  return ctx
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const { container, toast, message, closeButton } = toastProvider()

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const add = useCallback(
    (type: ToastItem['type'], msg: string) => {
      const id = nextId++
      setToasts(prev => [...prev, { id, type, message: msg }])
      const duration = type === 'error' ? 4000 : 2000
      timers.current.set(id, setTimeout(remove, duration, id))
    },
    [remove],
  )

  const success = useCallback((msg: string) => add('success', msg), [add])
  const error = useCallback((msg: string) => add('error', msg), [add])

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className={container()}>
        {toasts.map(t => (
          <div key={t.id} className={toast({ tone: t.type })}>
            <span className={message()}>{t.message}</span>
            <button onClick={() => remove(t.id)} className={closeButton()}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`cd packages/jacc && pnpm exec vitest run src/providers/ToastProvider.test.tsx`
预期：PASS（4 个用例全部通过）

- [ ] **步骤 6：批量更新 9 个生产 import 路径**

逐个把 `from '@/components/toast/ToastProvider'` 改为 `from '@/providers/ToastProvider'`：

```
src/App.tsx:4
src/shared/hooks/useConfig.ts:3
src/shared/hooks/useProjects.ts:3
src/shared/hooks/useSlotBindings.ts:4
src/features/skills/hooks/useSkills.ts:3
src/features/models/hooks/useAllModels.ts:3
src/features/models/hooks/useApiKeys.ts:3
src/features/models/hooks/useModels.ts:3
src/features/models/hooks/useProviders.ts:3
```

- [ ] **步骤 7：批量更新 6 个测试文件中的 vi.mock 路径**

逐个把 `vi.mock('@/components/toast/ToastProvider', ...)` 改为 `vi.mock('@/providers/ToastProvider', ...)`：

```
src/features/models/components/ProviderNode.test.tsx
src/features/models/hooks/useAllModels.test.ts
src/features/models/hooks/useApiKeyNode.test.ts
src/features/models/hooks/useModels.test.ts
src/features/models/hooks/useProviderNode.test.ts
src/shared/hooks/useSlotBindings.test.ts
```

- [ ] **步骤 8：删除旧文件并确认无残留引用**

```bash
cd packages/jacc
git rm src/components/toast/ToastProvider.tsx
```

运行：`cd packages/jacc && grep -rn "@/components/toast" src/ 2>&1 || true`
预期：无任何输出

- [ ] **步骤 9：运行整套测试与类型检查**

运行：`cd packages/jacc && pnpm exec vitest run && pnpm exec tsc --noEmit`
预期：所有测试通过（≥224），tsc 零错误

- [ ] **步骤 10：Commit**

```bash
cd packages/jacc
git add src/providers src/App.tsx src/shared/hooks src/features
git commit -m "refactor(jacc): 迁移 ToastProvider 到 providers/ 并引入 variants（任务 5.1）"
```

---

### 任务 5.2：迁移 Layout 到 shared/components/layout/ 并引入 variants

**文件：**
- 创建：`packages/jacc/src/shared/components/layout/layout.variants.ts`
- 创建：`packages/jacc/src/shared/components/layout/Layout.tsx`
- 创建：`packages/jacc/src/shared/components/layout/Layout.test.tsx`
- 删除：`packages/jacc/src/components/Layout.tsx`
- 修改：`packages/jacc/src/App.tsx`

- [ ] **步骤 1：编写失败的 Layout 测试**

写入 `packages/jacc/src/shared/components/layout/Layout.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'

const setProject = vi.fn()
const addProject = vi.fn()
const openProject = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))

const storeState = { currentPage: 'general' as string, currentProject: null as string | null, setProject }
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => storeState }))

vi.mock('@/shared/hooks/useProjects', () => ({
  useProjects: () => ({ add: addProject, open: openProject }),
}))

vi.mock('@/shared/components/layout/Sidebar', () => ({ Sidebar: () => <div>SIDEBAR</div> }))
vi.mock('@/shared/components/layout/TitleBar', () => ({ TitleBar: () => <div>TITLEBAR</div> }))
vi.mock('@/shared/components/ui/EmptyState', () => ({
  EmptyState: () => <div>EMPTY_STATE</div>,
}))

vi.mock('@/pages/General', () => ({ General: () => <div>GENERAL_PAGE</div> }))
vi.mock('@/pages/EnvVars', () => ({ EnvVars: () => <div>ENVVARS_PAGE</div> }))
vi.mock('@/pages/Permissions', () => ({ Permissions: () => <div>PERMISSIONS_PAGE</div> }))
vi.mock('@/pages/McpServers', () => ({ McpServers: () => <div>MCP_PAGE</div> }))
vi.mock('@/pages/Models', () => ({ Models: () => <div>MODELS_PAGE</div> }))
vi.mock('@/pages/Skills', () => ({ Skills: () => <div>SKILLS_PAGE</div> }))
vi.mock('@/pages/Agents', () => ({ Agents: () => <div>AGENTS_PAGE</div> }))

describe('layout', () => {
  it('renders title bar and sidebar', () => {
    storeState.currentPage = 'general'
    storeState.currentProject = null
    render(<Layout />)
    expect(screen.getByText('TITLEBAR')).toBeTruthy()
    expect(screen.getByText('SIDEBAR')).toBeTruthy()
    expect(screen.getByText('GENERAL_PAGE')).toBeTruthy()
  })

  it('renders Models page when currentPage is models', () => {
    storeState.currentPage = 'models'
    storeState.currentProject = null
    render(<Layout />)
    expect(screen.getByText('MODELS_PAGE')).toBeTruthy()
  })

  it('renders EmptyState when skills page lacks current project', () => {
    storeState.currentPage = 'skills'
    storeState.currentProject = null
    render(<Layout />)
    expect(screen.getByText('EMPTY_STATE')).toBeTruthy()
    expect(screen.queryByText('SKILLS_PAGE')).toBeNull()
  })

  it('renders Skills page when project is selected', () => {
    storeState.currentPage = 'skills'
    storeState.currentProject = '/path/proj'
    render(<Layout />)
    expect(screen.getByText('SKILLS_PAGE')).toBeTruthy()
  })

  it('renders EmptyState when agents page lacks current project', () => {
    storeState.currentPage = 'agents'
    storeState.currentProject = null
    render(<Layout />)
    expect(screen.getByText('EMPTY_STATE')).toBeTruthy()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc && pnpm exec vitest run src/shared/components/layout/Layout.test.tsx`
预期：FAIL，报错 `Failed to resolve import "./Layout"`

- [ ] **步骤 3：创建 layout.variants.ts**

写入 `packages/jacc/src/shared/components/layout/layout.variants.ts`：

```ts
import { tv } from 'tailwind-variants'

export const layout = tv({
  slots: {
    root: 'h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden',
    body: 'flex flex-1 overflow-hidden',
    main: 'flex-1 overflow-y-auto relative',
  },
})
```

- [ ] **步骤 4：用 git mv 迁移 Layout.tsx 到 shared/components/layout/**

```bash
cd packages/jacc
git mv src/components/Layout.tsx src/shared/components/layout/Layout.tsx
```

预期：文件出现在新位置，git 历史保留

- [ ] **步骤 5：改造 Layout.tsx 消费 variants**

编辑 `packages/jacc/src/shared/components/layout/Layout.tsx`，把内联类名替换为 variants：

```tsx
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useEffect } from 'react'
import { Agents } from '@/pages/Agents'
import { EnvVars } from '@/pages/EnvVars'
import { General } from '@/pages/General'
import { McpServers } from '@/pages/McpServers'
import { Models } from '@/pages/Models'
import { Permissions } from '@/pages/Permissions'
import { Skills } from '@/pages/Skills'
import { Sidebar } from '@/shared/components/layout/Sidebar'
import { TitleBar } from '@/shared/components/layout/TitleBar'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { useProjects } from '@/shared/hooks/useProjects'
import { useAppStore } from '@/stores/useAppStore'
import { layout } from './layout.variants'

export function Layout() {
  const { currentPage, currentProject, setProject } = useAppStore()
  const { add, open: openProject } = useProjects()
  const { root, body, main } = layout()

  useEffect(() => {
    invoke('set_active_project', { path: currentProject ?? null }).catch(() => {})
  }, [currentProject])

  async function handleSelectProject() {
    const selected = await open({ directory: true })
    if (selected) {
      await add(selected)
      await openProject(selected)
      setProject(selected)
    }
  }

  function renderPage() {
    switch (currentPage) {
      case 'general':
        return <General />
      case 'envvars':
        return <EnvVars />
      case 'permissions':
        return <Permissions />
      case 'mcp':
        return <McpServers />
      case 'models':
        return <Models />
      case 'skills':
        if (!currentProject)
          return <EmptyState onSelectProject={handleSelectProject} />
        return <Skills />
      case 'agents':
        if (!currentProject)
          return <EmptyState onSelectProject={handleSelectProject} />
        return <Agents />
      default:
        return null
    }
  }

  return (
    <div className={root()}>
      <TitleBar />
      <div className={body()}>
        <Sidebar />
        <main className={main()}>{renderPage()}</main>
      </div>
    </div>
  )
}
```

- [ ] **步骤 6：更新 App.tsx 中的 Layout 导入**

修改 `packages/jacc/src/App.tsx` 第 3 行：

```tsx
import { Layout } from '@/shared/components/layout/Layout'
```

（替换原来的 `import { Layout } from '@/components/Layout'`）

- [ ] **步骤 7：运行 Layout 测试与全量验证**

运行：`cd packages/jacc && pnpm exec vitest run src/shared/components/layout/Layout.test.tsx`
预期：5 个用例全部 PASS

运行：`cd packages/jacc && pnpm exec vitest run && pnpm exec tsc --noEmit`
预期：所有测试通过，tsc 零错误

- [ ] **步骤 8：Commit**

```bash
cd packages/jacc
git add src/App.tsx src/shared/components/layout
git commit -m "refactor(jacc): 迁移 Layout 到 shared/components/layout/ 并引入 variants（任务 5.2）"
```

---

### 任务 5.3：清理空目录与残留路径

**文件：**
- 删除：空目录 `packages/jacc/src/components/toast/`、`packages/jacc/src/components/`、`packages/jacc/src/hooks/`

- [ ] **步骤 1：确认 src/components/ 已无文件**

运行：`cd packages/jacc && find src/components src/hooks -type f 2>&1 || true`
预期：无输出（或目录不存在）

- [ ] **步骤 2：删除空目录**

```bash
cd packages/jacc
rmdir src/components/toast src/components src/hooks 2>/dev/null || true
```

预期：三个目录从工作区消失（git 不追踪空目录，无需 git rm）

- [ ] **步骤 3：全局确认无 @/components/* 与 @/hooks/* 残留导入**

运行：`cd packages/jacc && grep -rn "from ['\"]@/components/\|from ['\"]@/hooks/" src/ 2>&1 || true`
预期：无任何输出

- [ ] **步骤 4：运行 lint 与 tsc**

运行：`cd packages/jacc && pnpm exec tsc --noEmit && pnpm exec eslint src --max-warnings=0`
预期：tsc 零错误，eslint 零警告

- [ ] **步骤 5：Commit（若 git status 有变化）**

```bash
cd packages/jacc
git status --short
# 若仅是空目录消失（git 本身不追踪空目录），可跳过此 commit
# 若有遗漏文件被本步骤捕获修改，则：
git add -A && git commit -m "chore(jacc): 清理 components/ 与 hooks/ 空目录（任务 5.3）"
```

---

### 任务 5.4：批次整体验证

**目标：** 在合入前完整跑通测试 / 类型检查 / lint，确认应用可启动且无回退。

- [ ] **步骤 1：运行整套测试**

运行：`cd packages/jacc && pnpm exec vitest run`
预期：所有测试 PASS（应在原 224 基础上 +9：ToastProvider 4 + Layout 5 = 233+），无失败

- [ ] **步骤 2：运行类型检查**

运行：`cd packages/jacc && pnpm exec tsc --noEmit`
预期：无任何错误输出

- [ ] **步骤 3：运行 lint**

运行：`cd packages/jacc && pnpm exec eslint src --max-warnings=0`
预期：无警告

- [ ] **步骤 4：确认 App.tsx 与目录结构干净**

运行：`cd packages/jacc && grep -rn "@/components/\|@/hooks/" src/ 2>&1 || true`
预期：无输出

运行：`cd packages/jacc && ls src/providers src/shared/components/layout`
预期：
```
src/providers:
ToastProvider.test.tsx  ToastProvider.tsx  toast-provider.variants.ts

src/shared/components/layout:
Layout.test.tsx  Layout.tsx  layout.variants.ts
Sidebar.test.tsx  Sidebar.tsx  sidebar.variants.ts
TitleBar.test.tsx  TitleBar.tsx  title-bar.variants.ts
```

- [ ] **步骤 5：可选 — 启动 dev server 冒烟测试**

运行：`cd packages/jacc && pnpm dev`（端口 5172）
人工确认：
- 窗口正常出现，主题与 i18n 与上次一致
- 切换 General / EnvVars / Permissions / McpServers / Models 各页可见
- 触发任意写入操作（如修改 effortLevel），右下角 toast 正常弹出 2s 后消失

按 Ctrl+C 退出 dev server。

- [ ] **步骤 6：标记计划为已完成**

```bash
cd D:/Project/jackit
git mv docs/superpowers/plans/2026-06-06-jacc-plan5-layout-finishing.md \
       docs/superpowers/plans/2026-06-06-done-jacc-plan5-layout-finishing.md
git commit -m "docs(jacc): 标记 Plan5 完成（布局组件层 + 收尾）"
```
