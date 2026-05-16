# jacc 计划 3：前端核心框架 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 jacc 前端的核心框架，包括布局组件、侧边栏导航、项目切换器、主题系统和 Tauri 命令调用 hooks

**架构：** React 单页应用，Zustand 管理全局状态，通过 Tauri invoke 调用 Rust 后端。侧边栏 + 内容区布局，支持浅色/深色主题切换。

**技术栈：** React 19, Zustand 5, Tailwind CSS 4, @tauri-apps/api, Lucide React

**前置依赖：** 计划 1（脚手架）和计划 2（Rust 后端）完成

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/stores/useAppStore.ts` | 全局状态：当前项目、当前页面、主题 |
| `src/hooks/usePreferences.ts` | 偏好读写 hook |
| `src/hooks/useProjects.ts` | 项目历史 hook |
| `src/components/Layout.tsx` | 主布局：侧边栏 + 内容区 |
| `src/components/Sidebar.tsx` | 侧边栏导航 |
| `src/components/ProjectSwitcher.tsx` | 项目切换器下拉 |
| `src/components/TitleBar.tsx` | 自定义标题栏 |
| `src/components/SourceBadge.tsx` | 来源标签组件 |
| `src/components/Fab.tsx` | 悬浮操作按钮 |
| `src/components/EmptyState.tsx` | 空状态页面 |
| `src/App.tsx` | 修改：使用 Layout 和路由 |

---

### 任务 1：全局状态 Store

**文件：**
- 创建：`packages/jacc/src/stores/useAppStore.ts`

- [ ] **步骤 1：创建 useAppStore.ts**

```typescript
import { create } from 'zustand'

export type Page =
  | 'general'
  | 'envvars'
  | 'permissions'
  | 'mcp'
  | 'models'
  | 'skills'
  | 'agents'

export type Theme = 'light' | 'dark' | 'system'

interface AppState {
  currentPage: Page
  currentProject: string | null
  theme: Theme
  setPage: (page: Page) => void
  setProject: (path: string | null) => void
  setTheme: (theme: Theme) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'general',
  currentProject: null,
  theme: 'system',
  setPage: (page) => set({ currentPage: page }),
  setProject: (path) => set({ currentProject: path }),
  setTheme: (theme) => set({ theme }),
}))
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/stores/
git commit -m "feat(jacc): 添加全局状态 store"
```

---

### 任务 2：Tauri 调用 Hooks

**文件：**
- 创建：`packages/jacc/src/hooks/usePreferences.ts`
- 创建：`packages/jacc/src/hooks/useProjects.ts`

- [ ] **步骤 1：创建 usePreferences.ts**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback } from 'react'

export function usePreferences() {
  const get = useCallback(async (key: string): Promise<string | null> => {
    return invoke<string | null>('get_preference', { key })
  }, [])

  const set = useCallback(async (key: string, value: string): Promise<void> => {
    return invoke('set_preference', { key, value })
  }, [])

  return { get, set }
}
```

- [ ] **步骤 2：创建 useProjects.ts**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface Project {
  id: number
  path: string
  name: string | null
  last_opened_at: string
  pinned: number
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])

  const refresh = useCallback(async () => {
    const list = await invoke<Project[]>('list_projects')
    setProjects(list)
  }, [])

  const add = useCallback(async (path: string, name?: string) => {
    await invoke('add_project', { path, name })
    await refresh()
  }, [refresh])

  const open = useCallback(async (path: string) => {
    await invoke('open_project', { path })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await invoke('remove_project', { id })
    await refresh()
  }, [refresh])

  const pin = useCallback(async (id: number, pinned: boolean) => {
    await invoke('pin_project', { id, pinned })
    await refresh()
  }, [refresh])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { projects, refresh, add, open, remove, pin }
}
```

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src/hooks/
git commit -m "feat(jacc): 添加 preferences 和 projects hooks"
```

---

### 任务 3：基础 UI 组件

**文件：**
- 创建：`packages/jacc/src/components/SourceBadge.tsx`
- 创建：`packages/jacc/src/components/Fab.tsx`
- 创建：`packages/jacc/src/components/EmptyState.tsx`

- [ ] **步骤 1：创建 SourceBadge.tsx**

```tsx
import { cn } from '@/lib/utils'

interface SourceBadgeProps {
  scope: 'global' | 'project' | 'user' | 'plugin' | 'models'
  className?: string
}

const scopeStyles = {
  global: 'bg-border text-muted',
  project: 'bg-primary-light text-primary',
  user: 'bg-border text-muted-foreground',
  plugin: 'bg-border text-muted-foreground',
  models: 'bg-success-light text-success',
}

const scopeLabels = {
  global: '全局',
  project: '项目',
  user: '用户',
  plugin: '插件',
  models: '🧠',
}

export function SourceBadge({ scope, className }: SourceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-[9px] rounded-[8px] whitespace-nowrap',
        scopeStyles[scope],
        className,
      )}
    >
      {scopeLabels[scope]}
    </span>
  )
}
```

- [ ] **步骤 2：创建 Fab.tsx**

```tsx
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FabProps {
  onClick: () => void
  className?: string
}

export function Fab({ onClick, className }: FabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-5 right-6 w-11 h-11 rounded-full',
        'bg-primary text-white shadow-lg',
        'flex items-center justify-center',
        'hover:opacity-90 transition-opacity cursor-pointer',
        className,
      )}
    >
      <Plus size={20} />
    </button>
  )
}
```

- [ ] **步骤 3：创建 EmptyState.tsx**

```tsx
import { FolderOpen } from 'lucide-react'

interface EmptyStateProps {
  onSelectProject: () => void
}

export function EmptyState({ onSelectProject }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <FolderOpen size={48} className="text-muted mb-3" />
      <p className="text-sm font-medium text-foreground mb-1.5">还没有打开项目</p>
      <p className="text-xs text-muted mb-4">选择一个包含 .claude 目录的项目开始配置</p>
      <button
        onClick={onSelectProject}
        className="px-5 py-2 bg-primary text-white text-xs rounded-[4px] cursor-pointer hover:opacity-90"
      >
        选择项目目录
      </button>
    </div>
  )
}
```

- [ ] **步骤 4：创建 lib/utils.ts**

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/components/ packages/jacc/src/lib/
git commit -m "feat(jacc): 添加基础 UI 组件（SourceBadge/Fab/EmptyState）"
```

---

### 任务 4：TitleBar 组件

**文件：**
- 创建：`packages/jacc/src/components/TitleBar.tsx`

- [ ] **步骤 1：创建 TitleBar.tsx**

```tsx
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X } from 'lucide-react'

export function TitleBar() {
  const appWindow = getCurrentWindow()

  return (
    <div
      data-tauri-drag-region
      className="h-8 flex items-center justify-between bg-sidebar border-b border-border select-none"
    >
      <div className="pl-3 text-xs text-muted" data-tauri-drag-region>
        jacc
      </div>
      <div className="flex h-full">
        <button
          onClick={() => appWindow.minimize()}
          className="w-11 h-full flex items-center justify-center hover:bg-border/50 text-muted-foreground"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="w-11 h-full flex items-center justify-center hover:bg-border/50 text-muted-foreground"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="w-11 h-full flex items-center justify-center hover:bg-danger/80 hover:text-white text-muted-foreground"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/components/TitleBar.tsx
git commit -m "feat(jacc): 添加自定义标题栏"
```

---

### 任务 5：ProjectSwitcher 组件

**文件：**
- 创建：`packages/jacc/src/components/ProjectSwitcher.tsx`

- [ ] **步骤 1：创建 ProjectSwitcher.tsx**

```tsx
import { open } from '@tauri-apps/plugin-dialog'
import { ChevronDown, FolderOpen, Pin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useProjects, type Project } from '@/hooks/useProjects'

export function ProjectSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { currentProject, setProject } = useAppStore()
  const { projects, add, open: openProject, pin } = useProjects()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentName = currentProject
    ? currentProject.split(/[/\\]/).pop()
    : null

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
    <div ref={ref} className="relative px-3 pt-3 pb-2 border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2.5 py-1.5 bg-card border border-border rounded-[4px] flex items-center justify-between cursor-pointer hover:border-muted"
      >
        <div className="text-left">
          <div className="text-[11px] text-muted">当前项目</div>
          <div className="text-xs font-medium text-foreground truncate">
            {currentName || '未选择'}
          </div>
        </div>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-50 overflow-hidden">
          {currentProject && (
            <div className="px-3 py-2 bg-primary-light border-b border-border">
              <div className="text-[11px] text-primary">当前</div>
              <div className="text-xs font-medium text-foreground truncate">{currentName}</div>
              <div className="text-[10px] text-muted truncate">{currentProject}</div>
            </div>
          )}

          {projects.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[10px] text-muted">最近项目</div>
              {projects
                .filter((p) => p.path !== currentProject)
                .slice(0, 5)
                .map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleSwitchProject(project)}
                    className="px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-border/30"
                  >
                    <FolderOpen size={12} className="text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-foreground truncate">{project.name}</div>
                      <div className="text-[10px] text-muted truncate">{project.path}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        pin(project.id, !project.pinned)
                      }}
                      className="text-muted hover:text-foreground"
                    >
                      <Pin size={10} className={project.pinned ? 'fill-current' : ''} />
                    </button>
                  </div>
                ))}
            </div>
          )}

          <div className="border-t border-border px-3 py-2">
            <button
              onClick={handleSelectFolder}
              className="text-xs text-primary cursor-pointer hover:underline"
            >
              📂 打开其他项目...
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/components/ProjectSwitcher.tsx
git commit -m "feat(jacc): 添加项目切换器组件"
```

---

### 任务 6：Sidebar 组件

**文件：**
- 创建：`packages/jacc/src/components/Sidebar.tsx`

- [ ] **步骤 1：创建 Sidebar.tsx**

```tsx
import {
  Bot,
  Key,
  Plug,
  Puzzle,
  Settings,
  Shield,
  Brain,
  Moon,
  Sun,
} from 'lucide-react'
import { useAppStore, type Page } from '@/stores/useAppStore'
import { ProjectSwitcher } from './ProjectSwitcher'
import { cn } from '@/lib/utils'

interface NavItem {
  id: Page
  label: string
  icon: React.ReactNode
}

const settingsNav: NavItem[] = [
  { id: 'general', label: '通用', icon: <Settings size={14} /> },
  { id: 'envvars', label: '环境变量', icon: <Key size={14} /> },
  { id: 'permissions', label: '权限', icon: <Shield size={14} /> },
  { id: 'mcp', label: 'MCP 服务器', icon: <Plug size={14} /> },
  { id: 'models', label: '模型库', icon: <Brain size={14} /> },
]

const extensionsNav: NavItem[] = [
  { id: 'skills', label: 'Skills', icon: <Puzzle size={14} /> },
  { id: 'agents', label: 'Agents', icon: <Bot size={14} /> },
]

export function Sidebar() {
  const { currentPage, setPage, theme, setTheme } = useAppStore()

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
  }

  return (
    <div className="w-[180px] bg-sidebar border-r border-border flex flex-col h-full">
      <ProjectSwitcher />

      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wider">配置</div>
        {settingsNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={cn(
              'w-full text-left px-4 py-[7px] mx-2 text-xs flex items-center gap-2 rounded-[4px] cursor-pointer',
              currentPage === item.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}
            style={{ width: 'calc(100% - 16px)' }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        <div className="px-3 py-1 mt-3 text-[10px] text-muted uppercase tracking-wider">扩展</div>
        {extensionsNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={cn(
              'w-full text-left px-4 py-[7px] mx-2 text-xs flex items-center gap-2 rounded-[4px] cursor-pointer',
              currentPage === item.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}
            style={{ width: 'calc(100% - 16px)' }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted">
        <button onClick={toggleTheme} className="cursor-pointer hover:text-foreground flex items-center gap-1">
          {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          <span>{theme === 'system' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}</span>
        </button>
        <span>v0.1.0</span>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/components/Sidebar.tsx
git commit -m "feat(jacc): 添加侧边栏导航组件"
```

---

### 任务 7：Layout 和 App 集成

**文件：**
- 创建：`packages/jacc/src/components/Layout.tsx`
- 修改：`packages/jacc/src/App.tsx`

- [ ] **步骤 1：创建 Layout.tsx**

```tsx
import { useAppStore } from '@/stores/useAppStore'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'
import { EmptyState } from './EmptyState'
import { open } from '@tauri-apps/plugin-dialog'
import { useProjects } from '@/hooks/useProjects'

// 页面组件占位（后续计划实现）
function PagePlaceholder({ name }: { name: string }) {
  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground">{name}</h2>
      <p className="text-xs text-muted mt-2">页面开发中...</p>
    </div>
  )
}

export function Layout() {
  const { currentPage, currentProject, setProject } = useAppStore()
  const { add, open: openProject } = useProjects()

  async function handleSelectProject() {
    const selected = await open({ directory: true })
    if (selected) {
      await add(selected)
      await openProject(selected)
      setProject(selected)
    }
  }

  function renderPage() {
    if (!currentProject) {
      return <EmptyState onSelectProject={handleSelectProject} />
    }

    switch (currentPage) {
      case 'general':
        return <PagePlaceholder name="通用设置" />
      case 'envvars':
        return <PagePlaceholder name="环境变量" />
      case 'permissions':
        return <PagePlaceholder name="权限" />
      case 'mcp':
        return <PagePlaceholder name="MCP 服务器" />
      case 'models':
        return <PagePlaceholder name="模型库" />
      case 'skills':
        return <PagePlaceholder name="Skills" />
      case 'agents':
        return <PagePlaceholder name="Agents" />
      default:
        return null
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative">{renderPage()}</main>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：更新 App.tsx**

```tsx
import { useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { useAppStore } from '@/stores/useAppStore'
import { usePreferences } from '@/hooks/usePreferences'

export default function App() {
  const { theme, setTheme } = useAppStore()
  const { get } = usePreferences()

  // 启动时加载主题偏好
  useEffect(() => {
    get('theme').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setTheme(saved)
      }
    })
  }, [get, setTheme])

  // 应用主题到 DOM
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  return <Layout />
}
```

- [ ] **步骤 3：验证前端构建**

运行：`cd D:/Project/jackit/packages/jacc && pnpm build`
预期：构建成功

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src/
git commit -m "feat(jacc): 集成 Layout 和 App，完成前端核心框架"
```
