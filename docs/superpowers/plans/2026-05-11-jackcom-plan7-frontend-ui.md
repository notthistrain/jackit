# Plan 7: JackCom 前端 UI 组件

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**前置依赖：** Plan 1（项目骨架 + Astro 页面壳）已完成

**目标：** TDD 实现 JackCom 主窗口的 VS Code Dark+ 主题 UI 组件层，包括布局框架、终端视图、发送栏、侧边栏、工具栏、状态栏

**架构：**
- 所有 UI 组件使用 React 19 + TailwindCSS v4
- 颜色通过 CSS 变量定义在 `vscode-theme.css`，组件通过 `var(--color-xxx)` 引用
- 布局组件（MenuBar / Toolbar / Sidebar / StatusBar）是纯展示 + 事件回调，不直接调用 Tauri API
- TerminalView 使用 `@tanstack/react-virtual` 虚拟列表，数据存在 `useRef` 不触发渲染
- SendBar 包含 HexInput（本地状态 + blur 验证模式）
- 测试使用 vitest + @testing-library/react

**技术栈：** React 19、TailwindCSS v4、@tanstack/react-virtual、vitest、@testing-library/react

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 创建 | `src/styles/vscode-theme.css` | VS Code Dark+ 色板 CSS 变量 |
| 创建 | `src/lib/formatters.ts` | HEX/ASCII/时间戳格式化工具 |
| 创建 | `src/lib/store.ts` | Zustand 主窗口 store |
| 创建 | `src/components/layout/AppLayout.tsx` | 主窗口整体布局 |
| 创建 | `src/components/layout/MenuBar.tsx` | 菜单栏 |
| 创建 | `src/components/layout/Toolbar.tsx` | 工具栏 |
| 创建 | `src/components/layout/StatusBar.tsx` | 状态栏 |
| 创建 | `src/components/layout/ActivityBar.tsx` | 活动栏（左侧图标列） |
| 创建 | `src/components/sidebar/Sidebar.tsx` | 侧边栏容器 |
| 创建 | `src/components/sidebar/ConnectionList.tsx` | 连接列表 |
| 创建 | `src/components/terminal/TerminalView.tsx` | 终端虚拟列表 |
| 创建 | `src/components/terminal/TerminalLine.tsx` | 单行数据渲染 |
| 创建 | `src/components/terminal/SendBar.tsx` | 发送栏 + HexInput |

---

### 任务 1：VS Code 主题 + 格式化工具 + Store

**文件：**
- 创建：`packages/jackcom/src/styles/vscode-theme.css`
- 创建：`packages/jackcom/src/lib/formatters.ts`
- 创建：`packages/jackcom/src/lib/store.ts`
- 修改：`packages/jackcom/src/styles/globals.css`

- [ ] **步骤 1：创建 vscode-theme.css — VS Code Dark+ 色板变量**

```css
:root {
  /* 主强调色 */
  --color-accent: #007ACC;
  --color-accent-hover: #1E8AD2;

  /* 数据类型色 */
  --color-rx: #4EC9B0;
  --color-tx: #569CD6;
  --color-timestamp: #6A9955;
  --color-string: #CE9178;
  --color-control: #C586C0;

  /* 背景色 */
  --color-editor-bg: #1E1E1E;
  --color-sidebar-bg: #252526;
  --color-menu-bg: #2D2D2D;
  --color-titlebar-bg: #323233;
  --color-border: #3C3C3C;

  /* 文字色 */
  --color-text: #D4D4D4;
  --color-text-secondary: #858585;

  /* 状态色 */
  --color-online: #4EC9B0;
  --color-error: #F44747;
  --color-warning: #F0C040;
}
```

- [ ] **步骤 2：更新 globals.css 引入主题**

```css
@import "tailwindcss";
@import "./vscode-theme.css";

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: var(--color-editor-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow: hidden;
  user-select: none;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-editor-bg);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}
```

- [ ] **步骤 3：创建 lib/formatters.ts — 格式化工具函数**

```typescript
/**
 * 字节数组 → HEX 字符串
 * [0x01, 0x03, 0x00] → "01 03 00"
 */
export function bytesToHex(data: number[] | Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}

/**
 * 字节数组 → ASCII（不可见字符替换为 '.'）
 */
export function bytesToAscii(data: number[] | Uint8Array): string {
  return Array.from(data)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
    .join('')
}

/**
 * HEX 字符串 → 字节数组
 * "01 03 AB" → [0x01, 0x03, 0xAB]
 * 支持空格分隔或连续输入
 */
export function hexToBytes(hex: string): number[] | null {
  const cleaned = hex.replace(/\s+/g, '')
  if (cleaned.length === 0) return []
  if (cleaned.length % 2 !== 0) return null
  if (!/^[0-9A-Fa-f]*$/.test(cleaned)) return null

  const bytes: number[] = []
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(parseInt(cleaned.substring(i, i + 2), 16))
  }
  return bytes
}

/**
 * 格式化时间戳（ISO → HH:MM:SS.mmm）
 */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  const ms = d.getMilliseconds().toString().padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

/**
 * 格式化字节数（人性化）
 * 12847 → "12.6KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * 波特率格式化
 */
export function formatBaudRate(rate: number): string {
  return rate.toLocaleString()
}
```

- [ ] **步骤 4：创建 formatters 测试**

创建 `packages/jackcom/src/lib/__tests__/formatters.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import {
  bytesToHex,
  bytesToAscii,
  hexToBytes,
  formatTimestamp,
  formatBytes,
  formatBaudRate,
} from '../formatters'

describe('bytesToHex', () => {
  it('converts byte array to hex string', () => {
    expect(bytesToHex([0x01, 0x03, 0x00, 0x0a])).toBe('01 03 00 0A')
  })

  it('handles empty array', () => {
    expect(bytesToHex([])).toBe('')
  })

  it('handles single byte', () => {
    expect(bytesToHex([0xff])).toBe('FF')
  })
})

describe('bytesToAscii', () => {
  it('converts printable bytes to ASCII', () => {
    expect(bytesToAscii([0x48, 0x65, 0x6c, 0x6c, 0x6f])).toBe('Hello')
  })

  it('replaces non-printable bytes with dot', () => {
    expect(bytesToAscii([0x01, 0x02, 0x48, 0x69])).toBe('..Hi')
  })

  it('handles empty array', () => {
    expect(bytesToAscii([])).toBe('')
  })
})

describe('hexToBytes', () => {
  it('converts hex string to bytes', () => {
    expect(hexToBytes('01 03 AB')).toEqual([0x01, 0x03, 0xab])
  })

  it('handles continuous hex', () => {
    expect(hexToBytes('0103AB')).toEqual([0x01, 0x03, 0xab])
  })

  it('handles empty string', () => {
    expect(hexToBytes('')).toEqual([])
  })

  it('returns null for odd length', () => {
    expect(hexToBytes('ABC')).toBeNull()
  })

  it('returns null for invalid chars', () => {
    expect(hexToBytes('GG')).toBeNull()
  })

  it('is case insensitive', () => {
    expect(hexToBytes('aabbCC')).toEqual([0xaa, 0xbb, 0xcc])
  })
})

describe('formatTimestamp', () => {
  it('formats ISO string to HH:MM:SS.mmm', () => {
    const iso = '2026-05-11T14:23:01.234Z'
    // 注意：时区依赖，使用 UTC 时间
    const result = formatTimestamp(iso)
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/)
  })
})

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(12847)).toBe('12.5KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1500000)).toBe('1.4MB')
  })
})

describe('formatBaudRate', () => {
  it('formats with comma', () => {
    expect(formatBaudRate(115200)).toBe('115,200')
  })

  it('formats small numbers', () => {
    expect(formatBaudRate(9600)).toBe('9,600')
  })
})
```

- [ ] **步骤 5：创建 lib/store.ts — Zustand 主窗口 store**

```typescript
import { create } from 'zustand'

export type PanelType = 'terminal' | 'table' | 'modbus' | 'atcmd'
export type SidebarTab = 'connections' | 'snippets'

interface MainStore {
  // 侧边栏
  sidebarVisible: boolean
  sidebarTab: SidebarTab
  toggleSidebar: () => void
  setSidebarTab: (tab: SidebarTab) => void

  // 面板
  activePanel: PanelType
  setActivePanel: (panel: PanelType) => void

  // 当前活动端口
  activePortId: string | null
  setActivePortId: (id: string | null) => void

  // 连接列表
  connections: Record<string, { portName: string; baudRate: number; online: boolean }>
  addConnection: (portName: string, baudRate: number) => void
  removeConnection: (portName: string) => void
  setConnectionOnline: (portName: string, online: boolean) => void

  // 统计
  stats: Record<string, { rx: number; tx: number }>
  updateStats: (portName: string, rx: number, tx: number) => void

  // Hex 显示模式
  hexDisplay: boolean
  toggleHexDisplay: () => void
}

export const useMainStore = create<MainStore>((set) => ({
  sidebarVisible: true,
  sidebarTab: 'connections',
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  activePanel: 'terminal',
  setActivePanel: (panel) => set({ activePanel: panel }),

  activePortId: null,
  setActivePortId: (id) => set({ activePortId: id }),

  connections: {},
  addConnection: (portName, baudRate) =>
    set((s) => ({
      connections: { ...s.connections, [portName]: { portName, baudRate, online: true } },
      activePortId: s.activePortId ?? portName,
    })),
  removeConnection: (portName) =>
    set((s) => {
      const { [portName]: _, ...rest } = s.connections
      return {
        connections: rest,
        activePortId: s.activePortId === portName
          ? Object.keys(rest)[0] ?? null
          : s.activePortId,
      }
    }),
  setConnectionOnline: (portName, online) =>
    set((s) => ({
      connections: {
        ...s.connections,
        [portName]: { ...s.connections[portName], online },
      },
    })),

  stats: {},
  updateStats: (portName, rx, tx) =>
    set((s) => ({ stats: { ...s.stats, [portName]: { rx, tx } } })),

  hexDisplay: true,
  toggleHexDisplay: () => set((s) => ({ hexDisplay: !s.hexDisplay })),
}))
```

- [ ] **步骤 6：运行测试**

```bash
cd packages/jackcom && pnpm test -- --reporter=verbose
```

预期：formatters 的 14 个测试全部 PASS。

- [ ] **步骤 7：验证 Astro 构建**

```bash
cd packages/jackcom && pnpm build
```

- [ ] **步骤 8：Commit**

```bash
git add packages/jackcom/src/
git commit -m "feat(jackcom): add VS Code theme, formatters, and main store"
```

---

### 任务 2：布局框架组件（MenuBar / Toolbar / StatusBar / ActivityBar）

**文件：**
- 创建：`packages/jackcom/src/components/layout/AppLayout.tsx`
- 创建：`packages/jackcom/src/components/layout/MenuBar.tsx`
- 创建：`packages/jackcom/src/components/layout/Toolbar.tsx`
- 创建：`packages/jackcom/src/components/layout/StatusBar.tsx`
- 创建：`packages/jackcom/src/components/layout/ActivityBar.tsx`

- [ ] **步骤 1：创建 AppLayout.tsx — 主窗口整体布局**

```tsx
import { type ReactNode } from 'react'
import { MenuBar } from './MenuBar'
import { Toolbar } from './Toolbar'
import { ActivityBar } from './ActivityBar'
import { StatusBar } from './StatusBar'

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
    }}>
      <MenuBar />
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

- [ ] **步骤 2：创建 MenuBar.tsx**

```tsx
const MENU_ITEMS = ['File', 'Connection', 'View', 'Tools', 'Window', 'Help'] as const

export function MenuBar() {
  return (
    <div style={{
      background: 'var(--color-menu-bg)',
      borderBottom: '1px solid var(--color-border)',
      padding: '2px 8px',
      display: 'flex',
      gap: 0,
      fontSize: '13px',
    }}>
      {MENU_ITEMS.map((item) => (
        <div
          key={item}
          style={{
            color: 'var(--color-text)',
            padding: '3px 10px',
            cursor: 'pointer',
            borderRadius: '3px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-border)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **步骤 3：创建 Toolbar.tsx**

```tsx
import { useMainStore } from '@/lib/store'

export function Toolbar() {
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
    }}>
      <button
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
        {isOnline ? '▶ Connected' : '⚡ Connect'}
      </button>
      {activeConn && (
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
          {activeConn.portName} · {activeConn.baudRate.toLocaleString()} · 8N1
        </span>
      )}
      <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>|</span>
      <button
        onClick={toggleSidebar}
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
      <button style={{
        background: 'transparent', border: 'none',
        color: 'var(--color-accent)', cursor: 'pointer', fontSize: '11px', padding: '2px 6px',
      }}>
        📊 Wave
      </button>
      <button style={{
        background: 'transparent', border: 'none',
        color: 'var(--color-accent)', cursor: 'pointer', fontSize: '11px', padding: '2px 6px',
      }}>
        🔬 Decode
      </button>
      <span style={{ marginLeft: 'auto' }}>
        {isOnline && (
          <span style={{ color: 'var(--color-online)', fontSize: '11px', fontWeight: 600 }}>
            ● Online
          </span>
        )}
      </span>
    </div>
  )
}
```

- [ ] **步骤 4：创建 StatusBar.tsx**

```tsx
import { useMainStore } from '@/lib/store'
import { formatBytes } from '@/lib/formatters'

export function StatusBar() {
  const { connections, activePortId, stats } = useMainStore()
  const activeConn = activePortId ? connections[activePortId] : null
  const portStats = activePortId ? stats[activePortId] : null

  return (
    <div style={{
      background: 'var(--color-accent)',
      padding: '2px 12px',
      display: 'flex',
      gap: '16px',
      fontSize: '11px',
      color: '#fff',
    }}>
      <span>⚡ JackCom</span>
      {activeConn && (
        <>
          <span>{activeConn.portName}</span>
          {portStats && (
            <span style={{ marginLeft: 'auto' }}>
              RX: {formatBytes(portStats.rx)} | TX: {formatBytes(portStats.tx)}
            </span>
          )}
        </>
      )}
      <span style={{ marginLeft: portStats ? 0 : 'auto' }}>UTF-8 · 8N1</span>
    </div>
  )
}
```

- [ ] **步骤 5：创建 ActivityBar.tsx**

```tsx
import { useMainStore } from '@/lib/store'

const ICONS = [
  { id: 'connections' as const, icon: '🔌', title: 'Connections' },
  { id: 'snippets' as const, icon: '📝', title: 'Quick Send' },
] as const

export function ActivityBar() {
  const { sidebarTab, setSidebarTab, sidebarVisible, toggleSidebar } = useMainStore()

  return (
    <div style={{
      width: '40px',
      background: 'var(--color-titlebar-bg)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '4px',
      gap: '2px',
    }}>
      {ICONS.map(({ id, icon, title }) => (
        <div
          key={id}
          title={title}
          onClick={() => {
            if (sidebarTab === id && sidebarVisible) {
              toggleSidebar()
            } else {
              setSidebarTab(id)
              if (!sidebarVisible) toggleSidebar()
            }
          }}
          style={{
            fontSize: '18px',
            padding: '6px',
            cursor: 'pointer',
            borderLeft: sidebarVisible && sidebarTab === id
              ? '2px solid var(--color-accent)'
              : '2px solid transparent',
            opacity: sidebarVisible && sidebarTab === id ? 1 : 0.6,
          }}
        >
          {icon}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **步骤 6：验证 Astro 构建**

```bash
cd packages/jackcom && pnpm build
```

- [ ] **步骤 7：Commit**

```bash
git add packages/jackcom/src/components/
git commit -m "feat(jackcom): add layout components (MenuBar, Toolbar, StatusBar, ActivityBar)"
```

---

### 任务 3：侧边栏组件（Sidebar / ConnectionList）

**文件：**
- 创建：`packages/jackcom/src/components/sidebar/Sidebar.tsx`
- 创建：`packages/jackcom/src/components/sidebar/ConnectionList.tsx`

- [ ] **步骤 1：创建 Sidebar.tsx**

```tsx
import { useMainStore } from '@/lib/store'
import { ConnectionList } from './ConnectionList'

export function Sidebar() {
  const { sidebarVisible, sidebarTab } = useMainStore()

  if (!sidebarVisible) return null

  return (
    <div style={{
      width: '200px',
      background: 'var(--color-sidebar-bg)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 10px',
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.5px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {sidebarTab === 'connections' ? 'CONNECTIONS' : 'QUICK SEND'}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sidebarTab === 'connections' && <ConnectionList />}
        {sidebarTab === 'snippets' && (
          <div style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            Quick send snippets will appear here
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：创建 ConnectionList.tsx**

```tsx
import { useMainStore } from '@/lib/store'

export function ConnectionList() {
  const { connections, activePortId, setActivePortId } = useMainStore()
  const connList = Object.values(connections)

  if (connList.length === 0) {
    return (
      <div style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
        No connections yet.
        <br />
        Use the toolbar to connect.
      </div>
    )
  }

  return (
    <div style={{ padding: '4px' }}>
      {connList.map((conn) => (
        <div
          key={conn.portName}
          onClick={() => setActivePortId(conn.portName)}
          style={{
            padding: '6px 8px',
            marginBottom: '2px',
            borderRadius: '3px',
            cursor: 'pointer',
            background: activePortId === conn.portName
              ? 'var(--color-border)'
              : 'transparent',
            borderLeft: conn.online
              ? '3px solid var(--color-online)'
              : '3px solid transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              color: conn.online ? 'var(--color-online)' : 'var(--color-text-secondary)',
              fontSize: '8px',
            }}>
              {conn.online ? '●' : '○'}
            </span>
            <span style={{ fontWeight: 600, fontSize: '12px' }}>{conn.portName}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)', fontSize: '10px' }}>
              {conn.baudRate.toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **步骤 3：验证构建**

```bash
cd packages/jackcom && pnpm build
```

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src/components/sidebar/
git commit -m "feat(jackcom): add Sidebar and ConnectionList components"
```

---

### 任务 4：终端视图 + 发送栏（TerminalView / TerminalLine / SendBar）

**文件：**
- 创建：`packages/jackcom/src/components/terminal/TerminalView.tsx`
- 创建：`packages/jackcom/src/components/terminal/TerminalLine.tsx`
- 创建：`packages/jackcom/src/components/terminal/SendBar.tsx`

- [ ] **步骤 1：创建 TerminalLine.tsx — 单行数据渲染**

```tsx
import { bytesToHex, bytesToAscii, formatTimestamp } from '@/lib/formatters'

export interface DisplayFrame {
  id: number
  timestamp: string
  direction: 'rx' | 'tx'
  raw_hex: string
  formatted: string
  protocol: string
  summary: string
}

interface TerminalLineProps {
  frame: DisplayFrame
  hexMode: boolean
}

export function TerminalLine({ frame, hexMode }: TerminalLineProps) {
  const isRx = frame.direction === 'rx'
  const dirColor = isRx ? 'var(--color-rx)' : 'var(--color-tx)'
  const dirLabel = isRx ? 'RX' : 'TX'
  const timeStr = formatTimestamp(frame.timestamp)

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '1px 6px',
      fontSize: '12px',
      fontFamily: "'Consolas', 'Courier New', monospace",
      lineHeight: '1.5',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: 'var(--color-timestamp)', minWidth: '100px' }}>{timeStr}</span>
      <span style={{ color: dirColor, fontWeight: 700, minWidth: '20px' }}>{dirLabel}</span>
      <span style={{ color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {hexMode ? frame.raw_hex : bytesToAscii(frame.raw_hex.split(' ').map((h) => parseInt(h, 16)))}
      </span>
    </div>
  )
}
```

- [ ] **步骤 2：创建 TerminalView.tsx — 虚拟列表终端**

```tsx
import { useRef, useState, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TerminalLine, type DisplayFrame } from './TerminalLine'
import { useMainStore } from '@/lib/store'

interface TerminalViewProps {
  frames: DisplayFrame[]
}

export function TerminalView({ frames }: TerminalViewProps) {
  const hexDisplay = useMainStore((s) => s.hexDisplay)
  const parentRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const virtualizer = useVirtualizer({
    count: frames.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 20,
  })

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && frames.length > 0) {
      virtualizer.scrollToIndex(frames.length - 1, { align: 'end' })
    }
  }, [frames.length, autoScroll, virtualizer])

  const handleScroll = useCallback(() => {
    if (!parentRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30
    setAutoScroll(isAtBottom)
  }, [])

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--color-editor-bg)',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const frame = frames[virtualRow.index]
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TerminalLine frame={frame} hexMode={hexDisplay} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：创建 SendBar.tsx — 发送栏 + HexInput**

```tsx
import { useState, useCallback, useRef } from 'react'
import { hexToBytes, bytesToHex } from '@/lib/formatters'

type SendMode = 'hex' | 'ascii'
type LineEnding = 'none' | 'lf' | 'cr' | 'crlf'

interface SendBarProps {
  onSend: (data: number[]) => void
  disabled?: boolean
}

export function SendBar({ onSend, disabled }: SendBarProps) {
  const [mode, setMode] = useState<SendMode>('hex')
  const [lineEnding, setLineEnding] = useState<LineEnding>('none')
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const lastValidHex = useRef('')

  const handleSend = useCallback(() => {
    if (disabled) return

    let bytes: number[] | null = null

    if (mode === 'hex') {
      bytes = hexToBytes(input)
      if (bytes === null) {
        setError(true)
        return
      }
    } else {
      // ASCII 模式
      bytes = Array.from(input).map((c) => c.charCodeAt(0))
    }

    // 追加行结束符
    switch (lineEnding) {
      case 'lf':
        bytes.push(0x0a)
        break
      case 'cr':
        bytes.push(0x0d)
        break
      case 'crlf':
        bytes.push(0x0d, 0x0a)
        break
    }

    if (bytes.length > 0) {
      onSend(bytes)
    }
  }, [input, mode, lineEnding, disabled, onSend])

  const handleBlur = useCallback(() => {
    if (mode === 'hex') {
      const result = hexToBytes(input)
      if (result === null) {
        // 恢复上一次合法值
        setInput(lastValidHex.current)
        setError(false)
      } else {
        lastValidHex.current = input
        setError(false)
      }
    }
  }, [input, mode])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div style={{
      background: 'var(--color-sidebar-bg)',
      borderTop: '1px solid var(--color-border)',
      padding: '6px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      {/* 选项行 */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px' }}>
        <button
          onClick={() => setMode('hex')}
          style={{
            background: mode === 'hex' ? 'var(--color-accent)' : 'transparent',
            color: mode === 'hex' ? '#fff' : 'var(--color-text-secondary)',
            border: 'none',
            padding: '1px 6px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '10px',
          }}
        >
          HEX
        </button>
        <button
          onClick={() => setMode('ascii')}
          style={{
            background: mode === 'ascii' ? 'var(--color-accent)' : 'transparent',
            color: mode === 'ascii' ? '#fff' : 'var(--color-text-secondary)',
            border: 'none',
            padding: '1px 6px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          ASCII
        </button>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        {(['none', 'lf', 'cr', 'crlf'] as LineEnding[]).map((le) => (
          <button
            key={le}
            onClick={() => setLineEnding(le)}
            style={{
              background: lineEnding === le ? 'var(--color-border)' : 'transparent',
              color: lineEnding === le ? 'var(--color-text)' : 'var(--color-text-secondary)',
              border: 'none',
              padding: '1px 4px',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '10px',
            }}
          >
            +{le.toUpperCase()}
          </button>
        ))}
      </div>
      {/* 输入行 */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (mode === 'hex') {
              setError(hexToBytes(e.target.value) === null && e.target.value.length > 0)
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'hex' ? '01 03 00 00 00 0A C5 CD' : 'AT+RST'}
          disabled={disabled}
          style={{
            flex: 1,
            background: 'var(--color-editor-bg)',
            border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
            borderRadius: '3px',
            padding: '4px 8px',
            color: 'var(--color-text)',
            fontFamily: "'Consolas', monospace",
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled}
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            padding: '4px 20px',
            borderRadius: '3px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '11px',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          SEND
        </button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 4：创建 SendBar 测试**

创建 `packages/jackcom/src/components/terminal/__tests__/SendBar.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SendBar } from '../SendBar'

describe('SendBar', () => {
  it('renders hex mode by default', () => {
    render(<SendBar onSend={vi.fn()} />)
    expect(screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')).toBeTruthy()
  })

  it('switches to ASCII mode', () => {
    render(<SendBar onSend={vi.fn()} />)
    const asciiBtn = screen.getByText('ASCII')
    fireEvent.click(asciiBtn)
    expect(screen.getByPlaceholderText('AT+RST')).toBeTruthy()
  })

  it('sends hex data on Enter', () => {
    const onSend = vi.fn()
    render(<SendBar onSend={onSend} />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    fireEvent.change(input, { target: { value: '01 03' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith([0x01, 0x03])
  })

  it('sends ASCII data', () => {
    const onSend = vi.fn()
    render(<SendBar onSend={onSend} />)
    fireEvent.click(screen.getByText('ASCII'))
    const input = screen.getByPlaceholderText('AT+RST')
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith([72, 101, 108, 108, 111])
  })

  it('shows error border for invalid hex', () => {
    render(<SendBar onSend={vi.fn()} />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    fireEvent.change(input, { target: { value: 'GG' } })
    // border color should change to error
    expect(input.style.borderColor).toBe('var(--color-error)')
  })

  it('adds line ending when selected', () => {
    const onSend = vi.fn()
    render(<SendBar onSend={onSend} />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    fireEvent.change(input, { target: { value: '01' } })
    fireEvent.click(screen.getByText('+CRLF'))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith([0x01, 0x0d, 0x0a])
  })

  it('disables input and button when disabled', () => {
    render(<SendBar onSend={vi.fn()} disabled />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    const sendBtn = screen.getByText('SEND')
    expect(input).toHaveProperty('disabled', true)
    expect(sendBtn).toHaveProperty('disabled', true)
  })

  it('does not send empty input', () => {
    const onSend = vi.fn()
    render(<SendBar onSend={onSend} />)
    const input = screen.getByPlaceholderText('01 03 00 00 00 0A C5 CD')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })
})
```

- [ ] **步骤 5：运行测试**

```bash
cd packages/jackcom && pnpm test -- --reporter=verbose
```

预期：SendBar 8 个测试 + formatters 14 个测试 = 22 个测试 PASS。

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src/components/terminal/
git commit -m "feat(jackcom): add TerminalView, TerminalLine, SendBar with HexInput"
```

---

### 任务 5：组装 MainApp + 面板 Tab 切换

**文件：**
- 修改：`packages/jackcom/src/apps/MainApp.tsx`

- [ ] **步骤 1：更新 MainApp.tsx 组装所有组件**

```tsx
import { useState, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TerminalView, type DisplayFrame } from '@/components/terminal/TerminalView'
import { SendBar } from '@/components/terminal/SendBar'
import { useMainStore } from '@/lib/store'

type PanelType = 'terminal' | 'table' | 'modbus' | 'atcmd'

const PANELS: { id: PanelType; label: string }[] = [
  { id: 'terminal', label: 'TERMINAL' },
  { id: 'table', label: 'TABLE' },
  { id: 'modbus', label: 'MODBUS' },
  { id: 'atcmd', label: 'AT CMD' },
]

export default function MainApp() {
  const { activePanel, setActivePanel } = useMainStore()
  const [frames, setFrames] = useState<DisplayFrame[]>([])

  const handleSend = useCallback((data: number[]) => {
    // TODO: 通过 Tauri invoke 发送数据（Plan 6 + Plan 8 集成）
    // 当前仅本地模拟 TX 回显
    const frame: DisplayFrame = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      direction: 'tx',
      raw_hex: data.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      formatted: '',
      protocol: 'raw',
      summary: '',
    }
    setFrames((prev) => [...prev, frame])
  }, [])

  return (
    <AppLayout
      sidebar={<Sidebar />}
      mainContent={
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Tab 栏 */}
          <div style={{
            display: 'flex',
            background: 'var(--color-sidebar-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            {PANELS.map((panel) => (
              <div
                key={panel.id}
                onClick={() => setActivePanel(panel.id)}
                style={{
                  padding: '6px 16px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  color: activePanel === panel.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontWeight: activePanel === panel.id ? 600 : 400,
                  borderBottom: activePanel === panel.id
                    ? '2px solid var(--color-accent)'
                    : '2px solid transparent',
                }}
              >
                {panel.label}
              </div>
            ))}
          </div>
          {/* 内容区 */}
          {activePanel === 'terminal' && <TerminalView frames={frames} />}
          {activePanel !== 'terminal' && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: '13px',
            }}>
              {activePanel.toUpperCase()} View — Coming Soon
            </div>
          )}
        </div>
      }
      bottomPanel={<SendBar onSend={handleSend} />}
    />
  )
}
```

- [ ] **步骤 2：验证 Astro 构建**

```bash
cd packages/jackcom && pnpm build
```

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src/apps/MainApp.tsx
git commit -m "feat(jackcom): assemble MainApp with layout, terminal, and send bar"
```

---

## 自检

**规格覆盖度：**
- ✅ VS Code Dark+ 主题色板（CSS 变量）
- ✅ MenuBar（File / Connection / View / Tools / Window / Help）
- ✅ Toolbar（连接/断开按钮 + 端口信息 + 子窗口按钮 + 在线状态）
- ✅ ActivityBar（连接/快速发送图标）
- ✅ Sidebar + ConnectionList（端口列表 + 在线状态）
- ✅ StatusBar（蓝色底，端口名 + 统计 + 编码信息）
- ✅ TerminalView（虚拟列表 + 自动滚动）
- ✅ TerminalLine（时间戳 + 方向 + HEX/ASCII 数据）
- ✅ SendBar（HEX/ASCII 模式切换 + 行结束符 + HexInput 验证）
- ✅ AppLayout（完整布局框架）
- ✅ Panel Tab 切换（Terminal / Table / Modbus / AT CMD）
- ✅ formatters 工具（bytesToHex / hexToBytes / formatTimestamp / formatBytes）
- ✅ Zustand store（sidebar / panel / connections / stats）

**占位符扫描：** 无 TODO/TBD（仅 MainApp 中有一个 TODO 注释表示 Tauri invoke 集成，这是 Plan 8 的范围）。

**类型一致性：**
- `DisplayFrame` 接口在 `TerminalLine.tsx` 定义，字段名与 Rust serde 输出一致（snake_case）
- Plan 8 的 `tauri-events.ts` 定义相同的 `DisplayFrame` 类型，集成时统一导入
- `useMainStore` 在 `store.ts` 定义，所有组件引用同一个 store
- CSS 变量名在 `vscode-theme.css` 定义，组件通过 `var(--color-xxx)` 引用
- `hexToBytes` / `bytesToHex` 等在 `formatters.ts` 定义，SendBar 测试验证其行为
