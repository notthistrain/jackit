# Plan5 收尾补全（对照设计规格审计差距修复）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development 逐任务实现。步骤使用复选框（`- [ ]`）跟踪进度。

**目标：** 修复对照 `2026-05-31-jacc-frontend-refactor-design.md` 完整审计发现的全部差距（C1/C2/C3 + I1-I5 + M3），使 Plan 整体的"全局验证标准"7 项与"5 项核心目标"全部达成并有量化证据。

**架构：**
- 测试基建：装 `@vitest/coverage-v8`，vite.config.ts 加 coverage 配置，跑出 >80% 报告。
- App 收口：`App.tsx` 改命名导出、补 `App.test.tsx`（主题切换 DOM 副作用 + 偏好回填）、补 `useAppStore.test.ts`。
- 一致性补丁：2 处 Props 接口加 `export`；6 个 `features/*/index.ts` barrel（含新建 `features/agents/`）。
- General 拆分：抽 `SlotRow` / `ToggleRow` / `SelectRow` 三个子组件到 `features/general/components/`，General.tsx 降到 ≤100 行。
- e2e：集成级全流程测试 `App.e2e.test.tsx`，用 `@tauri-apps/api/mocks` 的 `mockIPC` 驱动真实 App 树跑"项目切换→页面切换→写配置→toast"链路。

**技术栈：** React 19 + TypeScript、tailwind-variants、Vitest3 + Testing Library、`@tauri-apps/api/mocks` mockIPC，别名 `@/` → `src/`。

---

## 文件结构

**任务 A1（C1 覆盖率基建）：**
- 修改：`packages/jacc/package.json`（+ `@vitest/coverage-v8` devDep，+ `test:coverage` script）
- 修改：`packages/jacc/vite.config.ts`（test.coverage 配置）

**任务 A2（I1 + C3 + M3 App 收口）：**
- 修改：`src/App.tsx`（default → named export）
- 修改：`src/main.tsx`（`import { App }`）
- 创建：`src/App.test.tsx`
- 创建：`src/stores/useAppStore.test.ts`

**任务 A3（I5 Props 导出）：**
- 修改：`src/features/models/components/ModelSelect.tsx:8`
- 修改：`src/features/skills/components/SkillList.tsx:13`

**任务 A4（I3 + I2 barrel + agents 模块）：**
- 创建：`src/features/{models,skills,mcp-servers,permissions,env-vars,agents}/index.ts`
- 创建：`src/features/agents/{components,hooks,api}/.gitkeep`（占位）

**任务 A5（I4 General 拆分）：**
- 创建：`src/features/general/components/{SlotRow,ToggleRow,SelectRow}.tsx` + 各 `.variants.ts` + 各 `.test.tsx`
- 创建：`src/features/general/index.ts`
- 修改：`src/pages/General.tsx`（≤100 行）

**任务 A6（C2 集成 e2e）：**
- 创建：`src/App.e2e.test.tsx`

**任务 A7（文档收尾）：**
- 修改：`docs/superpowers/plans/2026-06-06-done-jacc-plan5-layout-finishing.md`（追加"Plan 整体收尾验证"小节）

---

### 任务 A1：安装并配置测试覆盖率

**文件：**
- 修改：`packages/jacc/package.json`
- 修改：`packages/jacc/vite.config.ts`

- [ ] **步骤 1：安装 coverage provider**

```bash
cd packages/jacc
pnpm add -D @vitest/coverage-v8@^3
```

预期：package.json devDependencies 出现该项（版本对齐 catalog vitest ^3）。

- [ ] **步骤 2：在 vite.config.ts 的 test 块加 coverage 配置**

把 `test` 块改为：

```ts
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.e2e.test.{ts,tsx}',
        'main.tsx',
        'i18n/**',
        'styles/**',
        '**/*.variants.ts',
      ],
    },
  },
```

（注意：root 已是 src，故 include/exclude 用相对 src 的 glob，不带 `src/` 前缀。）

- [ ] **步骤 3：加 test:coverage script**

package.json scripts 加一行：`"test:coverage": "vitest run --coverage"`

- [ ] **步骤 4：运行覆盖率报告**

运行：`cd packages/jacc && pnpm exec vitest run --coverage`
预期：所有测试通过，末尾打印覆盖率表，组件代码（components/）行覆盖率 > 80%。记录 Statements/Lines 总百分比。

如果总行覆盖率 < 80%，以 DONE_WITH_CONCERNS 报告并附上未覆盖最多的文件清单，不要为凑数硬塞测试。

- [ ] **步骤 5：Commit**

```bash
cd packages/jacc
git add package.json vite.config.ts ../../pnpm-lock.yaml
git commit -m "test(jacc): 接入 vitest coverage-v8 并配置覆盖率门槛（审计 C1）"
```

---

### 任务 A2：App.tsx 命名导出 + 主题切换/store 测试

**文件：**
- 修改：`src/App.tsx`、`src/main.tsx`
- 创建：`src/App.test.tsx`、`src/stores/useAppStore.test.ts`

- [ ] **步骤 1：编写失败的 useAppStore 测试**

写入 `packages/jacc/src/stores/useAppStore.test.ts`：

```ts
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './useAppStore'

describe('useAppStore', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.setState({ currentPage: 'general', currentProject: null, theme: 'system' })
    })
  })

  it('setTheme updates theme', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setTheme('dark'))
    expect(result.current.theme).toBe('dark')
  })

  it('setPage updates currentPage', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setPage('models'))
    expect(result.current.currentPage).toBe('models')
  })

  it('setProject updates currentProject', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setProject('/p'))
    expect(result.current.currentProject).toBe('/p')
  })
})
```

- [ ] **步骤 2：编写失败的 App 测试**

写入 `packages/jacc/src/App.test.tsx`：

```tsx
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getPref = vi.fn()
const setTheme = vi.fn()
const setLocale = vi.fn()
const storeState = { theme: 'system' as string, setTheme }

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ show: vi.fn() }),
}))
vi.mock('@/providers/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/shared/components/layout/Layout', () => ({ Layout: () => <div>LAYOUT</div> }))
vi.mock('@/shared/hooks/usePreferences', () => ({ usePreferences: () => ({ get: getPref }) }))
vi.mock('@/i18n', () => ({ useT: () => ({ setLocale }) }))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => storeState }))

async function importApp() {
  const mod = await import('./App')
  return mod.App
}

describe('app', () => {
  beforeEach(() => {
    getPref.mockResolvedValue(undefined)
    storeState.theme = 'system'
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('removes data-theme attribute when theme is system', async () => {
    storeState.theme = 'system'
    const App = await importApp()
    render(<App />)
    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    })
  })

  it('sets data-theme attribute when theme is dark', async () => {
    storeState.theme = 'dark'
    const App = await importApp()
    render(<App />)
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })

  it('hydrates saved theme preference into store on mount', async () => {
    getPref.mockImplementation((key: string) =>
      Promise.resolve(key === 'theme' ? 'dark' : undefined))
    const App = await importApp()
    render(<App />)
    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith('dark')
    })
  })

  it('hydrates saved locale preference into i18n on mount', async () => {
    getPref.mockImplementation((key: string) =>
      Promise.resolve(key === 'locale' ? 'en' : undefined))
    const App = await importApp()
    render(<App />)
    await waitFor(() => {
      expect(setLocale).toHaveBeenCalledWith('en')
    })
  })
})
```

说明：`importApp()` 动态导入是为了配合命名导出（步骤 4 之后才生效），步骤 3 先跑红。

- [ ] **步骤 3：运行测试验证失败**

运行：`cd packages/jacc && pnpm exec vitest run src/App.test.tsx src/stores/useAppStore.test.ts`
预期：App.test FAIL（`mod.App` 为 undefined，因为当前是 default export）；useAppStore.test 应已 PASS（store 本身没改）。

- [ ] **步骤 4：App.tsx 改命名导出**

修改 `src/App.tsx` 第 9 行：`export default function App()` → `export function App()`（函数体不变，保留现有 import 顺序与三个 useEffect）。

- [ ] **步骤 5：更新 main.tsx 导入**

修改 `src/main.tsx` 第 3 行：`import App from './App'` → `import { App } from './App'`。

- [ ] **步骤 6：运行测试验证通过**

运行：`cd packages/jacc && pnpm exec vitest run src/App.test.tsx src/stores/useAppStore.test.ts`
预期：两个测试文件全部 PASS（App 4 + store 3 = 7 用例）。

- [ ] **步骤 7：全量验证**

运行：`cd packages/jacc && pnpm exec vitest run && pnpm exec tsc --noEmit && pnpm exec eslint src --max-warnings=0`
预期：全部通过；tsc/eslint 零问题。

- [ ] **步骤 8：Commit**

```bash
cd packages/jacc
git add src/App.tsx src/main.tsx src/App.test.tsx src/stores/useAppStore.test.ts
git commit -m "refactor(jacc): App 改命名导出并补主题切换/store 测试（审计 I1/C3/M3）"
```

---

### 任务 A3：导出遗漏的 Props 接口

**文件：**
- 修改：`src/features/models/components/ModelSelect.tsx:8`
- 修改：`src/features/skills/components/SkillList.tsx:13`

- [ ] **步骤 1：ModelSelect Props 加 export**

把 `src/features/models/components/ModelSelect.tsx` 第 8 行 `interface ModelSelectProps {` 改为 `export interface ModelSelectProps {`。

- [ ] **步骤 2：SkillList Props 加 export**

把 `src/features/skills/components/SkillList.tsx` 第 13 行 `interface SkillListProps {` 改为 `export interface SkillListProps {`。

- [ ] **步骤 3：验证无遗漏**

运行：`cd packages/jacc && grep -rn "^interface.*Props" src --include="*.tsx" 2>&1 || true`
预期：无输出（所有 Props 接口均已 export）。

- [ ] **步骤 4：全量验证**

运行：`cd packages/jacc && pnpm exec tsc --noEmit && pnpm exec eslint src --max-warnings=0`
预期：零问题。

- [ ] **步骤 5：Commit**

```bash
cd packages/jacc
git add src/features/models/components/ModelSelect.tsx src/features/skills/components/SkillList.tsx
git commit -m "refactor(jacc): 导出 ModelSelect/SkillList 的 Props 接口（审计 I5）"
```

---

### 任务 A4：建立 features barrel 出口 + agents 占位模块

**文件：**
- 创建：6 个 `src/features/*/index.ts`
- 创建：`src/features/agents/{components,hooks,api}/.gitkeep`

- [ ] **步骤 1：建 agents 占位目录**

```bash
cd packages/jacc
mkdir -p src/features/agents/components src/features/agents/hooks src/features/agents/api
touch src/features/agents/components/.gitkeep src/features/agents/hooks/.gitkeep src/features/agents/api/.gitkeep
```

- [ ] **步骤 2：列出各模块对外有意义的导出**

运行：`cd packages/jacc && ls src/features/models/components src/features/models/hooks src/features/models/api src/features/skills/components src/features/skills/hooks src/features/skills/api src/features/mcp-servers/components src/features/mcp-servers/hooks src/features/mcp-servers/api src/features/permissions/components src/features/permissions/hooks src/features/permissions/api src/features/env-vars/components src/features/env-vars/hooks src/features/env-vars/api`

根据列出的文件，为每个模块写 barrel。barrel 只重导出页面/Layout 真正会用到的对外组件与 hook（被页面 import 的那些），不导出纯内部子组件。下面给出基于当前代码的 barrel 内容。

- [ ] **步骤 3：写 models barrel**

写入 `src/features/models/index.ts`：

```ts
export { ApiKeyNode } from './components/ApiKeyNode'
export type { ApiKeyNodeProps } from './components/ApiKeyNode'
export { ModelSelect } from './components/ModelSelect'
export type { ModelSelectProps } from './components/ModelSelect'
export { ProviderNode } from './components/ProviderNode'
export type { ProviderNodeProps } from './components/ProviderNode'
export { useAllModels } from './hooks/useAllModels'
export { useProviders } from './hooks/useProviders'
```

（注意：若某个具名导出/类型在源文件中不存在，去 `src/features/models/components/*.tsx` 与 `hooks/*.ts` 核对真实导出名后调整。绝不导出不存在的符号——会 tsc 报错。）

- [ ] **步骤 4：写 skills barrel**

写入 `src/features/skills/index.ts`：

```ts
export { SkillList } from './components/SkillList'
export type { SkillListProps } from './components/SkillList'
export { useSkills } from './hooks/useSkills'
```

- [ ] **步骤 5：写 mcp-servers barrel**

先 `cat src/pages/McpServers.tsx` 看页面从该模块 import 了什么，据此写入 `src/features/mcp-servers/index.ts`，导出页面用到的组件与 hook（例如 `useMcpServers`、`McpServerItem`、`AddMcpServerForm`）。逐一核对源文件具名导出后再写。

- [ ] **步骤 6：写 permissions barrel**

同理 `cat src/pages/Permissions.tsx`，写入 `src/features/permissions/index.ts`，导出页面用到的（例如 `usePermissions`、`PermissionTable`、`AddPermissionForm`）。核对真实导出名。

- [ ] **步骤 7：写 env-vars barrel**

同理 `cat src/pages/EnvVars.tsx`，写入 `src/features/env-vars/index.ts`，导出页面用到的（例如 `useEnvVars`、`EnvVarRow`、`AddEnvVarForm`）。核对真实导出名。

- [ ] **步骤 8：写 agents barrel**

写入 `src/features/agents/index.ts`：

```ts
// agents 模块在当前阶段仅占位，结构先行，实现待后续批次
export {}
```

- [ ] **步骤 9：tsc 验证 barrel 无悬空导出**

运行：`cd packages/jacc && pnpm exec tsc --noEmit`
预期：零错误（若报"模块无导出成员 X"，回到对应 barrel 删除/改名该行）。

- [ ] **步骤 10：全量验证**

运行：`cd packages/jacc && pnpm exec vitest run && pnpm exec eslint src --max-warnings=0`
预期：全部通过，零警告。

- [ ] **步骤 11：Commit**

```bash
cd packages/jacc
git add src/features
git commit -m "refactor(jacc): 建立 features 模块公共出口与 agents 占位模块（审计 I2/I3）"
```

---

### 任务 A5：拆分 General.tsx 为子组件

**文件：**
- 创建：`src/features/general/components/SlotRow.tsx` + `slot-row.variants.ts` + `SlotRow.test.tsx`
- 创建：`src/features/general/components/ToggleRow.tsx` + `toggle-row.variants.ts` + `ToggleRow.test.tsx`
- 创建：`src/features/general/components/SelectRow.tsx` + `select-row.variants.ts` + `SelectRow.test.tsx`
- 创建：`src/features/general/index.ts`
- 修改：`src/pages/General.tsx`

> **实现者注意：** 这是本计划中唯一需要设计判断的任务。先完整读 `src/pages/General.tsx`（260 行）理解四块结构：(1) 模型槽位列表 SLOTS.map、(2) effortLevel 下拉、(3) skipDangerous 开关、(4) 语言下拉。把 (1) 的单行抽成 `SlotRow`（props: slot/label/isCurrent/binding/contextValue/contextOptions/isBound/driftItems/onModelChange/onContextChange/onApply/modelString/t/children for ModelSelect 注入），(3) 抽成通用 `ToggleRow`（label/desc/checked/onToggle/badge），(2)(4) 抽成通用 `SelectRow`（label/desc/value/options/onChange/badge）。组件保持纯展示，t 由 props 传入或内部 useT 二选一，与现有 features 组件保持一致（参考 PermissionTable 接收 t 的模式）。每个子组件配 variants 文件并写组件测试（渲染 + 关键交互回调）。General.tsx 重构为编排这三个子组件，目标 ≤100 行。

- [ ] **步骤 1：读现状，写 SlotRow 失败测试**

先 `cat src/pages/General.tsx` 与 `cat src/features/permissions/components/PermissionTable.tsx`（参考 t-props 模式）。然后写 `src/features/general/components/SlotRow.test.tsx`，覆盖：渲染 slot label、isCurrent 时显示当前徽标、drift 时显示漂移提示、点击 apply 调 onApply、切换 context 调 onContextChange。测试用 vi.fn 注入回调，ModelSelect 用 `vi.mock('@/features/models', ...)` 或通过 children 注入避免拉真实下拉。

- [ ] **步骤 2：跑红**

运行：`cd packages/jacc && pnpm exec vitest run src/features/general/components/SlotRow.test.tsx`
预期：FAIL（`./SlotRow` 不存在）。

- [ ] **步骤 3：实现 slot-row.variants.ts + SlotRow.tsx**

从 General.tsx 第 113-184 行的 slot 渲染块提取内联类到 `slot-row.variants.ts`（root 含 isCurrent 变体、badge、driftBadge、contextSelect 含 disabled 变体、applyButton、modelString 等 slots），SlotRow.tsx 消费之，保持原视觉与交互。ModelSelect 通过 props children 或直接 import `@/features/models` 注入。

- [ ] **步骤 4：跑绿 SlotRow**

运行：`cd packages/jacc && pnpm exec vitest run src/features/general/components/SlotRow.test.tsx`
预期：PASS。

- [ ] **步骤 5：ToggleRow（TDD：先测后实现）**

写 `ToggleRow.test.tsx`（渲染 label/desc、checked 反映开关态、点击调 onToggle、有 badge 时渲染），跑红；再写 `toggle-row.variants.ts`（从 General 第 213-238 行 skipDangerous 开关块提取，含 track 的 on/off 变体与 knob 位置变体）+ `ToggleRow.tsx`，跑绿。

- [ ] **步骤 6：SelectRow（TDD：先测后实现）**

写 `SelectRow.test.tsx`（渲染 label/desc、options、change 调 onChange、有 badge 时渲染），跑红；再写 `select-row.variants.ts`（从 General 第 190-210/240-256 行的下拉块提取）+ `SelectRow.tsx`，跑绿。effortLevel 和语言两个下拉都用它。

- [ ] **步骤 7：写 general barrel**

写入 `src/features/general/index.ts`：

```ts
export { SelectRow } from './components/SelectRow'
export type { SelectRowProps } from './components/SelectRow'
export { SlotRow } from './components/SlotRow'
export type { SlotRowProps } from './components/SlotRow'
export { ToggleRow } from './components/ToggleRow'
export type { ToggleRowProps } from './components/ToggleRow'
```

- [ ] **步骤 8：重构 General.tsx 使用三个子组件**

保留 General.tsx 的 hooks（useT/useConfig/useSlotBindings/usePreferences）、派生逻辑（currentSlot/slotContexts/getBinding/handleSlotModelChange/handleApply/handleLocaleChange/getModelString/driftItems 计算）与 loading 守卫；把 JSX 三块替换为 `<SlotRow>` map、`<SelectRow>`（effortLevel）、`<ToggleRow>`（skipDangerous）、`<SelectRow>`（语言）。目标文件 ≤100 行，JSX 主体显著缩短。

- [ ] **步骤 9：跑绿 + 行数检查**

运行：`cd packages/jacc && pnpm exec vitest run && wc -l src/pages/General.tsx`
预期：全部测试通过；General.tsx ≤100 行。若仍 >100，把派生计算（driftItems、modelString）提到小 helper 或 useGeneral hook 再压缩。

- [ ] **步骤 10：全量验证**

运行：`cd packages/jacc && pnpm exec tsc --noEmit && pnpm exec eslint src --max-warnings=0 && pnpm exec vitest run --coverage`
预期：零错误零警告；覆盖率维持 >80%。

- [ ] **步骤 11：Commit**

```bash
cd packages/jacc
git add src/features/general src/pages/General.tsx
git commit -m "refactor(jacc): 拆分 General 为 SlotRow/ToggleRow/SelectRow 子组件（审计 I4）"
```

---

### 任务 A6：集成级端到端测试

**文件：**
- 创建：`src/App.e2e.test.tsx`

> **目的：** 兑现设计文档批次 5"端到端测试（完整用户流程）"。用 `@tauri-apps/api/mocks` 的 `mockIPC` 在 jsdom 中挂载真实 App 树（不 mock 内部组件/hook，只 mock IPC 与 window/dialog 边界），跑一条贴近真实的用户流程。

- [ ] **步骤 1：确认 mockIPC 可用并理解后端命令**

运行：`cd packages/jacc && cat src/shared/hooks/useConfig.ts && cat src/shared/hooks/usePreferences.ts | head -40`
理解页面初始化会 invoke 哪些命令（如 `read_merged_config` / `get_preference` / `set_active_project` 等），e2e 里要为这些命令在 mockIPC 提供合理返回，避免未处理命令导致 reject。

- [ ] **步骤 2：编写 e2e 测试**

写入 `packages/jacc/src/App.e2e.test.tsx`，结构示例（实现者按真实命令名调整 mockIPC 分支）：

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/i18n'
import { App } from './App'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ show: vi.fn() }),
}))

beforeEach(() => {
  // 为页面初始化用到的命令提供返回值；未知命令返回安全默认值
  mockIPC((cmd: string) => {
    switch (cmd) {
      case 'read_merged_config':
        return { items: [], scope: 'global' }
      case 'get_preference':
        return null
      case 'set_active_project':
        return null
      default:
        return null
    }
  })
})

afterEach(() => {
  clearMocks()
  vi.clearAllMocks()
})

describe('app e2e', () => {
  it('boots into General page and shows title bar + sidebar', async () => {
    render(<LocaleProvider><App /></LocaleProvider>)
    await waitFor(() => {
      expect(screen.getByText(/general|常规|通用/i)).toBeTruthy()
    })
  })

  it('navigates from General to Models page via sidebar', async () => {
    render(<LocaleProvider><App /></LocaleProvider>)
    const user = userEvent.setup()
    // 点击侧边栏 Models 项（用 i18n key sidebar.models 渲染的文案，按真实文案调整）
    const modelsNav = await screen.findByText(/models|模型/i)
    await user.click(modelsNav)
    await waitFor(() => {
      // Models 页面特征元素（如新增 Provider 的 Fab 或空态文案）
      expect(screen.queryByText(/loading|加载/i)).toBeNull()
    })
  })
})
```

实现者职责：跑测试看实际渲染输出，按真实 i18n 文案与命令名把断言/分支补正确，至少覆盖"启动进入 General + 侧边栏切换到另一页"两条；如能稳定模拟写配置后 toast 出现则加第三条，不稳定则不强加。

- [ ] **步骤 3：运行 e2e 测试**

运行：`cd packages/jacc && pnpm exec vitest run src/App.e2e.test.tsx`
预期：PASS。若因未处理的 invoke 命令 reject 导致挂起，回步骤 1 补全 mockIPC 分支。

- [ ] **步骤 4：确认 e2e 不被 coverage exclude 漏算但也不污染单测**

运行：`cd packages/jacc && pnpm exec vitest run`
预期：全量通过，e2e 计入总数。

- [ ] **步骤 5：全量验证**

运行：`cd packages/jacc && pnpm exec tsc --noEmit && pnpm exec eslint src --max-warnings=0`
预期：零问题。

- [ ] **步骤 6：Commit**

```bash
cd packages/jacc
git add src/App.e2e.test.tsx
git commit -m "test(jacc): 新增集成级端到端流程测试（审计 C2）"
```

---

### 任务 A7：收尾验证与文档归档

**文件：**
- 修改：`docs/superpowers/plans/2026-06-06-done-jacc-plan5-layout-finishing.md`

- [ ] **步骤 1：全量四合一验证**

运行：`cd packages/jacc && pnpm exec vitest run --coverage && pnpm exec tsc --noEmit && pnpm exec eslint src --max-warnings=0`
预期：全部测试通过、覆盖率 >80%、tsc 零错误、eslint 零警告。记录测试总数与覆盖率百分比。

- [ ] **步骤 2：逐条核对全局验证标准**

运行：
```bash
cd packages/jacc
echo "== default export ==" && grep -rn "^export default" src --include="*.tsx" || echo "(none except main entry if any)"
echo "== 未导出 Props ==" && grep -rn "^interface.*Props" src --include="*.tsx" || echo "(none)"
echo "== barrels ==" && find src/features -maxdepth 2 -name "index.ts" | sort
echo "== General 行数 ==" && wc -l src/pages/General.tsx
echo "== >300 行组件 ==" && find src -name "*.tsx" -not -name "*.test.tsx" -not -name "*.e2e.test.tsx" | xargs wc -l | awk '$1>300{print}'
```
预期：default export 仅 main 入口相关（App 已改名后应无）；无未导出 Props；6 个 barrel；General ≤100 行；无 >300 行组件。

- [ ] **步骤 3：在 plan 文档追加收尾验证小节**

在 `docs/superpowers/plans/2026-06-06-done-jacc-plan5-layout-finishing.md` 末尾追加：

```markdown
---

## Plan 整体收尾验证（审计补全后）

对照 `2026-05-31-jacc-frontend-refactor-design.md` 全局验证标准：

- [x] 所有组件都有对应的 `.variants.ts` 文件
- [x] 所有组件使用命名导出（App 已由 default 改为 named）
- [x] 所有 Props 接口已导出（补 ModelSelect/SkillList）
- [x] 组件文件 < 300 行，JSX < 50 行（General 已拆分为 SlotRow/ToggleRow/SelectRow）
- [x] 测试覆盖率 > 80%（接入 @vitest/coverage-v8，实测 <填写百分比>）
- [x] 无 TypeScript 错误
- [x] 无 ESLint 警告
- [x] 应用正常运行，无功能回退

批次 5 测试章节：
- [x] 端到端测试（完整用户流程）— App.e2e.test.tsx 集成级 mockIPC 流程
- [x] Toast 通知显示 — ToastProvider.test.tsx
- [x] 主题切换 — App.test.tsx + useAppStore.test.ts

features/ 模块化：6 个模块均有 index.ts 公共出口；agents 模块结构占位（实现待后续批次）。

测试总数：<填写>；覆盖率：<填写>。
```

把 `<填写>` 替换为步骤 1 的真实数字。

- [ ] **步骤 4：Commit**

```bash
cd D:/Project/jackit
git add docs/superpowers/plans/2026-06-06-done-jacc-plan5-layout-finishing.md
git commit -m "docs(jacc): 记录 Plan 整体收尾验证结果（审计 A7）"
```
