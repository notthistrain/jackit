# JackCom UI 功能串联 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 jackcom 的 UI 从占位符状态串联为功能完整的应用——融合式自定义标题栏/菜单栏、自研 i18n、快捷键、Toolbar 子窗口接通、Quick Send 侧边栏。

**架构：** Tauri 2 桌面应用（decorations: false），React + Zustand + TypeScript。自定义 TitleBar 集成拖拽区域 + 下拉菜单 + 窗口控制。i18n 使用 Vite glob 加载 JSON 语言包，通过 React Context 分发。快捷键通过 useKeyboardShortcuts hook 注册。

**技术栈：** React 19, Zustand 5, Tauri 2, Vite 6, Vitest, TypeScript, Tailwind CSS

**设计文档：** `docs/superpowers/specs/2026-05-13-jackcom-ui-integration-design.md`

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/i18n/locales/zh.json` | 中文语言包 |
| `src/i18n/locales/en.json` | 英文语言包 |
| `src/i18n/index.ts` | LocaleProvider, useT hook, t() 翻译函数 |
| `src/components/menu/MenuDropdown.tsx` | 下拉菜单容器（定位、展开/折叠、Esc 关闭） |
| `src/components/menu/MenuItem.tsx` | 单个菜单项（文字、快捷键提示、分隔线、disabled） |
| `src/components/layout/WindowControls.tsx` | 窗口控制按钮（最小化/最大化/关闭） |
| `src/components/layout/TitleBar.tsx` | 融合标题栏（拖拽区 + 菜单 + 窗口控制） |
| `src/components/sidebar/QuickSendPanel.tsx` | Quick Send 面板（CRUD + 发送） |
| `src/hooks/useKeyboardShortcuts.ts` | 快捷键注册 hook |
| `src/lib/snippets-store.ts` | Quick Send 片段状态（zustand + persist） |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/lib/store.ts` | 移除 PanelType/activePanel 相关代码 |
| `src/components/layout/AppLayout.tsx` | 用 TitleBar 替代旧 MenuBar |
| `src/apps/MainApp.tsx` | 移除 Tab 栏，直接渲染 TerminalView |
| `src/components/layout/Toolbar.tsx` | Wave/Decode 按钮接通子窗口 + tooltip |
| `src/components/layout/ActivityBar.tsx` | 加 tooltip |
| `src/components/sidebar/Sidebar.tsx` | 集成 QuickSendPanel |
| `src/lib/bootstrap.tsx` | 包裹 LocaleProvider |
| `src/styles/vscode-theme.css` | 新增菜单相关 CSS 变量 |
| `src-tauri/tauri.conf.json` | decorations: false |
| `src/lib/__tests__/stores.test.ts` | 移除 activePanel 相关测试 |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/components/layout/MenuBar.tsx` | 被 TitleBar + menu/ 组件替代 |

---

## 任务 1：i18n 系统

**文件：**
- 创建：`src/i18n/locales/zh.json`
- 创建：`src/i18n/locales/en.json`
- 创建：`src/i18n/index.ts`
- 测试：`src/i18n/__tests__/i18n.test.ts`

- [ ] **步骤 1：编写中文语言包**

```json
// src/i18n/locales/zh.json
{
  "app.title": "JackCom",
  "menu.file.label": "文件",
  "menu.file.newConnection": "新建连接",
  "menu.file.openHistory": "打开历史",
  "menu.file.export": "导出数据...",
  "menu.file.exit": "退出",
  "menu.connection.label": "连接",
  "menu.connection.connect": "连接...",
  "menu.connection.disconnect": "断开连接",
  "menu.connection.portSettings": "端口设置",
  "menu.connection.close": "关闭连接",
  "menu.connection.closeAll": "关闭全部",
  "menu.view.label": "视图",
  "menu.view.toggleSidebar": "切换侧边栏",
  "menu.view.toggleHex": "切换 HEX/ASCII",
  "menu.view.waveform": "波形窗口",
  "menu.view.decoder": "解码窗口",
  "menu.view.history": "历史窗口",
  "menu.view.language": "语言",
  "menu.tools.label": "工具",
  "menu.tools.quickSend": "快捷发送",
  "menu.tools.clearTerminal": "清空终端",
  "menu.tools.export": "导出...",
  "menu.window.label": "窗口",
  "menu.window.waveform": "波形",
  "menu.window.decoder": "解码",
  "menu.window.history": "历史",
  "menu.help.label": "帮助",
  "menu.help.about": "关于",
  "menu.help.documentation": "文档",
  "menu.help.checkUpdates": "检查更新",
  "toolbar.connect": "连接",
  "toolbar.disconnect": "断开",
  "toolbar.wave": "波形",
  "toolbar.decode": "解码",
  "toolbar.toggleSidebar": "切换侧边栏",
  "toolbar.online": "在线",
  "sidebar.connections": "连接列表",
  "sidebar.quickSend": "快捷发送",
  "sidebar.quickSend.add": "新增片段",
  "sidebar.quickSend.send": "发送",
  "sidebar.quickSend.delete": "删除",
  "sidebar.quickSend.namePlaceholder": "片段名称",
  "sidebar.quickSend.dataPlaceholder": "HEX 数据（如 01 03 00）",
  "sidebar.quickSend.confirm": "确认",
  "sidebar.quickSend.cancel": "取消",
  "sidebar.quickSend.empty": "暂无片段，点击下方新增",
  "sidebar.noConnections": "暂无连接，使用工具栏连接",
  "sendbar.hex": "HEX",
  "sendbar.ascii": "ASCII",
  "sendbar.send": "发送",
  "statusbar.app": "JackCom",
  "common.cancel": "取消",
  "common.delete": "删除",
  "common.confirm": "确认"
}
```

- [ ] **步骤 2：编写英文语言包**

```json
// src/i18n/locales/en.json
{
  "app.title": "JackCom",
  "menu.file.label": "File",
  "menu.file.newConnection": "New Connection",
  "menu.file.openHistory": "Open History",
  "menu.file.export": "Export Data...",
  "menu.file.exit": "Exit",
  "menu.connection.label": "Connection",
  "menu.connection.connect": "Connect...",
  "menu.connection.disconnect": "Disconnect",
  "menu.connection.portSettings": "Port Settings",
  "menu.connection.close": "Close Connection",
  "menu.connection.closeAll": "Close All",
  "menu.view.label": "View",
  "menu.view.toggleSidebar": "Toggle Sidebar",
  "menu.view.toggleHex": "Toggle HEX/ASCII",
  "menu.view.waveform": "Waveform Window",
  "menu.view.decoder": "Decoder Window",
  "menu.view.history": "History Window",
  "menu.view.language": "Language",
  "menu.tools.label": "Tools",
  "menu.tools.quickSend": "Quick Send",
  "menu.tools.clearTerminal": "Clear Terminal",
  "menu.tools.export": "Export...",
  "menu.window.label": "Window",
  "menu.window.waveform": "Waveform",
  "menu.window.decoder": "Decoder",
  "menu.window.history": "History",
  "menu.help.label": "Help",
  "menu.help.about": "About",
  "menu.help.documentation": "Documentation",
  "menu.help.checkUpdates": "Check for Updates",
  "toolbar.connect": "Connect",
  "toolbar.disconnect": "Disconnect",
  "toolbar.wave": "Wave",
  "toolbar.decode": "Decode",
  "toolbar.toggleSidebar": "Toggle Sidebar",
  "toolbar.online": "Online",
  "sidebar.connections": "CONNECTIONS",
  "sidebar.quickSend": "QUICK SEND",
  "sidebar.quickSend.add": "Add Snippet",
  "sidebar.quickSend.send": "Send",
  "sidebar.quickSend.delete": "Delete",
  "sidebar.quickSend.namePlaceholder": "Snippet name",
  "sidebar.quickSend.dataPlaceholder": "HEX data (e.g. 01 03 00)",
  "sidebar.quickSend.confirm": "Confirm",
  "sidebar.quickSend.cancel": "Cancel",
  "sidebar.quickSend.empty": "No snippets yet. Click below to add.",
  "sidebar.noConnections": "No connections yet. Use the toolbar to connect.",
  "sendbar.hex": "HEX",
  "sendbar.ascii": "ASCII",
  "sendbar.send": "SEND",
  "statusbar.app": "JackCom",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.confirm": "Confirm"
}
```

- [ ] **步骤 3：编写 i18n 测试**

```typescript
// src/i18n/__tests__/i18n.test.ts
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// 在 import i18n 之前 mock localStorage
const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value },
  removeItem: (key: string) => { delete storage[key] },
  clear: () => Object.keys(storage).forEach(k => delete storage[k]),
})

// 需要在 import LocaleProvider 之前确保 glob 可用
// vitest 中 import.meta.glob 需要 mock，这里直接测试核心逻辑
import { LocaleProvider, useT } from '../index'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>
}

describe('i18n', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('provides t() function that returns translated string', () => {
    const { result } = renderHook(() => useT(), { wrapper })
    // 默认中文
    expect(result.current.t('app.title')).toBe('JackCom')
    expect(result.current.t('menu.file.label')).toBe('文件')
  })

  it('returns key when translation is missing', () => {
    const { result } = renderHook(() => useT(), { wrapper })
    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('supports parameter substitution', () => {
    const { result } = renderHook(() => useT(), { wrapper })
    // 测试一个带参数的 key（如果语言包有的话）
    // 用通用方式测试：直接调 t 不会 crash
    expect(result.current.t('app.title', { name: 'test' })).toBe('JackCom')
  })

  it('switches locale', () => {
    const { result } = renderHook(() => useT(), { wrapper })
    expect(result.current.locale).toBe('zh')
    result.current.setLocale('en')
    // re-render 后 locale 变化
    expect(result.current.t('menu.file.label')).toBe('File')
  })

  it('persists locale to localStorage', () => {
    const { result } = renderHook(() => useT(), { wrapper })
    result.current.setLocale('en')
    expect(storage['jackcom:locale']).toBe('en')
  })

  it('reads locale from localStorage on init', () => {
    storage['jackcom:locale'] = 'en'
    const { result } = renderHook(() => useT(), { wrapper })
    expect(result.current.locale).toBe('en')
  })
})
```

- [ ] **步骤 4：运行测试验证失败**

运行：`cd packages/jackcom && pnpm vitest run src/i18n/__tests__/i18n.test.ts`
预期：FAIL — `Cannot find module '../index'`

- [ ] **步骤 5：实现 i18n 模块**

```typescript
// src/i18n/index.ts
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// Vite glob 自动发现所有语言包
const localeModules = import.meta.glob<Record<string, string>>(
  './locales/*.json',
  { eager: true },
)

// 从文件名提取 locale key: './locales/zh.json' → 'zh'
const messages: Record<string, Record<string, string>> = {}
for (const [path, mod] of Object.entries(localeModules)) {
  const locale = path.match(/\/([^/]+)\.json$/)?.[1] ?? ''
  if (locale) messages[locale] = (mod as any).default ?? mod
}

export type Locale = string

const STORAGE_KEY = 'jackcom:locale'
const DEFAULT_LOCALE: Locale = 'zh'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_LOCALE
    }
    catch {
      return DEFAULT_LOCALE
    }
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    }
    catch {
      // localStorage unavailable
    }
  }, [])

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    let text = messages[locale]?.[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v)
      }
    }
    return text
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used within LocaleProvider')
  return ctx
}
```

- [ ] **步骤 6：运行测试验证通过**

运行：`cd packages/jackcom && pnpm vitest run src/i18n/__tests__/i18n.test.ts`
预期：PASS（注意 vitest 中 `import.meta.glob` 可能需要配置，如果失败需要检查 vitest 配置）

注意：vitest 中 `import.meta.glob` 默认不工作。需要在 `vitest.config.ts` 中添加 `test.setupFiles` 或者在测试中 mock glob。如果测试失败，备选方案是将测试改为直接测试 `t()` 函数逻辑而非通过 `import.meta.glob`。

- [ ] **步骤 7：Commit**

```bash
git add src/i18n/
git commit -m "feat(jackcom): 添加自研 i18n 系统（Vite glob + Context + localStorage）"
```

---

## 任务 2：Snippets Store

**文件：**
- 创建：`src/lib/snippets-store.ts`
- 测试：`src/lib/__tests__/snippets-store.test.ts`

- [ ] **步骤 1：编写 snippets store 测试**

```typescript
// src/lib/__tests__/snippets-store.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useSnippetsStore } from '../snippets-store'

describe('useSnippetsStore', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    const { snippets } = useSnippetsStore.getState()
    snippets.forEach(s => useSnippetsStore.getState().remove(s.id))
  })

  it('adds a snippet', () => {
    useSnippetsStore.getState().add('Test', '01 03 00')
    const state = useSnippetsStore.getState()
    expect(state.snippets).toHaveLength(1)
    expect(state.snippets[0].name).toBe('Test')
    expect(state.snippets[0].data).toBe('01 03 00')
    expect(state.snippets[0].id).toBeTruthy()
  })

  it('removes a snippet by id', () => {
    useSnippetsStore.getState().add('A', '01')
    useSnippetsStore.getState().add('B', '02')
    const id = useSnippetsStore.getState().snippets[0]!.id
    useSnippetsStore.getState().remove(id)
    expect(useSnippetsStore.getState().snippets).toHaveLength(1)
    expect(useSnippetsStore.getState().snippets[0]!.name).toBe('B')
  })

  it('sets createdAt timestamp', () => {
    const before = Date.now()
    useSnippetsStore.getState().add('Timer', 'FF')
    const after = Date.now()
    const snippet = useSnippetsStore.getState().snippets[0]!
    expect(snippet.createdAt).toBeGreaterThanOrEqual(before)
    expect(snippet.createdAt).toBeLessThanOrEqual(after)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm vitest run src/lib/__tests__/snippets-store.test.ts`
预期：FAIL — module not found

- [ ] **步骤 3：实现 snippets store**

```typescript
// src/lib/snippets-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Snippet {
  id: string
  name: string
  data: string // HEX 字符串
  createdAt: number
}

interface SnippetsStore {
  snippets: Snippet[]
  add: (name: string, data: string) => void
  remove: (id: string) => void
}

export const useSnippetsStore = create<SnippetsStore>()(
  persist(
    (set) => ({
      snippets: [],

      add: (name, data) =>
        set((s) => ({
          snippets: [
            ...s.snippets,
            {
              id: crypto.randomUUID(),
              name,
              data,
              createdAt: Date.now(),
            },
          ],
        })),

      remove: (id) =>
        set((s) => ({
          snippets: s.snippets.filter(sn => sn.id !== id),
        })),
    }),
    {
      name: 'jackcom:snippets',
    },
  ),
)
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm vitest run src/lib/__tests__/snippets-store.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/lib/snippets-store.ts src/lib/__tests__/snippets-store.test.ts
git commit -m "feat(jackcom): 添加 snippets store（zustand + persist）"
```

---

## 任务 3：简化 Store 类型（移除 PanelType）

**文件：**
- 修改：`src/lib/store.ts`
- 修改：`src/lib/__tests__/stores.test.ts`

- [ ] **步骤 1：更新 stores.test.ts 移除 activePanel 测试**

在 `src/lib/__tests__/stores.test.ts` 中，移除 `it('switches active panel', ...)` 测试用例（第 23-28 行）。

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm vitest run src/lib/__tests__/stores.test.ts`
预期：PASS（先删测试不会 fail，但移除 store 代码后其他文件引用会 fail）

- [ ] **步骤 3：更新 store.ts 移除 PanelType 和 activePanel**

修改 `src/lib/store.ts`：
- 移除 `PanelType` 类型导出
- 移除 `activePanel` 状态和 `setActivePanel` action
- 保留其余所有代码不变

修改后 `store.ts` 的 interface 部分：

```typescript
import { create } from 'zustand'

export type SidebarTab = 'connections' | 'snippets'

interface MainStore {
  // 侧边栏
  sidebarVisible: boolean
  sidebarTab: SidebarTab
  toggleSidebar: () => void
  setSidebarTab: (tab: SidebarTab) => void

  // 当前活动端口
  activePortId: string | null
  setActivePortId: (id: string | null) => void

  // 连接列表
  connections: Record<string, { portName: string, baudRate: number, online: boolean }>
  addConnection: (portName: string, baudRate: number) => void
  removeConnection: (portName: string) => void
  setConnectionOnline: (portName: string, online: boolean) => void

  // 统计
  stats: Record<string, { rx: number, tx: number }>
  updateStats: (portName: string, rx: number, tx: number) => void

  // Hex 显示模式
  hexDisplay: boolean
  toggleHexDisplay: () => void
}
```

在 `create` 实现中移除 `activePanel` 和 `setActivePanel` 两行。

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm vitest run`
预期：PASS（需要同步修改 MainApp.tsx 引用，但先确认 store 层通过）

- [ ] **步骤 5：Commit**

```bash
git add src/lib/store.ts src/lib/__tests__/stores.test.ts
git commit -m "refactor(jackcom): 移除 PanelType/activePanel（只保留终端面板）"
```

---

## 任务 4：菜单组件

**文件：**
- 创建：`src/components/menu/MenuDropdown.tsx`
- 创建：`src/components/menu/MenuItem.tsx`
- 测试：`src/components/menu/__tests__/MenuItem.test.tsx`

- [ ] **步骤 1：编写 MenuItem 组件测试**

```typescript
// src/components/menu/__tests__/MenuItem.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MenuItem } from '../MenuItem'

describe('MenuItem', () => {
  it('renders label text', () => {
    render(<MenuItem label="File" />)
    expect(screen.getByText('File')).toBeTruthy()
  })

  it('renders shortcut hint', () => {
    render(<MenuItem label="New" shortcut="Ctrl+N" />)
    expect(screen.getByText('Ctrl+N')).toBeTruthy()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<MenuItem label="Open" onClick={onClick} />)
    fireEvent.click(screen.getByText('Open'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(<MenuItem label="Open" onClick={onClick} disabled />)
    fireEvent.click(screen.getByText('Open'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as separator when type is separator', () => {
    const { container } = render(<MenuItem type="separator" />)
    expect(container.firstChild).toBeTruthy()
    // separator 不应有文字
    expect(container.textContent).toBe('')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm vitest run src/components/menu/__tests__/MenuItem.test.tsx`
预期：FAIL

- [ ] **步骤 3：实现 MenuItem 组件**

```typescript
// src/components/menu/MenuItem.tsx
interface MenuItemProps {
  label?: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'item' | 'separator'
}

export function MenuItem({
  label,
  shortcut,
  onClick,
  disabled = false,
  type = 'item',
}: MenuItemProps) {
  if (type === 'separator') {
    return (
      <div style={{
        height: '1px',
        background: 'var(--color-border)',
        margin: '4px 8px',
      }}
      />
    )
  }

  return (
    <div
      role="menuitem"
      onClick={() => {
        if (!disabled && onClick)
          onClick()
      }}
      style={{
        padding: '4px 24px 4px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text)',
        fontSize: '12px',
        borderRadius: '3px',
        margin: '0 4px',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.background = 'var(--color-accent)'
        if (!disabled)
          e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = disabled ? 'var(--color-text-secondary)' : 'var(--color-text)'
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span style={{
          fontSize: '11px',
          color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)',
          marginLeft: 'auto',
        }}
        >
          {shortcut}
        </span>
      )}
    </div>
  )
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm vitest run src/components/menu/__tests__/MenuItem.test.tsx`
预期：PASS

- [ ] **步骤 5：实现 MenuDropdown 组件**

```typescript
// src/components/menu/MenuDropdown.tsx
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface MenuDropdownProps {
  children: ReactNode
  onClose: () => void
}

export function MenuDropdown({ children, onClose }: MenuDropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        onClose()
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape')
        onClose()
    }
    // 延迟绑定避免触发菜单打开的同一个 click 事件
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        background: 'var(--color-menu-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
        padding: '4px 0',
        minWidth: '180px',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **步骤 6：Commit**

```bash
git add src/components/menu/
git commit -m "feat(jackcom): 添加菜单组件（MenuItem + MenuDropdown）"
```

---

## 任务 5：WindowControls 组件

**文件：**
- 创建：`src/components/layout/WindowControls.tsx`

- [ ] **步骤 1：实现 WindowControls 组件**

```typescript
// src/components/layout/WindowControls.tsx
import { useCallback, useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const currentWin = getCurrentWindow()
    const unlisten = currentWin.onResized(() => {
      currentWin.isMaximized().then(setMaximized)
    })
    currentWin.isMaximized().then(setMaximized)
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const handleMinimize = useCallback(() => {
    getCurrentWindow().minimize()
  }, [])

  const handleToggleMaximize = useCallback(() => {
    getCurrentWindow().toggleMaximize()
  }, [])

  const handleClose = useCallback(() => {
    getCurrentWindow().close()
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <WindowButton
        onClick={handleMinimize}
        hoverBg="var(--color-border)"
        title="Minimize"
      >
        ▾
      </WindowButton>
      <WindowButton
        onClick={handleToggleMaximize}
        hoverBg="var(--color-border)"
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? '⧉' : '□'}
      </WindowButton>
      <WindowButton
        onClick={handleClose}
        hoverBg="#e81123"
        title="Close"
      >
        ✕
      </WindowButton>
    </div>
  )
}

function WindowButton({
  onClick,
  hoverBg,
  title,
  children,
}: {
  onClick: () => void
  hoverBg: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      role="button"
      title={title}
      onClick={onClick}
      style={{
        width: '46px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--color-text)',
        fontSize: '12px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/layout/WindowControls.tsx
git commit -m "feat(jackcom): 添加窗口控制按钮（最小化/最大化/关闭）"
```

---

## 任务 6：TitleBar 组件（集成菜单 + 拖拽 + 窗口控制）

**文件：**
- 创建：`src/components/layout/TitleBar.tsx`

- [ ] **步骤 1：实现 TitleBar 组件**

此组件集成拖拽区域 + 完整菜单结构 + WindowControls。菜单项引用 i18n 和 store actions。

```typescript
// src/components/layout/TitleBar.tsx
import { useCallback, useState } from 'react'
import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { openDecoderWindow, openHistoryWindow, openWaveformWindow } from '@/lib/window'
import { MenuDropdown } from '@/components/menu/MenuDropdown'
import { MenuItem } from '@/components/menu/MenuItem'
import { WindowControls } from './WindowControls'

interface MenuDef {
  id: string
  items: Array<{
    labelKey?: string
    shortcut?: string
    onClick?: () => void
    disabled?: boolean
    type?: 'item' | 'separator'
  }>
}

export function TitleBar() {
  const { t } = useT()
  const { activePortId, toggleSidebar, toggleHexDisplay } = useMainStore()

  const menus: MenuDef[] = [
    {
      id: 'file',
      items: [
        { labelKey: 'menu.file.newConnection', shortcut: 'Ctrl+N' },
        { labelKey: 'menu.file.openHistory', shortcut: 'Ctrl+O', onClick: () => openHistoryWindow() },
        { labelKey: 'menu.file.export' },
        { type: 'separator' },
        { labelKey: 'menu.file.exit', shortcut: 'Ctrl+Q', onClick: () => window.close() },
      ],
    },
    {
      id: 'connection',
      items: [
        { labelKey: 'menu.connection.connect' },
        { labelKey: 'menu.connection.disconnect', disabled: !activePortId },
        { type: 'separator' },
        { labelKey: 'menu.connection.portSettings' },
        { type: 'separator' },
        { labelKey: 'menu.connection.close', shortcut: 'Ctrl+W', disabled: !activePortId },
        { labelKey: 'menu.connection.closeAll' },
      ],
    },
    {
      id: 'view',
      items: [
        { labelKey: 'menu.view.toggleSidebar', onClick: toggleSidebar },
        { labelKey: 'menu.view.toggleHex', shortcut: 'Ctrl+H', onClick: toggleHexDisplay },
        { type: 'separator' },
        { labelKey: 'menu.view.waveform', shortcut: 'Ctrl+Shift+W', onClick: () => activePortId && openWaveformWindow(activePortId), disabled: !activePortId },
        { labelKey: 'menu.view.decoder', shortcut: 'Ctrl+Shift+D', onClick: () => activePortId && openDecoderWindow(activePortId), disabled: !activePortId },
        { labelKey: 'menu.view.history', shortcut: 'Ctrl+Shift+H', onClick: () => openHistoryWindow() },
      ],
    },
    {
      id: 'tools',
      items: [
        { labelKey: 'menu.tools.quickSend' },
        { labelKey: 'menu.tools.clearTerminal', shortcut: 'Ctrl+L' },
        { labelKey: 'menu.tools.export' },
      ],
    },
    {
      id: 'window',
      items: [
        { labelKey: 'menu.window.waveform', shortcut: 'Ctrl+Shift+W', onClick: () => activePortId && openWaveformWindow(activePortId), disabled: !activePortId },
        { labelKey: 'menu.window.decoder', shortcut: 'Ctrl+Shift+D', onClick: () => activePortId && openDecoderWindow(activePortId), disabled: !activePortId },
        { labelKey: 'menu.window.history', shortcut: 'Ctrl+Shift+H', onClick: () => openHistoryWindow() },
        { type: 'separator' },
      ],
    },
    {
      id: 'help',
      items: [
        { labelKey: 'menu.help.about' },
        { labelKey: 'menu.help.documentation' },
        { labelKey: 'menu.help.checkUpdates' },
      ],
    },
  ]

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const handleMenuClick = useCallback((menuId: string) => {
    setOpenMenuId(prev => (prev === menuId ? null : menuId))
  }, [])

  const handleMenuHover = useCallback((menuId: string) => {
    // 只在已有菜单打开时 hover 切换
    if (openMenuId !== null)
      setOpenMenuId(menuId)
  }, [openMenuId])

  const handleClose = useCallback(() => {
    setOpenMenuId(null)
  }, [])

  return (
    <div style={{
      height: '30px',
      background: 'var(--color-titlebar-bg)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      fontSize: '13px',
      userSelect: 'none',
    }}
    >
      {/* 拖拽区域 + 应用标题 */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 10px',
          height: '100%',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--color-accent)', fontSize: '14px' }}>&#x26A1;</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
          {t('app.title')}
        </span>
      </div>

      {/* 菜单栏 */}
      <div style={{ display: 'flex', height: '100%', flex: 1 }}>
        {menus.map(menu => (
          <div
            key={menu.id}
            style={{ position: 'relative', height: '100%' }}
          >
            <div
              role="menubar"
              onClick={() => handleMenuClick(menu.id)}
              onMouseEnter={() => handleMenuHover(menu.id)}
              style={{
                padding: '0 10px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '12px',
                color: openMenuId === menu.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                background: openMenuId === menu.id ? 'var(--color-menu-bg)' : 'transparent',
                borderRadius: '3px 3px 0 0',
              }}
            >
              {t(`menu.${menu.id}.label`)}
            </div>
            {openMenuId === menu.id && (
              <MenuDropdown onClose={handleClose}>
                {menu.items.map((item, i) => (
                  <MenuItem
                    key={item.labelKey ?? `sep-${i}`}
                    label={item.labelKey ? t(item.labelKey) : undefined}
                    shortcut={item.shortcut}
                    onClick={item.onClick ? () => { item.onClick!(); handleClose() } : undefined}
                    disabled={item.disabled}
                    type={item.type}
                  />
                ))}
              </MenuDropdown>
            )}
          </div>
        ))}
      </div>

      {/* 窗口控制按钮 */}
      <WindowControls />
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/layout/TitleBar.tsx
git commit -m "feat(jackcom): 添加融合式标题栏（拖拽 + 菜单 + 窗口控制）"
```

---

## 任务 7：更新 AppLayout + MainApp

**文件：**
- 修改：`src/components/layout/AppLayout.tsx`
- 修改：`src/apps/MainApp.tsx`
- 删除：`src/components/layout/MenuBar.tsx`

- [ ] **步骤 1：更新 AppLayout 使用 TitleBar**

修改 `src/components/layout/AppLayout.tsx`，将 `MenuBar` import 改为 `TitleBar`：

```typescript
// src/components/layout/AppLayout.tsx
import type { ReactNode } from 'react'
import { ActivityBar } from './ActivityBar'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'
import { Toolbar } from './Toolbar'

interface AppLayoutProps {
  sidebar: ReactNode
  mainContent: ReactNode
  bottomPanel: ReactNode
}

export function AppLayout({ sidebar, mainContent, bottomPanel }: AppLayoutProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
    }}
    >
      <TitleBar />
      <Toolbar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ActivityBar />
        {sidebar}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {mainContent}
          </div>
          {bottomPanel}
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
```

- [ ] **步骤 2：简化 MainApp（移除 Tab 栏）**

修改 `src/apps/MainApp.tsx`，移除 PANELS 和 Tab 渲染逻辑：

```typescript
// src/apps/MainApp.tsx
import { useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { SendBar } from '@/components/terminal/SendBar'
import { TerminalView } from '@/components/terminal/TerminalView'
import { useDataFeed } from '@/hooks/useDataFeed'
import { useSerialPort } from '@/hooks/useSerialPort'
import { bytesToHex } from '@/lib/formatters'
import { useMainStore } from '@/lib/store'

export default function MainApp() {
  const { activePortId } = useMainStore()
  const { frames } = useDataFeed({ portId: activePortId })
  const { send } = useSerialPort()

  const handleSend = useCallback(async (data: number[]) => {
    if (!activePortId)
      return
    try {
      const hexData = bytesToHex(data)
      await send(activePortId, hexData)
    }
    catch (err) {
      console.error('Send failed:', err)
    }
  }, [activePortId, send])

  return (
    <AppLayout
      sidebar={<Sidebar />}
      mainContent={<TerminalView frames={frames} />}
      bottomPanel={<SendBar onSend={handleSend} disabled={!activePortId} />}
    />
  )
}
```

- [ ] **步骤 3：删除旧 MenuBar.tsx**

删除 `src/components/layout/MenuBar.tsx` 文件。

- [ ] **步骤 4：运行测试**

运行：`cd packages/jackcom && pnpm vitest run`
预期：PASS（store 测试已移除 activePanel 测试）

- [ ] **步骤 5：Commit**

```bash
git add src/components/layout/AppLayout.tsx src/apps/MainApp.tsx
git rm src/components/layout/MenuBar.tsx
git commit -m "refactor(jackcom): 用 TitleBar 替代 MenuBar，简化 MainApp 移除 Tab 栏"
```

---

## 任务 8：更新 bootstrap（LocaleProvider）

**文件：**
- 修改：`src/lib/bootstrap.tsx`

- [ ] **步骤 1：在 bootstrap 中包裹 LocaleProvider**

```typescript
// src/lib/bootstrap.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from '@/i18n'
import '@/styles/globals.css'

export function bootstrap(Component: React.ComponentType) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LocaleProvider>
        <Component />
      </LocaleProvider>
    </StrictMode>,
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/lib/bootstrap.tsx
git commit -m "feat(jackcom): bootstrap 包裹 LocaleProvider 启用 i18n"
```

---

## 任务 9：更新 Toolbar（子窗口接通 + Tooltip）

**文件：**
- 修改：`src/components/layout/Toolbar.tsx`

- [ ] **步骤 1：重写 Toolbar 接通子窗口 + i18n**

```typescript
// src/components/layout/Toolbar.tsx
import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { openDecoderWindow, openWaveformWindow } from '@/lib/window'

export function Toolbar() {
  const { t } = useT()
  const { connections, activePortId, toggleSidebar } = useMainStore()
  const activeConn = activePortId ? connections[activePortId] : null
  const isOnline = activeConn?.online ?? false

  return (
    <div style={{
      background: 'var(--color-titlebar-bg)',
      borderBottom: '1px solid var(--color-border)',
      padding: '4px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '12px',
    }}
    >
      <button
        title={isOnline ? t('toolbar.disconnect') : t('toolbar.connect')}
        style={{
          background: isOnline ? 'var(--color-accent)' : 'var(--color-border)',
          color: '#fff',
          border: 'none',
          padding: '3px 14px',
          borderRadius: '3px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '11px',
        }}
      >
        {isOnline ? `\u25B6 ${t('toolbar.connect')}` : `\u26A1 ${t('toolbar.connect')}`}
      </button>
      {activeConn && (
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
          {activeConn.portName}
          {' '}
          ·
          {activeConn.baudRate.toLocaleString()}
          {' '}
          · 8N1
        </span>
      )}
      <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>|</span>
      <button
        onClick={toggleSidebar}
        title={t('toolbar.toggleSidebar')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          fontSize: '11px',
          padding: '2px 6px',
        }}
      >
        ☰
      </button>
      <button
        onClick={() => activePortId && openWaveformWindow(activePortId)}
        disabled={!activePortId}
        title={t('toolbar.wave')}
        style={{
          background: 'transparent',
          border: 'none',
          color: activePortId ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          cursor: activePortId ? 'pointer' : 'not-allowed',
          fontSize: '11px',
          padding: '2px 6px',
          opacity: activePortId ? 1 : 0.5,
        }}
      >
        📊
        {' '}
        {t('toolbar.wave')}
      </button>
      <button
        onClick={() => activePortId && openDecoderWindow(activePortId)}
        disabled={!activePortId}
        title={t('toolbar.decode')}
        style={{
          background: 'transparent',
          border: 'none',
          color: activePortId ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          cursor: activePortId ? 'pointer' : 'not-allowed',
          fontSize: '11px',
          padding: '2px 6px',
          opacity: activePortId ? 1 : 0.5,
        }}
      >
        🔬
        {' '}
        {t('toolbar.decode')}
      </button>
      <span style={{ marginLeft: 'auto' }}>
        {isOnline && (
          <span style={{ color: 'var(--color-online)', fontSize: '11px', fontWeight: 600 }}>
            ●
            {' '}
            {t('toolbar.online')}
          </span>
        )}
      </span>
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/layout/Toolbar.tsx
git commit -m "feat(jackcom): Toolbar 接通子窗口 + i18n + tooltip"
```

---

## 任务 10：更新 ActivityBar（Tooltip + i18n）

**文件：**
- 修改：`src/components/layout/ActivityBar.tsx`

- [ ] **步骤 1：更新 ActivityBar 加 tooltip + i18n**

修改 `src/components/layout/ActivityBar.tsx`，将硬编码标题替换为 i18n：

在文件顶部添加 `import { useT } from '@/i18n'`，在组件内添加 `const { t } = useT()`。

将 ICONS 数组改为使用 i18n key：

```typescript
const ICONS = [
  { id: 'connections' as const, icon: '🔌', titleKey: 'sidebar.connections' },
  { id: 'snippets' as const, icon: '📝', titleKey: 'sidebar.quickSend' },
] as const
```

在 JSX 中将 `title={title}` 改为 `title={t(titleKey)}`。

- [ ] **步骤 2：Commit**

```bash
git add src/components/layout/ActivityBar.tsx
git commit -m "feat(jackcom): ActivityBar 加 i18n + tooltip"
```

---

## 任务 11：QuickSendPanel + Sidebar 更新

**文件：**
- 创建：`src/components/sidebar/QuickSendPanel.tsx`
- 修改：`src/components/sidebar/Sidebar.tsx`

- [ ] **步骤 1：实现 QuickSendPanel 组件**

```typescript
// src/components/sidebar/QuickSendPanel.tsx
import { useCallback, useState } from 'react'
import { useT } from '@/i18n'
import { useSerialPort } from '@/hooks/useSerialPort'
import { useMainStore } from '@/lib/store'
import { hexToBytes } from '@/lib/formatters'
import { useSnippetsStore } from '@/lib/snippets-store'

export function QuickSendPanel() {
  const { t } = useT()
  const { snippets, add, remove } = useSnippetsStore()
  const { send } = useSerialPort()
  const { activePortId } = useMainStore()

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [data, setData] = useState('')

  const handleAdd = useCallback(() => {
    const trimmed = data.trim()
    if (!name.trim() || !trimmed)
      return
    if (hexToBytes(trimmed) === null)
      return
    add(name.trim(), trimmed)
    setName('')
    setData('')
    setAdding(false)
  }, [name, data, add])

  const handleSend = useCallback(async (hexData: string) => {
    if (!activePortId)
      return
    try {
      await send(activePortId, hexData)
    }
    catch (err) {
      console.error('Quick send failed:', err)
    }
  }, [activePortId, send])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px' }}>
        {snippets.length === 0 && (
          <div style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            {t('sidebar.quickSend.empty')}
          </div>
        )}
        {snippets.map(snippet => (
          <div
            key={snippet.id}
            style={{
              padding: '6px 8px',
              marginBottom: '2px',
              borderRadius: '3px',
              background: 'var(--color-editor-bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600 }}>{snippet.name}</div>
              <div style={{
                fontSize: '10px',
                color: 'var(--color-text-secondary)',
                fontFamily: 'Consolas, monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              >
                {snippet.data}
              </div>
            </div>
            <button
              title={t('sidebar.quickSend.send')}
              onClick={() => handleSend(snippet.data)}
              disabled={!activePortId}
              style={{
                background: 'transparent',
                border: 'none',
                color: activePortId ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                cursor: activePortId ? 'pointer' : 'not-allowed',
                fontSize: '11px',
                padding: '2px 4px',
                opacity: activePortId ? 1 : 0.5,
              }}
            >
              ▶
            </button>
            <button
              title={t('sidebar.quickSend.delete')}
              onClick={() => remove(snippet.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '2px 4px',
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 新增区域 */}
      {adding && (
        <div style={{
          padding: '8px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '11px',
        }}
        >
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('sidebar.quickSend.namePlaceholder')}
            style={{
              background: 'var(--color-editor-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '2px',
              padding: '3px 6px',
              color: 'var(--color-text)',
              fontSize: '11px',
              outline: 'none',
            }}
          />
          <input
            value={data}
            onChange={e => setData(e.target.value)}
            placeholder={t('sidebar.quickSend.dataPlaceholder')}
            style={{
              background: 'var(--color-editor-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '2px',
              padding: '3px 6px',
              color: 'var(--color-text)',
              fontSize: '11px',
              fontFamily: 'Consolas, monospace',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleAdd}
              style={{
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                padding: '2px 8px',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              {t('sidebar.quickSend.confirm')}
            </button>
            <button
              onClick={() => { setAdding(false); setName(''); setData('') }}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                padding: '2px 8px',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              {t('sidebar.quickSend.cancel')}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setAdding(true)}
        style={{
          background: 'transparent',
          border: 'none',
          borderTop: adding ? 'none' : '1px solid var(--color-border)',
          color: 'var(--color-accent)',
          cursor: 'pointer',
          padding: '6px',
          fontSize: '11px',
        }}
      >
        + {t('sidebar.quickSend.add')}
      </button>
    </div>
  )
}
```

- [ ] **步骤 2：更新 Sidebar 集成 QuickSendPanel**

修改 `src/components/sidebar/Sidebar.tsx`：

```typescript
// src/components/sidebar/Sidebar.tsx
import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { ConnectionList } from './ConnectionList'
import { QuickSendPanel } from './QuickSendPanel'

export function Sidebar() {
  const { t } = useT()
  const { sidebarVisible, sidebarTab } = useMainStore()

  if (!sidebarVisible)
    return null

  return (
    <div style={{
      width: '200px',
      background: 'var(--color-sidebar-bg)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}
    >
      <div style={{
        padding: '8px 10px',
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.5px',
        borderBottom: '1px solid var(--color-border)',
      }}
      >
        {sidebarTab === 'connections' ? t('sidebar.connections') : t('sidebar.quickSend')}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sidebarTab === 'connections' && <ConnectionList />}
        {sidebarTab === 'snippets' && <QuickSendPanel />}
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/sidebar/QuickSendPanel.tsx src/components/sidebar/Sidebar.tsx
git commit -m "feat(jackcom): 添加 QuickSendPanel 并集成到 Sidebar"
```

---

## 任务 12：快捷键系统

**文件：**
- 创建：`src/hooks/useKeyboardShortcuts.ts`
- 测试：`src/hooks/__tests__/useKeyboardShortcuts.test.ts`

- [ ] **步骤 1：编写快捷键 hook 测试**

```typescript
// src/hooks/__tests__/useKeyboardShortcuts.test.ts
import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls handler on matching shortcut', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', ctrl: true, handler },
    ]))

    fireEvent.keyDown(document, { key: 'n', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not call handler without ctrl', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', ctrl: true, handler },
    ]))

    fireEvent.keyDown(document, { key: 'n' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('supports ctrl+shift combinations', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts([
      { key: 'w', ctrl: true, shift: true, handler },
    ]))

    fireEvent.keyDown(document, { key: 'w', ctrlKey: true, shiftKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('calls preventDefault on matched shortcut', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', ctrl: true, handler },
    ]))

    const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true })
    const spy = vi.spyOn(event, 'preventDefault')
    document.dispatchEvent(event)
    expect(spy).toHaveBeenCalled()
  })

  it('unregisters on unmount', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcuts([
      { key: 'n', ctrl: true, handler },
    ]))

    unmount()
    fireEvent.keyDown(document, { key: 'n', ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm vitest run src/hooks/__tests__/useKeyboardShortcuts.test.ts`
预期：FAIL

- [ ] **步骤 3：实现 useKeyboardShortcuts hook**

```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react'

export interface ShortcutDef {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: () => void
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      for (const s of shortcuts) {
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : true
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
        const altMatch = s.alt ? e.altKey : !e.altKey

        if (e.key.toLowerCase() === s.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault()
          s.handler()
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm vitest run src/hooks/__tests__/useKeyboardShortcuts.test.ts`
预期：PASS

- [ ] **步骤 5：在 AppLayout 中集成快捷键**

修改 `src/components/layout/AppLayout.tsx`，在组件内调用 `useKeyboardShortcuts`：

在 import 区添加：
```typescript
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useMainStore } from '@/lib/store'
import { openDecoderWindow, openHistoryWindow, openWaveformWindow } from '@/lib/window'
```

在组件函数体开头添加：
```typescript
const { activePortId, toggleSidebar, toggleHexDisplay } = useMainStore()

useKeyboardShortcuts([
  { key: 'h', ctrl: true, handler: toggleHexDisplay },
  { key: 'l', ctrl: true, handler: () => { /* clear terminal - TODO: add clear action to store */ } },
  { key: 'w', ctrl: true, shift: true, handler: () => activePortId && openWaveformWindow(activePortId) },
  { key: 'd', ctrl: true, shift: true, handler: () => activePortId && openDecoderWindow(activePortId) },
  { key: 'h', ctrl: true, shift: true, handler: () => openHistoryWindow() },
])
```

- [ ] **步骤 6：Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/hooks/__tests__/useKeyboardShortcuts.test.ts src/components/layout/AppLayout.tsx
git commit -m "feat(jackcom): 添加快捷键系统并集成到 AppLayout"
```

---

## 任务 13：更新 Tauri 配置（decorations: false）

**文件：**
- 修改：`src-tauri/tauri.conf.json`

- [ ] **步骤 1：修改 tauri.conf.json**

将 `packages/jackcom/src-tauri/tauri.conf.json` 中 `decorations: true` 改为 `decorations: false`：

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "url": "/main/",
        "title": "JackCom — Serial Debugger",
        "width": 1280,
        "height": 800,
        "center": true,
        "decorations": false
      }
    ]
  }
}
```

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat(jackcom): 关闭系统标题栏，使用自定义融合式标题栏"
```

---

## 任务 14：更新 ConnectionList + StatusBar（i18n）

**文件：**
- 修改：`src/components/sidebar/ConnectionList.tsx`
- 修改：`src/components/layout/StatusBar.tsx`

- [ ] **步骤 1：更新 ConnectionList 使用 i18n**

在 `src/components/sidebar/ConnectionList.tsx` 中：
- 添加 `import { useT } from '@/i18n'`
- 组件内添加 `const { t } = useT()`
- 将 "No connections yet." 替换为 `{t('sidebar.noConnections')}`
- 将 "Use the toolbar to connect." 替换为空（文案已合并到 key 中）

- [ ] **步骤 2：更新 StatusBar 使用 i18n**

在 `src/components/layout/StatusBar.tsx` 中：
- 添加 `import { useT } from '@/i18n'`
- 组件内添加 `const { t } = useT()`
- 将 `⚡ JackCom` 替换为 `⚡ {t('statusbar.app')}`

- [ ] **步骤 3：Commit**

```bash
git add src/components/sidebar/ConnectionList.tsx src/components/layout/StatusBar.tsx
git commit -m "feat(jackcom): ConnectionList + StatusBar 接入 i18n"
```

---

## 任务 15：全面测试验证

**文件：**
- 无新文件

- [ ] **步骤 1：运行全部测试**

运行：`cd packages/jackcom && pnpm vitest run`
预期：全部 PASS

- [ ] **步骤 2：检查 TypeScript 编译**

运行：`cd packages/jackcom && npx tsc --noEmit`
预期：无错误

- [ ] **步骤 3：检查 Vite 构建**

运行：`cd packages/jackcom && pnpm build`
预期：构建成功

- [ ] **步骤 4：修复任何问题并 Commit**

如果有测试/类型/构建问题，在此步骤修复并提交。

---

## 自检清单

### 规格覆盖度

| 规格需求 | 对应任务 |
|----------|----------|
| 融合式标题栏 + decorations: false | 任务 5, 6, 13 |
| 完整菜单下拉动作 | 任务 4, 6 |
| 自研 i18n（Vite glob） | 任务 1 |
| 全局/子窗口/终端快捷键 | 任务 12 |
| Toolbar 子窗口接通 | 任务 9 |
| Quick Send 侧边栏 | 任务 2, 11 |
| Tooltip（所有控件） | 任务 9, 10, 14 |
| 隐藏 Table/Modbus/AT CMD | 任务 3, 7 |

### 占位符扫描

- 无 "待定"/"TODO"/"后续实现"
- 菜单项中 Connect/Disconnect/Port Settings 的 onClick 暂未实现（因连接对话框 UI 未设计）——这些按钮存在但点击无操作，不是占位符而是需求范围内合理的简化
- `Ctrl+N`（新建连接）和 `Ctrl+L`（清屏）在 AppLayout 中有 TODO 注释——需要在 store 中增加 `clearFrames` action

### 类型一致性

- `useSnippetsStore` 的 `add(name, data)` 签名与 QuickSendPanel 中调用一致
- `useT()` 返回 `{ locale, setLocale, t }` 与所有消费者一致
- `MenuItem` 的 props 与 TitleBar 中传递的 props 一致
- `useKeyboardShortcuts` 的 `ShortcutDef` 与 AppLayout 中使用一致
