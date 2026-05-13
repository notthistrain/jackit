# JackCom UI 功能串联设计

日期：2026-05-13
状态：草案

## 概述

将 jackcom（Tauri 桌面串口调试器）的 UI 从占位符状态串联为功能完整的应用。核心工作包括：融合式自定义标题栏/菜单栏、i18n 国际化（自研轻量方案）、快捷键系统、Toolbar 子窗口接通、Quick Send 侧边栏。

## 范围

### 包含

- 融合式自定义标题栏 + 菜单栏（替代系统 decorations）
- 完整的菜单下拉动作（File/Connection/View/Tools/Window/Help）
- 自研轻量 i18n（中英双语，Context + JSON + localStorage）
- 全局/子窗口/终端快捷键系统
- Toolbar 按钮接通子窗口（Wave/Decode）
- Quick Send 侧边栏（CRUD + 发送）
- 所有控件加 Tooltip（走 i18n）
- 隐藏 Table/Modbus/AT CMD 占位面板

### 不包含

- Table/Modbus/AT CMD 面板实现（后续独立设计）
- Waveform Canvas 渲染实现（只确保通路）
- History 历史查询实现（只确保通路）
- 主题/皮肤系统

## 架构

### 组件层级（改造后）

```
AppLayout
├── TitleBar (新，替代 MenuBar)
│   ├── DragRegion (图标 + 标题)
│   ├── MenuBar (可点击展开下拉)
│   │   ├── MenuTrigger × 6
│   │   └── MenuDropdown × N
│   └── WindowControls (最小化/最大化/关闭)
├── Toolbar (改造，按钮接通)
├── <flex row>
│   ├── ActivityBar (改造，加 Tooltip)
│   ├── Sidebar
│   │   ├── ConnectionList
│   │   └── QuickSendPanel (新)
│   └── <flex column>
│       ├── TerminalView (唯一面板)
│       └── SendBar
└── StatusBar
```

### 新增文件

```
src/
├── i18n/
│   ├── index.ts              # LocaleProvider, useLocale, useT
│   └── locales/
│       ├── zh.json
│       └── en.json
├── components/
│   ├── layout/
│   │   ├── TitleBar.tsx       # 融合标题栏
│   │   └── WindowControls.tsx # 窗口控制按钮
│   ├── menu/
│   │   ├── MenuBar.tsx        # 菜单栏容器
│   │   ├── MenuTrigger.tsx    # 菜单触发器
│   │   ├── MenuDropdown.tsx   # 下拉菜单
│   │   └── MenuItem.tsx       # 菜单项
│   └── sidebar/
│       └── QuickSendPanel.tsx # 快捷发送面板
├── hooks/
│   └── useKeyboardShortcuts.ts
└── lib/
    └── snippets-store.ts     # Quick Send 状态（zustand + persist）
```

## 详细设计

### 1. 融合式标题栏

**Tauri 配置变更**：

```json
// tauri.conf.json
{
  "app": {
    "windows": [{
      "decorations": false
    }]
  }
}
```

**TitleBar 组件**：

- 高度 30px，深色背景
- 左侧：应用图标 + "JackCom" 标题，设 `data-tauri-drag-region`
- 中部：MenuBar（6 个菜单项，点击展开下拉）
- 右侧：窗口控制按钮（最小化 ▱、最大化 □/⧉、关闭 ×）
- 关闭按钮 hover 红色背景

**菜单下拉行为**：

- 点击菜单项展开下拉，再次点击或点击外部关闭
- 鼠标移到相邻菜单项时自动切换（像桌面应用菜单的行为）
- Esc 关闭当前下拉
- 菜单项支持：文字、快捷键提示、分隔线、disabled 状态、子菜单标记

**菜单结构**：

```
File
├── New Connection      Ctrl+N
├── Open History        Ctrl+O
├── Export Data...
├── ─────────────
└── Exit                Ctrl+Q

Connection
├── Connect...
├── Disconnect
├── ─────────────
├── Port Settings
├── ─────────────
├── Close Connection    Ctrl+W
└── Close All

View
├── Toggle Sidebar
├── Toggle Hex          Ctrl+H
├── ─────────────
├── Waveform Window     Ctrl+Shift+W
├── Decoder Window      Ctrl+Shift+D
├── History Window      Ctrl+Shift+H
├── ─────────────
└── Language
    ├── 中文
    └── English

Tools
├── Quick Send
├── Clear Terminal      Ctrl+L
└── Export...

Window
├── Waveform            Ctrl+Shift+W
├── Decoder             Ctrl+Shift+D
├── History             Ctrl+Shift+H
└── ─────────────

Help
├── About
├── Documentation
└── Check for Updates
```

### 2. 自研轻量 i18n

**语言包加载方式**：Vite `import.meta.glob`，编译时自动发现 `locales/*.json`，加新语言只需新增文件无需改代码。

```typescript
// src/i18n/index.ts
// 自动发现所有语言包，eager 模式直接打包进 bundle
const localeModules = import.meta.glob<Record<string, string>>(
  './locales/*.json',
  { eager: true }
)

// 从文件名提取 locale key: './locales/zh.json' → 'zh'
const messages: Record<string, Record<string, string>> = {}
for (const [path, mod] of Object.entries(localeModules)) {
  const locale = path.match(/\/([^/]+)\.json$/)?.[1] ?? ''
  if (locale) messages[locale] = mod.default ?? mod
}

type Locale = keyof typeof messages  // 自动推断支持的语言列表
```

**运行时 API**：

```typescript
// React Context 提供 locale + setLocale + t
const LocaleContext = React.createContext<{
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
}>(...)

// LocaleProvider 包裹应用顶层
// useT() hook 返回 t 函数
// locale 从 localStorage 读取，默认 'zh'
// t() 实现：messages[currentLocale][key] ?? key，支持 {param} 占位符替换
```

**关键设计点**：

- `import.meta.glob` + `eager: true` 等价于静态 import，无运行时网络请求
- 新增语言包只需在 `locales/` 下新增 `.json` 文件，`Locale` 类型自动扩展
- `t()` 函数同步查表，无 async/await

**语言包 key 命名规范**：

- `menu.{menuId}.{itemId}` — 菜单项
- `menu.{menuId}.{itemId}.tooltip` — 菜单提示
- `toolbar.{action}` — 工具栏
- `sidebar.{section}` — 侧边栏
- `shortcut.{action}` — 快捷键描述
- `common.{word}` — 通用词汇

**示例**（zh.json）：

```json
{
  "menu.file.label": "文件",
  "menu.file.newConnection": "新建连接",
  "menu.file.openHistory": "打开历史",
  "menu.file.export": "导出数据...",
  "menu.file.exit": "退出",
  "toolbar.connect": "连接",
  "toolbar.wave": "波形",
  "toolbar.decode": "解码",
  "sidebar.quickSend": "快捷发送",
  "sidebar.quickSend.add": "新增片段",
  "sidebar.quickSend.send": "发送",
  "common.cancel": "取消",
  "common.delete": "删除",
  "common.confirm": "确认"
}
```

### 3. 快捷键系统

**useKeyboardShortcuts hook**：

- 在 AppLayout 中调用，监听 `keydown` 事件
- 支持修饰键组合：`Ctrl`、`Ctrl+Shift`
- 返回 `{ register, unregister }` 供动态注册/注销
- 只在主窗口生效（通过 `window.location.pathname` 判断）

**快捷键映射**：

| 快捷键 | 动作 | 实现位置 |
|--------|------|----------|
| `Ctrl+N` | 打开新建连接对话框 | store action |
| `Ctrl+O` | 打开历史窗口 | `openHistoryWindow()` |
| `Ctrl+W` | 关闭当前连接 | store action |
| `Ctrl+Q` | 退出应用 | Tauri `app.exit()` |
| `Ctrl+Shift+W` | 波形窗口 | `openWaveformWindow()` |
| `Ctrl+Shift+D` | 解码窗口 | `openDecoderWindow()` |
| `Ctrl+Shift+H` | 历史窗口 | `openHistoryWindow()` |
| `Ctrl+L` | 清屏 | store action |
| `Ctrl+H` | HEX/ASCII 切换 | store action |
| `Ctrl+Enter` | 发送 | SendBar action |

### 4. Toolbar 串联

**变更**：

- Connect 按钮：保留现有连接逻辑
- Wave 按钮：调用 `openWaveformWindow(activePortId)`，无活跃端口时 disabled
- Decode 按钮：调用 `openDecoderWindow(activePortId)`，无活跃端口时 disabled
- Sidebar toggle 按钮：保留
- 所有按钮加 `title` 属性，文字走 i18n

### 5. Quick Send 侧边栏

**状态管理**：

```typescript
// src/lib/snippets-store.ts
interface Snippet {
  id: string
  name: string
  data: string    // HEX 字符串
  createdAt: number
}

interface SnippetsStore {
  snippets: Snippet[]
  add: (name: string, data: string) => void
  remove: (id: string) => void
}
```

- 使用 zustand `persist` 中间件，存储到 localStorage key `jackcom:snippets`

**QuickSendPanel 组件**：

- 列表展示所有片段（名称 + HEX 预览）
- 每个片段有发送按钮和删除按钮
- 底部有「新增片段」按钮，展开内联表单（名称输入 + HEX 输入 + 确认/取消）
- 无活跃连接时发送按钮 disabled

### 6. 隐藏占位面板

- MainApp 中移除 Tab 栏（PANELS 数组和 Tab 渲染）
- 直接渲染 TerminalView
- store 中 `PanelType` 简化为只保留 `'terminal'`（或直接移除，因为只有一个面板）
- activePanel 相关逻辑简化

## 数据流

```
用户操作（菜单/快捷键/按钮）
    │
    ├── Zustand Store ──── 状态变更 ──── 组件重渲染
    │
    ├── Tauri Command ──── 串口操作
    │
    ├── Tauri Event ────── 数据推送 ──── useDataFeed hook
    │
    └── Window API ─────── 子窗口管理 ── createOrFocusChildWindow
```

## 错误处理

- 菜单动作失败时（如连接失败）用 console.error + StatusBar 提示
- 子窗口创建失败用 console.error
- 快捷键冲突时 Ctrl+Q/Esc 等 stopPropagation

## 测试策略

- 组件测试：MenuBar 下拉行为、MenuItem 点击、QuickSendPanel CRUD
- Hook 测试：useKeyboardShortcuts 按键映射
- Store 测试：snippets-store persist
- i18n 测试：t() 函数参数替换、locale 切换
- 集成测试：Toolbar 按钮触发子窗口创建
