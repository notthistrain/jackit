# jacc 前端重构 - 批次 2：原子组件层

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 重构 7 个原子组件（TitleBar、Sidebar、Fab、EmptyState、SourceBadge、ProjectSwitcher、ConfirmDialog），使用 tailwind-variants 替换内联样式，建立组件和变体文件分离模式

**架构：** 将组件从 `src/components/` 迁移到 `src/shared/components/`，按类型分类（ui/layout），所有组件使用 tailwind-variants 的 tv() 函数定义样式变体，组件和变体文件分离

**技术栈：** React 19、TypeScript、tailwind-variants、Vitest + Testing Library

---

## 文件结构

### 新增文件
```
packages/jacc/src/shared/components/
├── layout/
│   ├── title-bar.variants.ts
│   ├── TitleBar.tsx
│   ├── TitleBar.test.tsx
│   ├── sidebar.variants.ts
│   ├── Sidebar.tsx
│   └── Sidebar.test.tsx
└── ui/
    ├── fab.variants.ts
    ├── Fab.tsx
    ├── Fab.test.tsx
    ├── empty-state.variants.ts
    ├── EmptyState.tsx
    ├── EmptyState.test.tsx
    ├── source-badge.variants.ts
    ├── SourceBadge.tsx
    ├── SourceBadge.test.tsx
    ├── project-switcher.variants.ts
    ├── ProjectSwitcher.tsx
    ├── ProjectSwitcher.test.tsx
    ├── confirm-dialog.variants.ts
    ├── ConfirmDialog.tsx
    └── ConfirmDialog.test.tsx
```

### 删除文件
```
packages/jacc/src/components/
├── TitleBar.tsx
├── Sidebar.tsx
├── Fab.tsx
├── EmptyState.tsx
├── SourceBadge.tsx
├── ProjectSwitcher.tsx
└── ConfirmDialog.tsx
```

### 修改文件
```
packages/jacc/src/App.tsx                    # 更新导入路径
packages/jacc/src/components/Layout.tsx      # 更新导入路径
packages/jacc/src/pages/*.tsx                # 更新导入路径（所有页面）
```

---

## 任务 2.1：重构 TitleBar 组件

**文件：**
- 新增：`packages/jacc/src/shared/components/layout/title-bar.variants.ts`
- 新增：`packages/jacc/src/shared/components/layout/TitleBar.tsx`
- 新增：`packages/jacc/src/shared/components/layout/TitleBar.test.tsx`
- 删除：`packages/jacc/src/components/TitleBar.tsx`

- [ ] **步骤 1：创建 title-bar.variants.ts**

创建：`packages/jacc/src/shared/components/layout/title-bar.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const titleBar = tv({
  slots: {
    root: 'h-8 flex items-center bg-sidebar border-b border-border select-none',
    title: 'pl-3 text-xs text-muted',
    dragRegion: 'flex-1 h-full',
    buttons: 'flex h-full',
    button: 'w-11 h-full flex items-center justify-center text-muted-foreground transition-colors',
  },
  variants: {
    buttonType: {
      minimize: {
        button: 'hover:bg-border/50',
      },
      maximize: {
        button: 'hover:bg-border/50',
      },
      close: {
        button: 'hover:bg-danger/80 hover:text-white',
      },
    },
  },
})
```

- [ ] **步骤 2：创建 TitleBar.tsx**

创建：`packages/jacc/src/shared/components/layout/TitleBar.tsx`

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X } from 'lucide-react'
import { useT } from '@/i18n'
import { titleBar } from './title-bar.variants'

export function TitleBar() {
  const appWindow = getCurrentWindow()
  const { t } = useT()
  const { root, title, dragRegion, buttons, button } = titleBar()

  return (
    <div className={root()}>
      <div className={title()} data-tauri-drag-region>
        {t('app.title')}
      </div>
      <div data-tauri-drag-region className={dragRegion()} />
      <div className={buttons()}>
        <button
          onClick={() => appWindow.minimize()}
          className={button({ buttonType: 'minimize' })}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className={button({ buttonType: 'maximize' })}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className={button({ buttonType: 'close' })}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：创建 TitleBar.test.tsx**

创建：`packages/jacc/src/shared/components/layout/TitleBar.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TitleBar } from './TitleBar'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
}))

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

describe('titleBar', () => {
  it('renders title', () => {
    render(<TitleBar />)
    expect(screen.getByText('app.title')).toBeTruthy()
  })

  it('renders window control buttons', () => {
    const { container } = render(<TitleBar />)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(3)
  })
})
```

- [ ] **步骤 4：删除旧文件**

删除：`packages/jacc/src/components/TitleBar.tsx`

- [ ] **步骤 5：运行测试**

```bash
cd packages/jacc && pnpm test TitleBar.test
```

验证：所有测试通过

- [ ] **步骤 6：提交变更**

```bash
git add packages/jacc/src/shared/components/layout/title-bar.variants.ts \
        packages/jacc/src/shared/components/layout/TitleBar.tsx \
        packages/jacc/src/shared/components/layout/TitleBar.test.tsx
git rm packages/jacc/src/components/TitleBar.tsx
git commit -m "refactor(jacc): 重构 TitleBar 组件使用 tailwind-variants（任务 2.1）"
```

---

## 任务 2.2：重构 Sidebar 组件

**文件：**
- 新增：`packages/jacc/src/shared/components/layout/sidebar.variants.ts`
- 新增：`packages/jacc/src/shared/components/layout/Sidebar.tsx`
- 新增：`packages/jacc/src/shared/components/layout/Sidebar.test.tsx`
- 删除：`packages/jacc/src/components/Sidebar.tsx`

- [ ] **步骤 1：创建 sidebar.variants.ts**

创建：`packages/jacc/src/shared/components/layout/sidebar.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const sidebar = tv({
  slots: {
    root: 'w-[180px] bg-sidebar border-r border-border flex flex-col h-full',
    nav: 'flex-1 py-2 overflow-y-auto',
    sectionTitle: 'px-3 py-1 text-[10px] text-muted uppercase tracking-wider',
    navItem: 'w-full text-left px-4 py-[7px] mx-2 text-xs flex items-center gap-2 rounded-[4px] cursor-pointer',
    footer: 'px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted',
    themeButton: 'cursor-pointer hover:text-foreground flex items-center gap-1',
  },
  variants: {
    active: {
      true: {
        navItem: 'bg-card text-foreground shadow-sm',
      },
      false: {
        navItem: 'text-muted-foreground hover:text-foreground hover:bg-card/50',
      },
    },
  },
})
```

- [ ] **步骤 2：创建 Sidebar.tsx**

创建：`packages/jacc/src/shared/components/layout/Sidebar.tsx`

```typescript
import type { Page } from '@/stores/useAppStore'
import {
  Bot,
  Brain,
  Key,
  Moon,
  Plug,
  Puzzle,
  Settings,
  Shield,
  Sun,
} from 'lucide-react'
import { usePreferences } from '@/hooks/usePreferences'
import { useT } from '@/i18n'
import { useAppStore } from '@/stores/useAppStore'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { sidebar } from './sidebar.variants'

interface NavItem {
  id: Page
  labelKey: string
  icon: React.ReactNode
}

const settingsNav: NavItem[] = [
  { id: 'general', labelKey: 'sidebar.general', icon: <Settings size={14} /> },
  { id: 'envvars', labelKey: 'sidebar.envvars', icon: <Key size={14} /> },
  { id: 'permissions', labelKey: 'sidebar.permissions', icon: <Shield size={14} /> },
  { id: 'mcp', labelKey: 'sidebar.mcp', icon: <Plug size={14} /> },
  { id: 'models', labelKey: 'sidebar.models', icon: <Brain size={14} /> },
]

const extensionsNav: NavItem[] = [
  { id: 'skills', labelKey: 'sidebar.skills', icon: <Puzzle size={14} /> },
  { id: 'agents', labelKey: 'sidebar.agents', icon: <Bot size={14} /> },
]

export function Sidebar() {
  const { t } = useT()
  const { currentPage, setPage, theme, setTheme } = useAppStore()
  const { set: setPreference } = usePreferences()
  const { root, nav, sectionTitle, navItem, footer, themeButton } = sidebar()

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
    setPreference('theme', next)
  }

  const themeLabel = theme === 'system'
    ? t('sidebar.theme.system')
    : theme === 'light'
      ? t('sidebar.theme.light')
      : t('sidebar.theme.dark')

  return (
    <div className={root()}>
      <ProjectSwitcher />

      <nav className={nav()}>
        <div className={sectionTitle()}>{t('sidebar.config')}</div>
        {settingsNav.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={navItem({ active: currentPage === item.id })}
            style={{ width: 'calc(100% - 16px)' }}
          >
            {item.icon}
            {t(item.labelKey)}
          </button>
        ))}

        <div className={sectionTitle()} style={{ marginTop: '12px' }}>
          {t('sidebar.extensions')}
        </div>
        {extensionsNav.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={navItem({ active: currentPage === item.id })}
            style={{ width: 'calc(100% - 16px)' }}
          >
            {item.icon}
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className={footer()}>
        <button onClick={toggleTheme} className={themeButton()}>
          {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          <span>{themeLabel}</span>
        </button>
        <span>v0.1.0</span>
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：创建 Sidebar.test.tsx**

创建：`packages/jacc/src/shared/components/layout/Sidebar.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'

vi.mock('@/hooks/usePreferences', () => ({
  usePreferences: () => ({
    set: vi.fn(),
  }),
}))

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores/useAppStore', () => ({
  useAppStore: () => ({
    currentPage: 'models',
    setPage: vi.fn(),
    theme: 'dark',
    setTheme: vi.fn(),
  }),
}))

vi.mock('@/components/ProjectSwitcher', () => ({
  ProjectSwitcher: () => <div>ProjectSwitcher</div>,
}))

describe('sidebar', () => {
  it('renders navigation sections', () => {
    render(<Sidebar />)
    expect(screen.getByText('sidebar.config')).toBeTruthy()
    expect(screen.getByText('sidebar.extensions')).toBeTruthy()
  })

  it('renders navigation items', () => {
    render(<Sidebar />)
    expect(screen.getByText('sidebar.models')).toBeTruthy()
    expect(screen.getByText('sidebar.skills')).toBeTruthy()
  })
})
```

- [ ] **步骤 4：删除旧文件**

删除：`packages/jacc/src/components/Sidebar.tsx`

- [ ] **步骤 5：运行测试**

```bash
cd packages/jacc && pnpm test Sidebar.test
```

验证：所有测试通过

- [ ] **步骤 6：提交变更**

```bash
git add packages/jacc/src/shared/components/layout/sidebar.variants.ts \
        packages/jacc/src/shared/components/layout/Sidebar.tsx \
        packages/jacc/src/shared/components/layout/Sidebar.test.tsx
git rm packages/jacc/src/components/Sidebar.tsx
git commit -m "refactor(jacc): 重构 Sidebar 组件使用 tailwind-variants（任务 2.2）"
```

---

## 任务 2.3：重构 Fab 组件

**文件：**
- 新增：`packages/jacc/src/shared/components/ui/fab.variants.ts`
- 新增：`packages/jacc/src/shared/components/ui/Fab.tsx`
- 新增：`packages/jacc/src/shared/components/ui/Fab.test.tsx`
- 删除：`packages/jacc/src/components/Fab.tsx`

- [ ] **步骤 1：创建 fab.variants.ts**

创建：`packages/jacc/src/shared/components/ui/fab.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const fab = tv({
  slots: {
    root: 'fixed bottom-5 right-6 w-11 h-11 rounded-full bg-primary text-white shadow-lg flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity cursor-pointer',
  },
})
```

- [ ] **步骤 2：创建 Fab.tsx**

创建：`packages/jacc/src/shared/components/ui/Fab.tsx`

```typescript
import { Plus } from 'lucide-react'
import { fab } from './fab.variants'

export interface FabProps {
  onClick: () => void
  className?: string
}

export function Fab({ onClick, className }: FabProps) {
  const { root } = fab()

  return (
    <button onClick={onClick} className={root({ className })}>
      <Plus size={20} />
    </button>
  )
}
```

- [ ] **步骤 3：创建 Fab.test.tsx**

创建：`packages/jacc/src/shared/components/ui/Fab.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Fab } from './Fab'

describe('fab', () => {
  it('renders button', () => {
    const { container } = render(<Fab onClick={vi.fn()} />)
    const button = container.querySelector('button')
    expect(button).toBeTruthy()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const { container } = render(<Fab onClick={onClick} />)
    const button = container.querySelector('button')!
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies custom className', () => {
    const { container } = render(<Fab onClick={vi.fn()} className="custom-class" />)
    const button = container.querySelector('button')!
    expect(button.className).toContain('custom-class')
  })
})
```

- [ ] **步骤 4：删除旧文件**

删除：`packages/jacc/src/components/Fab.tsx`

- [ ] **步骤 5：运行测试**

```bash
cd packages/jacc && pnpm test Fab.test
```

验证：所有测试通过

- [ ] **步骤 6：提交变更**

```bash
git add packages/jacc/src/shared/components/ui/fab.variants.ts \
        packages/jacc/src/shared/components/ui/Fab.tsx \
        packages/jacc/src/shared/components/ui/Fab.test.tsx
git rm packages/jacc/src/components/Fab.tsx
git commit -m "refactor(jacc): 重构 Fab 组件使用 tailwind-variants（任务 2.3）"
```

---

## 任务 2.4：重构 EmptyState 组件

**文件：**
- 新增：`packages/jacc/src/shared/components/ui/empty-state.variants.ts`
- 新增：`packages/jacc/src/shared/components/ui/EmptyState.tsx`
- 新增：`packages/jacc/src/shared/components/ui/EmptyState.test.tsx`
- 删除：`packages/jacc/src/components/EmptyState.tsx`

- [ ] **步骤 1：创建 empty-state.variants.ts**

创建：`packages/jacc/src/shared/components/ui/empty-state.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const emptyState = tv({
  slots: {
    root: 'flex flex-col items-center justify-center h-full',
    icon: 'text-muted mb-3',
    title: 'text-sm font-medium text-foreground mb-1.5',
    description: 'text-xs text-muted mb-4',
    button: 'px-5 py-2 bg-primary text-white text-xs rounded-[4px] cursor-pointer hover:opacity-90',
  },
})
```

- [ ] **步骤 2：创建 EmptyState.tsx**

创建：`packages/jacc/src/shared/components/ui/EmptyState.tsx`

```typescript
import { FolderOpen } from 'lucide-react'
import { useT } from '@/i18n'
import { emptyState } from './empty-state.variants'

export interface EmptyStateProps {
  onSelectProject: () => void
}

export function EmptyState({ onSelectProject }: EmptyStateProps) {
  const { t } = useT()
  const { root, icon, title, description, button } = emptyState()

  return (
    <div className={root()}>
      <FolderOpen size={48} className={icon()} />
      <p className={title()}>{t('empty.title')}</p>
      <p className={description()}>{t('empty.desc')}</p>
      <button onClick={onSelectProject} className={button()}>
        {t('empty.select')}
      </button>
    </div>
  )
}
```

- [ ] **步骤 3：创建 EmptyState.test.tsx**

创建：`packages/jacc/src/shared/components/ui/EmptyState.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './EmptyState'

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

describe('emptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState onSelectProject={vi.fn()} />)
    expect(screen.getByText('empty.title')).toBeTruthy()
    expect(screen.getByText('empty.desc')).toBeTruthy()
  })

  it('renders select button', () => {
    render(<EmptyState onSelectProject={vi.fn()} />)
    expect(screen.getByText('empty.select')).toBeTruthy()
  })

  it('calls onSelectProject when button clicked', async () => {
    const onSelectProject = vi.fn()
    render(<EmptyState onSelectProject={onSelectProject} />)
    const button = screen.getByText('empty.select')
    await userEvent.click(button)
    expect(onSelectProject).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **步骤 4：删除旧文件**

删除：`packages/jacc/src/components/EmptyState.tsx`

- [ ] **步骤 5：运行测试**

```bash
cd packages/jacc && pnpm test EmptyState.test
```

验证：所有测试通过

- [ ] **步骤 6：提交变更**

```bash
git add packages/jacc/src/shared/components/ui/empty-state.variants.ts \
        packages/jacc/src/shared/components/ui/EmptyState.tsx \
        packages/jacc/src/shared/components/ui/EmptyState.test.tsx
git rm packages/jacc/src/components/EmptyState.tsx
git commit -m "refactor(jacc): 重构 EmptyState 组件使用 tailwind-variants（任务 2.4）"
```

---

## 任务 2.5：重构 SourceBadge 组件

**文件：**
- 新增：`packages/jacc/src/shared/components/ui/source-badge.variants.ts`
- 新增：`packages/jacc/src/shared/components/ui/SourceBadge.tsx`
- 新增：`packages/jacc/src/shared/components/ui/SourceBadge.test.tsx`
- 删除：`packages/jacc/src/components/SourceBadge.tsx`

- [ ] **步骤 1：创建 source-badge.variants.ts**

创建：`packages/jacc/src/shared/components/ui/source-badge.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const sourceBadge = tv({
  slots: {
    root: 'inline-flex items-center px-1.5 py-0.5 text-[9px] rounded-[8px] whitespace-nowrap',
  },
  variants: {
    scope: {
      global: {
        root: 'bg-border text-muted',
      },
      project: {
        root: 'bg-primary-light text-primary',
      },
      user: {
        root: 'bg-border text-muted-foreground',
      },
      plugin: {
        root: 'bg-border text-muted-foreground',
      },
      models: {
        root: 'bg-success-light text-success',
      },
    },
  },
})
```

- [ ] **步骤 2：创建 SourceBadge.tsx**

创建：`packages/jacc/src/shared/components/ui/SourceBadge.tsx`

```typescript
import { useT } from '@/i18n'
import { sourceBadge } from './source-badge.variants'

export interface SourceBadgeProps {
  scope: 'global' | 'project' | 'user' | 'plugin' | 'models'
  className?: string
}

const scopeLabelKeys: Record<string, string> = {
  global: 'source.global',
  project: 'source.project',
  user: 'source.user',
  plugin: 'source.plugin',
  models: '🧠',
}

export function SourceBadge({ scope, className }: SourceBadgeProps) {
  const { t } = useT()
  const { root } = sourceBadge({ scope })
  const label = scope === 'models' ? '🧠' : t(scopeLabelKeys[scope])

  return <span className={root({ className })}>{label}</span>
}
```

- [ ] **步骤 3：创建 SourceBadge.test.tsx**

创建：`packages/jacc/src/shared/components/ui/SourceBadge.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SourceBadge } from './SourceBadge'

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

describe('sourceBadge', () => {
  it('renders global scope', () => {
    render(<SourceBadge scope="global" />)
    expect(screen.getByText('source.global')).toBeTruthy()
  })

  it('renders project scope', () => {
    render(<SourceBadge scope="project" />)
    expect(screen.getByText('source.project')).toBeTruthy()
  })

  it('renders models scope with emoji', () => {
    render(<SourceBadge scope="models" />)
    expect(screen.getByText('🧠')).toBeTruthy()
  })

  it('applies custom className', () => {
    const { container } = render(<SourceBadge scope="global" className="custom-class" />)
    const badge = container.querySelector('span')!
    expect(badge.className).toContain('custom-class')
  })
})
```

- [ ] **步骤 4：删除旧文件**

删除：`packages/jacc/src/components/SourceBadge.tsx`

- [ ] **步骤 5：运行测试**

```bash
cd packages/jacc && pnpm test SourceBadge.test
```

验证：所有测试通过

- [ ] **步骤 6：提交变更**

```bash
git add packages/jacc/src/shared/components/ui/source-badge.variants.ts \
        packages/jacc/src/shared/components/ui/SourceBadge.tsx \
        packages/jacc/src/shared/components/ui/SourceBadge.test.tsx
git rm packages/jacc/src/components/SourceBadge.tsx
git commit -m "refactor(jacc): 重构 SourceBadge 组件使用 tailwind-variants（任务 2.5）"
```

---

## 任务 2.6：重构 ProjectSwitcher 组件

**文件：**
- 新增：`packages/jacc/src/shared/components/ui/project-switcher.variants.ts`
- 新增：`packages/jacc/src/shared/components/ui/ProjectSwitcher.tsx`
- 新增：`packages/jacc/src/shared/components/ui/ProjectSwitcher.test.tsx`
- 删除：`packages/jacc/src/components/ProjectSwitcher.tsx`

- [ ] **步骤 1：创建 project-switcher.variants.ts**

创建：`packages/jacc/src/shared/components/ui/project-switcher.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const projectSwitcher = tv({
  slots: {
    root: 'relative px-3 pt-3 pb-2 border-b border-border',
    trigger: 'w-full px-2.5 py-1.5 bg-card border border-border rounded-[4px] flex items-center justify-between cursor-pointer hover:border-muted',
    triggerLeft: 'text-left',
    triggerLabel: 'text-[11px] text-muted',
    triggerValue: 'text-xs font-medium text-foreground truncate',
    triggerIcon: 'text-muted shrink-0',
    dropdown: 'absolute left-3 right-3 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-50 overflow-hidden',
    currentSection: 'px-3 py-2 bg-primary-light border-b border-border',
    currentLabel: 'text-[11px] text-primary',
    currentName: 'text-xs font-medium text-foreground truncate',
    currentPath: 'text-[10px] text-muted truncate',
    listSection: 'py-1.5',
    listTitle: 'px-3 py-1 text-[10px] text-muted',
    listItem: 'px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-border/30',
    listItemIcon: 'text-muted shrink-0',
    listItemContent: 'flex-1 min-w-0',
    listItemName: 'text-xs text-foreground truncate',
    listItemPath: 'text-[10px] text-muted truncate',
    pinButton: 'text-muted hover:text-foreground',
    footer: 'border-t border-border px-3 py-2',
    footerButton: 'text-xs text-primary cursor-pointer hover:underline',
  },
})
```

- [ ] **步骤 2：创建 ProjectSwitcher.tsx**

创建：`packages/jacc/src/shared/components/ui/ProjectSwitcher.tsx`

```typescript
import type { Project } from '@/hooks/useProjects'
import { open } from '@tauri-apps/plugin-dialog'
import { ChevronDown, FolderOpen, Pin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { useT } from '@/i18n'
import { useAppStore } from '@/stores/useAppStore'
import { projectSwitcher } from './project-switcher.variants'

export function ProjectSwitcher() {
  const { t } = useT()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { currentProject, setProject } = useAppStore()
  const { projects, add, open: openProject, pin } = useProjects()

  const {
    root,
    trigger,
    triggerLeft,
    triggerLabel,
    triggerValue,
    triggerIcon,
    dropdown,
    currentSection,
    currentLabel,
    currentName,
    currentPath,
    listSection,
    listTitle,
    listItem,
    listItemIcon,
    listItemContent,
    listItemName,
    listItemPath,
    pinButton,
    footer,
    footerButton,
  } = projectSwitcher()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentName_ = currentProject ? currentProject.split(/[/\\]/).pop() : null

  async function handleSelectFolder() {
    const selected = await open({ directory: true })
    if (selected) {
      await add(selected)
      await openProject(selected)
      setProject(selected)
      setIsOpen(false)
    }
  }

  async function handleSwitchProject(project: Project) {
    await openProject(project.path)
    setProject(project.path)
    setIsOpen(false)
  }

  return (
    <div ref={ref} className={root()}>
      <button onClick={() => setIsOpen(!isOpen)} className={trigger()}>
        <div className={triggerLeft()}>
          <div className={triggerLabel()}>{t('project.current')}</div>
          <div className={triggerValue()}>{currentName_ || t('project.none')}</div>
        </div>
        <ChevronDown size={14} className={triggerIcon()} />
      </button>

      {isOpen && (
        <div className={dropdown()}>
          {currentProject && (
            <div className={currentSection()}>
              <div className={currentLabel()}>{t('project.currentLabel')}</div>
              <div className={currentName()}>{currentName_}</div>
              <div className={currentPath()}>{currentProject}</div>
            </div>
          )}

          {projects.length > 0 && (
            <div className={listSection()}>
              <div className={listTitle()}>{t('project.recent')}</div>
              {projects
                .filter(p => p.path !== currentProject)
                .slice(0, 5)
                .map(project => (
                  <div
                    key={project.id}
                    onClick={() => handleSwitchProject(project)}
                    className={listItem()}
                  >
                    <FolderOpen size={12} className={listItemIcon()} />
                    <div className={listItemContent()}>
                      <div className={listItemName()}>{project.name}</div>
                      <div className={listItemPath()}>{project.path}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        pin(project.id, !project.pinned)
                      }}
                      className={pinButton()}
                    >
                      <Pin size={10} className={project.pinned ? 'fill-current' : ''} />
                    </button>
                  </div>
                ))}
            </div>
          )}

          <div className={footer()}>
            <button onClick={handleSelectFolder} className={footerButton()}>
              {t('project.openOther')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **步骤 3：创建 ProjectSwitcher.test.tsx**

创建：`packages/jacc/src/shared/components/ui/ProjectSwitcher.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectSwitcher } from './ProjectSwitcher'

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [],
    add: vi.fn(),
    open: vi.fn(),
    pin: vi.fn(),
  }),
}))

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores/useAppStore', () => ({
  useAppStore: () => ({
    currentProject: null,
    setProject: vi.fn(),
  }),
}))

describe('projectSwitcher', () => {
  it('renders trigger button', () => {
    render(<ProjectSwitcher />)
    expect(screen.getByText('project.current')).toBeTruthy()
    expect(screen.getByText('project.none')).toBeTruthy()
  })
})
```

- [ ] **步骤 4：删除旧文件**

删除：`packages/jacc/src/components/ProjectSwitcher.tsx`

- [ ] **步骤 5：运行测试**

```bash
cd packages/jacc && pnpm test ProjectSwitcher.test
```

验证：所有测试通过

- [ ] **步骤 6：提交变更**

```bash
git add packages/jacc/src/shared/components/ui/project-switcher.variants.ts \
        packages/jacc/src/shared/components/ui/ProjectSwitcher.tsx \
        packages/jacc/src/shared/components/ui/ProjectSwitcher.test.tsx
git rm packages/jacc/src/components/ProjectSwitcher.tsx
git commit -m "refactor(jacc): 重构 ProjectSwitcher 组件使用 tailwind-variants（任务 2.6）"
```

---

## 任务 2.7：重构 ConfirmDialog 组件

**文件：**
- 新增：`packages/jacc/src/shared/components/ui/confirm-dialog.variants.ts`
- 新增：`packages/jacc/src/shared/components/ui/ConfirmDialog.tsx`
- 新增：`packages/jacc/src/shared/components/ui/ConfirmDialog.test.tsx`
- 删除：`packages/jacc/src/components/ConfirmDialog.tsx`

- [ ] **步骤 1：创建 confirm-dialog.variants.ts**

创建：`packages/jacc/src/shared/components/ui/confirm-dialog.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const confirmDialog = tv({
  slots: {
    overlay: 'fixed inset-0 bg-black/30 flex items-center justify-center z-50',
    content: 'bg-card border border-border rounded-[4px] p-5 w-[360px] shadow-xl',
    title: 'text-[14px] font-medium text-foreground mb-2',
    message: 'text-[12px] text-muted leading-relaxed',
    footer: 'flex justify-end gap-2 mt-4',
    cancelButton: 'px-4 py-1.5 border border-border text-xs text-muted-foreground rounded-[2px] hover:bg-sidebar',
    confirmButton: 'px-4 py-1.5 text-xs text-white rounded-[2px]',
  },
  variants: {
    danger: {
      true: {
        confirmButton: 'bg-danger hover:bg-danger/90',
      },
      false: {
        confirmButton: 'bg-primary hover:bg-primary/90',
      },
    },
  },
})
```

- [ ] **步骤 2：创建 ConfirmDialog.tsx**

创建：`packages/jacc/src/shared/components/ui/ConfirmDialog.tsx`

```typescript
import { useT } from '@/i18n'
import { confirmDialog } from './confirm-dialog.variants'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useT()
  const { overlay, content, title: titleClass, message: messageClass, footer, cancelButton, confirmButton } = confirmDialog({ danger })

  if (!open) return null

  return (
    <div className={overlay()} onClick={onCancel}>
      <div className={content()} onClick={e => e.stopPropagation()}>
        <h3 className={titleClass()}>{title}</h3>
        <p className={messageClass()}>{message}</p>
        <div className={footer()}>
          <button onClick={onCancel} className={cancelButton()}>
            {t('confirm.cancel')}
          </button>
          <button onClick={onConfirm} className={confirmButton()}>
            {confirmLabel || t('confirm.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：创建 ConfirmDialog.test.tsx**

创建：`packages/jacc/src/shared/components/ui/ConfirmDialog.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

vi.mock('@/i18n', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

describe('confirmDialog', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Test"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders when open', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Test Title')).toBeTruthy()
    expect(screen.getByText('Test Message')).toBeTruthy()
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Message"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )
    const confirmButton = screen.getByText('confirm.ok')
    await userEvent.click(confirmButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )
    const cancelButton = screen.getByText('confirm.cancel')
    await userEvent.click(cancelButton)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('uses custom confirm label', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Message"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Delete')).toBeTruthy()
  })
})
```

- [ ] **步骤 4：删除旧文件**

删除：`packages/jacc/src/components/ConfirmDialog.tsx`

- [ ] **步骤 5：运行测试**

```bash
cd packages/jacc && pnpm test ConfirmDialog.test
```

验证：所有测试通过

- [ ] **步骤 6：提交变更**

```bash
git add packages/jacc/src/shared/components/ui/confirm-dialog.variants.ts \
        packages/jacc/src/shared/components/ui/ConfirmDialog.tsx \
        packages/jacc/src/shared/components/ui/ConfirmDialog.test.tsx
git rm packages/jacc/src/components/ConfirmDialog.tsx
git commit -m "refactor(jacc): 重构 ConfirmDialog 组件使用 tailwind-variants（任务 2.7）"
```

---

## 任务 2.8：更新导入路径

**文件：**
- 修改：`packages/jacc/src/App.tsx`
- 修改：`packages/jacc/src/components/Layout.tsx`
- 修改：`packages/jacc/src/pages/*.tsx`（所有页面文件）

- [ ] **步骤 1：查找所有需要更新的文件**

```bash
cd packages/jacc && grep -r "from '@/components/TitleBar'" src/ || true
cd packages/jacc && grep -r "from '@/components/Sidebar'" src/ || true
cd packages/jacc && grep -r "from '@/components/Fab'" src/ || true
cd packages/jacc && grep -r "from '@/components/EmptyState'" src/ || true
cd packages/jacc && grep -r "from '@/components/SourceBadge'" src/ || true
cd packages/jacc && grep -r "from '@/components/ProjectSwitcher'" src/ || true
cd packages/jacc && grep -r "from '@/components/ConfirmDialog'" src/ || true
```

- [ ] **步骤 2：更新 Layout.tsx 导入路径**

读取：`packages/jacc/src/components/Layout.tsx`

更新导入路径：
- `@/components/TitleBar` → `@/shared/components/layout/TitleBar`
- `@/components/Sidebar` → `@/shared/components/layout/Sidebar`

- [ ] **步骤 3：更新所有页面文件导入路径**

对于每个使用了这些组件的页面文件，更新导入路径：
- `@/components/Fab` → `@/shared/components/ui/Fab`
- `@/components/EmptyState` → `@/shared/components/ui/EmptyState`
- `@/components/SourceBadge` → `@/shared/components/ui/SourceBadge`
- `@/components/ProjectSwitcher` → `@/shared/components/ui/ProjectSwitcher`
- `@/components/ConfirmDialog` → `@/shared/components/ui/ConfirmDialog`

- [ ] **步骤 4：验证 TypeScript 编译**

```bash
cd packages/jacc && pnpm tsc --noEmit
```

验证：无新增类型错误

- [ ] **步骤 5：运行所有测试**

```bash
cd packages/jacc && pnpm test
```

验证：所有测试通过

- [ ] **步骤 6：运行 ESLint**

```bash
cd packages/jacc && pnpm lint
```

验证：无 ESLint 错误

- [ ] **步骤 7：提交变更**

```bash
git add packages/jacc/src/components/Layout.tsx packages/jacc/src/pages/
git commit -m "refactor(jacc): 更新组件导入路径到新位置（任务 2.8）"
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
- ✅ 所有测试通过（预计新增 21 个测试）
- ✅ TypeScript 编译无新增错误
- ✅ ESLint 检查通过
- ✅ 开发服务器正常启动

---

## 总结

**批次 2 完成后：**
- ✅ 7 个原子组件已重构使用 tailwind-variants
- ✅ 组件从 `src/components/` 迁移到 `src/shared/components/`
- ✅ 按类型分类（ui/layout）
- ✅ 所有组件使用变体文件分离模式
- ✅ 新增 21 个测试用例
- ✅ 所有导入路径已更新

**下一步：**
- 批次 3：复合组件层（对话框、列表、API 抽象层）
```

