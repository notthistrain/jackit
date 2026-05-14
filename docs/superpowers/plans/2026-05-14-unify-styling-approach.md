# 统一样式方案实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 jackcom 和 admin 两个前端包的样式统一为 Tailwind 原子化 class + tailwind-variants (tv)，消除所有静态内联样式。

**架构：** jackcom 每个组件配套 `.variants.ts` 文件，用 `tv()` 定义 slots + variants。运行时状态用 `data-*` 属性 + CSS 选择器。语义变体用 tv variants 参数。admin 业务组件的内联样式直接转 Tailwind class。

**技术栈：** Tailwind CSS v4、tailwind-variants、clsx + tailwind-merge（cn 工具）

---

## 文件结构

### 新建文件

```
# 基础设施
packages/jackcom/src/lib/utils.ts                          # cn() 工具函数

# terminal/
packages/jackcom/src/components/terminal/terminal-line.variants.ts
packages/jackcom/src/components/terminal/send-bar.variants.ts
packages/jackcom/src/components/terminal/terminal-view.variants.ts

# connection/
packages/jackcom/src/components/connection/port-selector.variants.ts
packages/jackcom/src/components/connection/serial-config-form.variants.ts
packages/jackcom/src/components/connection/connection-dialog.variants.ts

# menu/
packages/jackcom/src/components/menu/menu-dropdown.variants.ts
packages/jackcom/src/components/menu/menu-item.variants.ts

# sidebar/
packages/jackcom/src/components/sidebar/sidebar.variants.ts
packages/jackcom/src/components/sidebar/connection-list.variants.ts
packages/jackcom/src/components/sidebar/quick-send-panel.variants.ts

# history/
packages/jackcom/src/components/history/filter-bar.variants.ts
packages/jackcom/src/components/history/frame-table.variants.ts
packages/jackcom/src/components/history/frame-detail.variants.ts
packages/jackcom/src/components/history/session-list.variants.ts

# layout/
packages/jackcom/src/components/layout/app-layout.variants.ts
packages/jackcom/src/components/layout/title-bar.variants.ts
packages/jackcom/src/components/layout/toolbar.variants.ts
packages/jackcom/src/components/layout/status-bar.variants.ts
packages/jackcom/src/components/layout/activity-bar.variants.ts
packages/jackcom/src/components/layout/window-controls.variants.ts

# waveform/
packages/jackcom/src/components/waveform/waveform-canvas.variants.ts
```

### 修改文件

```
# 基础设施
pnpm-workspace.yaml                                        # 添加 tailwind-variants 到 catalog
packages/jackcom/src/styles/vscode-theme.css               # :root 改为 @theme
packages/jackcom/src/styles/globals.css                    # 调整 import 顺序

# jackcom 所有 .tsx 组件（22 个）— 替换 style 为 className
# admin 所有含内联样式的业务组件（13 个）— 替换 style 为 Tailwind class
```

---

## 任务 1：基础设施

**文件：**
- 修改：`pnpm-workspace.yaml`
- 创建：`packages/jackcom/src/lib/utils.ts`
- 修改：`packages/jackcom/src/styles/vscode-theme.css`
- 修改：`packages/jackcom/src/styles/globals.css`

- [ ] **步骤 1：添加 tailwind-variants 到 monorepo catalog**

在 `pnpm-workspace.yaml` 的 catalog 部分添加：

```yaml
  tailwind-variants: "^1.0.0"
```

- [ ] **步骤 2：在 jackcom package.json 添加依赖**

在 `packages/jackcom/package.json` 的 dependencies 中添加：

```json
"tailwind-variants": "catalog:",
```

- [ ] **步骤 3：安装依赖**

运行：`cd D:/Project/upgrade-component && pnpm install`

- [ ] **步骤 4：创建 cn() 工具函数**

创建 `packages/jackcom/src/lib/utils.ts`：

```ts
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **步骤 5：将 CSS 变量迁移到 Tailwind @theme**

将 `packages/jackcom/src/styles/vscode-theme.css` 的 `:root` 块替换为 `@theme`：

```css
@theme {
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

确认 `globals.css` 的 import 顺序为：

```css
@import "tailwindcss";
@import "./vscode-theme.css";
```

- [ ] **步骤 6：验证构建**

运行：`cd packages/jackcom && pnpm build`
预期：构建成功，无错误

- [ ] **步骤 7：Commit**

```bash
git add pnpm-workspace.yaml packages/jackcom/src/lib/utils.ts packages/jackcom/src/styles/vscode-theme.css packages/jackcom/src/styles/globals.css packages/jackcom/package.json pnpm-lock.yaml
git commit -m "feat(jackcom): 添加 tailwind-variants、cn() 工具、@theme 主题映射"
```

---

## 任务 2：terminal/ 组件组

**文件：**
- 创建：`packages/jackcom/src/components/terminal/terminal-line.variants.ts`
- 创建：`packages/jackcom/src/components/terminal/send-bar.variants.ts`
- 创建：`packages/jackcom/src/components/terminal/terminal-view.variants.ts`
- 修改：`packages/jackcom/src/components/terminal/TerminalLine.tsx`
- 修改：`packages/jackcom/src/components/terminal/SendBar.tsx`
- 修改：`packages/jackcom/src/components/terminal/TerminalView.tsx`

- [ ] **步骤 1：创建 terminal-line.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const terminalLine = tv({
  slots: {
    root: 'flex gap-2 px-1.5 py-[1px] text-xs font-mono leading-6 whitespace-nowrap',
    timestamp: 'text-timestamp min-w-[100px]',
    direction: 'font-bold min-w-[20px]',
    data: 'text-text flex-1 overflow-hidden text-ellipsis',
  },
})
```

注意：`direction` 的颜色是动态的（RX/TX 不同），保留内联 `style={{ color: dirColor }}`。

- [ ] **步骤 2：迁移 TerminalLine.tsx**

组件修改要点：
- `import { terminalLine } from './terminal-line.variants'`
- 解构 `const { root, timestamp, direction, data } = terminalLine()`
- 根 div：`style={{...}}` → `className={root()}`
- timestamp span：`style={{...}}` → `className={timestamp()}`
- direction span：保留 `style={{ color: dirColor, fontWeight: 700, minWidth: '20px' }}` 改为 `className={direction()} style={{ color: dirColor }}`（fontWeight 和 minWidth 已在 tv 中）
- data span：`style={{...}}` → `className={data()}`

- [ ] **步骤 3：创建 send-bar.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const sendBar = tv({
  slots: {
    root: 'bg-sidebar-bg border-t border-border px-2.5 py-1.5 flex flex-col gap-1',
    optionsRow: 'flex gap-1.5 items-center text-[11px]',
    modeBtn: 'border-none px-1.5 py-[1px] rounded-sm cursor-pointer font-semibold text-[10px]',
    separator: 'text-border',
    lineEndingBtn: 'border-none px-1 py-[1px] rounded-sm cursor-pointer text-[10px]',
    inputRow: 'flex gap-1.5',
    input: 'flex-1 bg-editor-bg border rounded-sm px-2 py-1 text-text font-mono text-xs outline-none',
    sendBtn: 'bg-accent text-white border-none px-5 py-1 rounded-sm font-bold text-[11px]',
  },
  variants: {
    active: {
      true: { modeBtn: 'bg-accent text-white' },
      false: { modeBtn: 'bg-transparent text-text-secondary' },
    },
    lineEndingActive: {
      true: { lineEndingBtn: 'bg-border text-text' },
      false: { lineEndingBtn: 'bg-transparent text-text-secondary' },
    },
    error: {
      true: { input: 'border-error' },
      false: { input: 'border-border' },
    },
    disabled: {
      true: { sendBtn: 'cursor-not-allowed opacity-50' },
      false: { sendBtn: 'cursor-pointer opacity-100' },
    },
  },
})
```

- [ ] **步骤 4：迁移 SendBar.tsx**

组件修改要点：
- `import { sendBar } from './send-bar.variants'`
- 解构：`const { root, optionsRow, modeBtn, separator, lineEndingBtn, inputRow, input, sendBtn } = sendBar()`
- 根 div：`style={{...}}` → `className={root()}`
- HEX/ASCII 按钮：删除 style，使用 `className={modeBtn({ active: mode === 'hex' })}` 和 `className={modeBtn({ active: mode === 'ascii' })}`
- 分隔符 span：`style={{...}}` → `className={separator()}`
- +LE 按钮：删除 style，使用 `className={lineEndingBtn({ lineEndingActive: lineEnding === le })}`
- input：删除 style，使用 `className={input({ error })}`
- SEND 按钮：删除 style，使用 `className={sendBtn({ disabled })}`

- [ ] **步骤 5：创建 terminal-view.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const terminalView = tv({
  slots: {
    root: 'flex-1 overflow-auto bg-editor-bg relative',
    inner: 'w-full relative',
    row: 'absolute top-0 left-0 w-full',
  },
})
```

- [ ] **步骤 6：迁移 TerminalView.tsx**

组件修改要点：
- `import { terminalView } from './terminal-view.variants'`
- 解构 `const { root, inner, row } = terminalView()`
- 根 div：`style={{ flex: 1, overflow: 'auto', ... }}` → `className={root()}`
- inner div：保留 `style={{ height: virtualizer.getTotalSize() + 'px' }}`（动态值），添加 `className={inner()}`
- row div：保留 `style={{ transform: translateY(...) }}`（动态值），添加 `className={row()}`

- [ ] **步骤 7：运行测试验证**

运行：`cd packages/jackcom && pnpm test -- --run`
预期：所有测试通过

- [ ] **步骤 8：验证构建**

运行：`cd packages/jackcom && pnpm build`
预期：构建成功

- [ ] **步骤 9：Commit**

```bash
git add packages/jackcom/src/components/terminal/
git commit -m "refactor(jackcom): terminal 组件迁移到 tailwind-variants"
```

---

## 任务 3：connection/ 组件组

**文件：**
- 创建：`packages/jackcom/src/components/connection/port-selector.variants.ts`
- 创建：`packages/jackcom/src/components/connection/serial-config-form.variants.ts`
- 创建：`packages/jackcom/src/components/connection/connection-dialog.variants.ts`
- 修改：`packages/jackcom/src/components/connection/PortSelector.tsx`
- 修改：`packages/jackcom/src/components/connection/SerialConfigForm.tsx`
- 修改：`packages/jackcom/src/components/connection/ConnectionDialog.tsx`

- [ ] **步骤 1：创建 port-selector.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const portSelector = tv({
  slots: {
    root: 'flex flex-col gap-1',
    row: 'flex gap-1.5 items-center',
    select: 'flex-1 px-2 py-1 text-xs bg-editor-bg text-text border border-border rounded-sm outline-none',
    refreshBtn: 'px-2 py-1 text-[11px] bg-border text-text border border-border rounded-sm',
    error: 'text-[11px] text-error',
  },
  variants: {
    loading: {
      true: { refreshBtn: 'cursor-not-allowed opacity-50' },
      false: { refreshBtn: 'cursor-pointer opacity-100' },
    },
  },
})
```

- [ ] **步骤 2：迁移 PortSelector.tsx**

- `import { portSelector } from './port-selector.variants'`
- 解构 slots，按 variants 替换所有 style
- select 的 disabled 状态保留在 HTML disabled 属性
- refreshBtn 用 `refreshBtn({ loading })`
- error span：`className={error()}`

- [ ] **步骤 3：创建 serial-config-form.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const serialConfigForm = tv({
  slots: {
    row: 'flex items-center gap-2',
    label: 'text-[10px] text-text-secondary text-right w-[70px] shrink-0',
    select: 'flex-1 px-1.5 py-[3px] text-[11px] bg-[#3c3c3c] text-text border border-[#4c4c4c] rounded-sm outline-none',
    compactSelect: 'flex-1 px-1.5 py-[3px] text-[10px] bg-[#3c3c3c] text-text border border-[#4c4c4c] rounded-sm outline-none text-center',
    portRow: 'flex-1 flex gap-1',
  },
})
```

- [ ] **步骤 4：迁移 SerialConfigForm.tsx**

- 删除顶部的 `rowLabelStyle`、`selectStyle`、`compactSelectStyle` 常量
- `import { serialConfigForm } from './serial-config-form.variants'`
- 解构 slots，用 `className={row()}`、`className={label()}` 等替换 `style={rowLabelStyle}` 等

- [ ] **步骤 5：创建 connection-dialog.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const connectionDialog = tv({
  slots: {
    overlay: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]',
    dialog: 'bg-editor-bg rounded-md overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)] min-w-[480px] font-sans text-[11px] text-text',
    titleBar: 'bg-titlebar-bg px-3 py-2 flex items-center border-b border-border',
    titleText: 'text-accent font-semibold text-xs',
    closeBtn: 'ml-auto text-text-secondary cursor-pointer text-sm bg-transparent border-none px-0.5 leading-none',
    body: 'flex min-h-[200px]',
    recentList: 'w-40 border-r border-border p-2.5',
    recentHeader: 'text-text-secondary text-[10px] font-bold tracking-wide mb-2',
    recentItem: 'rounded-sm px-2 py-1.5 mb-[3px] cursor-pointer',
    recentPort: 'text-text text-[11px] font-semibold',
    recentDetail: 'text-text-secondary text-[10px]',
    configArea: 'flex-1 p-3 flex flex-col gap-2',
    error: 'text-[11px] text-error px-2 py-1 bg-error/10 rounded-sm',
    spacer: 'flex-1',
    actions: 'flex justify-end gap-2',
    cancelBtn: 'bg-transparent border border-[#4c4c4c] rounded-sm px-3.5 py-1 text-text-secondary text-[10px] cursor-pointer',
    connectBtn: 'rounded-sm px-3.5 py-1 text-[10px] font-semibold',
  },
  variants: {
    hovered: {
      true: { recentItem: 'bg-accent' },
      false: { recentItem: 'bg-[#2a2d2e]' },
    },
    disabled: {
      true: { connectBtn: 'opacity-60 cursor-not-allowed' },
      false: { connectBtn: 'bg-accent text-white cursor-pointer' },
    },
  },
})
```

- [ ] **步骤 6：迁移 ConnectionDialog.tsx**

- `import { connectionDialog } from './connection-dialog.variants'`
- 解构 `const { overlay, dialog, titleBar, titleText, closeBtn, body, recentList, recentHeader, recentItem, recentPort, recentDetail, configArea, error, spacer, actions, cancelBtn, connectBtn } = connectionDialog()`
- overlay div：`style={{...}}` → `className={overlay()}`
- dialog div：`style={{...}}` → `className={dialog()}`（删除 ref 保留）
- titleBar div：`style={{...}}` → `className={titleBar()}`
- 所有内联 style 逐一替换为对应 slot
- recentItem：使用 `className={recentItem({ hovered: hoveredRecent === i })}`
- connectBtn：使用 `className={connectBtn({ disabled: connecting || !config.portName })}`
- RECENT 标签的 `style="color:#858585;..."` → `className={recentHeader()}`

- [ ] **步骤 7：运行测试**

运行：`cd packages/jackcom && pnpm test -- --run`
预期：ConnectionDialog 测试通过

- [ ] **步骤 8：验证构建**

运行：`cd packages/jackcom && pnpm build`

- [ ] **步骤 9：Commit**

```bash
git add packages/jackcom/src/components/connection/
git commit -m "refactor(jackcom): connection 组件迁移到 tailwind-variants"
```

---

## 任务 4：menu/ 组件组

**文件：**
- 创建：`packages/jackcom/src/components/menu/menu-dropdown.variants.ts`
- 创建：`packages/jackcom/src/components/menu/menu-item.variants.ts`
- 修改：`packages/jackcom/src/components/menu/MenuDropdown.tsx`
- 修改：`packages/jackcom/src/components/menu/MenuItem.tsx`

- [ ] **步骤 1：创建 menu-dropdown.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const menuDropdown = tv({
  slots: {
    root: 'absolute top-full left-0 bg-menu-bg border border-border rounded-md py-1 min-w-[180px] z-[1000] shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
  },
})
```

- [ ] **步骤 2：迁移 MenuDropdown.tsx**

- `import { menuDropdown } from './menu-dropdown.variants'`
- `const { root } = menuDropdown()`
- `style={{...}}` → `className={root()}`

- [ ] **步骤 3：创建 menu-item.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const menuItem = tv({
  slots: {
    separator: 'h-px bg-border mx-2 my-1',
    item: 'px-3 py-1 pl-3 flex items-center gap-6 text-xs rounded-sm mx-1 data-[disabled=true]:opacity-50 data-[disabled=true]:text-text-secondary data-[disabled=true]:cursor-default data-[disabled=false]:cursor-pointer data-[disabled=false]:text-text hover:bg-accent hover:text-white',
    label: 'flex-1',
    shortcut: 'text-[11px] text-text-secondary ml-auto',
  },
})
```

- [ ] **步骤 4：迁移 MenuItem.tsx**

- `import { menuItem } from './menu-item.variants'`
- `const { separator, item, label, shortcut } = menuItem()`
- separator：`style={{...}}` → `className={separator()}`
- item div：删除整个 `style={{...}}`，删除 `onMouseEnter`/`onMouseLeave` 回调（hover 效果由 Tailwind hover: 处理），添加 `className={item()}` 和 `data-disabled={disabled}`
- label span：`style={{ flex: 1 }}` → `className={label()}`
- shortcut span：`style={{...}}` → `className={shortcut()}`

- [ ] **步骤 5：运行测试**

运行：`cd packages/jackcom && pnpm test -- --run`
预期：MenuItem 测试通过

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src/components/menu/
git commit -m "refactor(jackcom): menu 组件迁移到 tailwind-variants，用 hover: 替代 JS 事件"
```

---

## 任务 5：sidebar/ 组件组

**文件：**
- 创建：`packages/jackcom/src/components/sidebar/sidebar.variants.ts`
- 创建：`packages/jackcom/src/components/sidebar/connection-list.variants.ts`
- 创建：`packages/jackcom/src/components/sidebar/quick-send-panel.variants.ts`
- 修改：`packages/jackcom/src/components/sidebar/Sidebar.tsx`
- 修改：`packages/jackcom/src/components/sidebar/ConnectionList.tsx`
- 修改：`packages/jackcom/src/components/sidebar/QuickSendPanel.tsx`

- [ ] **步骤 1：创建 sidebar.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const sidebar = tv({
  slots: {
    root: 'w-[200px] bg-sidebar-bg border-r border-border flex flex-col overflow-hidden',
    header: 'px-2.5 py-2 text-[11px] font-bold text-text-secondary tracking-wide border-b border-border',
    content: 'flex-1 overflow-auto',
  },
})
```

- [ ] **步骤 2：迁移 Sidebar.tsx**

- `import { sidebar } from './sidebar.variants'`
- `const { root, header, content } = sidebar()`
- 根 div：`style={{...}}` → `className={root()}`
- header div：`style={{...}}` → `className={header()}`
- content div：`style={{ flex: 1, overflow: 'auto' }}` → `className={content()}`

- [ ] **步骤 3：创建 connection-list.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const connectionList = tv({
  slots: {
    empty: 'px-2 py-3 text-text-secondary text-[11px]',
    list: 'p-1',
    item: 'px-2 py-1.5 mb-[2px] rounded-sm cursor-pointer data-[active=true]:bg-border data-[online=true]:border-l-[3px] data-[online=true]:border-l-online data-[online=false]:border-l-[3px] data-[online=false]:border-l-transparent',
    row: 'flex items-center gap-1.5',
    statusDot: 'text-[8px]',
    portName: 'font-semibold text-xs',
    baudRate: 'ml-auto text-text-secondary text-[10px]',
  },
})
```

- [ ] **步骤 4：迁移 ConnectionList.tsx**

- `import { connectionList } from './connection-list.variants'`
- 解构所有 slots
- item div：添加 `data-active={activePortId === conn.portName} data-online={conn.online} className={item()}`
- statusDot span：保留 `style={{ color: conn.online ? 'var(--color-online)' : '...' }}`（动态颜色）+ `className={statusDot()}`
- portName/baudRate：`style={{...}}` → `className={portName()}` / `className={baudRate()}`

- [ ] **步骤 5：创建 quick-send-panel.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const quickSendPanel = tv({
  slots: {
    root: 'flex flex-col h-full',
    list: 'flex-1 overflow-auto p-1',
    empty: 'p-2 text-text-secondary text-[11px]',
    snippet: 'px-2 py-1.5 mb-[2px] rounded-sm bg-editor-bg flex items-center gap-1.5',
    snippetInfo: 'flex-1 min-w-0',
    snippetName: 'text-[11px] font-semibold',
    snippetData: 'text-[10px] text-text-secondary font-mono overflow-hidden text-ellipsis whitespace-nowrap',
    sendBtn: 'bg-transparent border-none text-[11px] px-1 py-0.5',
    deleteBtn: 'bg-transparent border-none text-text-secondary cursor-pointer text-[11px] px-1 py-0.5',
    addForm: 'p-2 border-t border-border flex flex-col gap-1 text-[11px]',
    addInput: 'bg-editor-bg border border-border rounded-sm px-1.5 py-[3px] text-text text-[11px] outline-none',
    addActions: 'flex gap-1',
    confirmBtn: 'bg-accent text-white border-none px-2 py-[2px] rounded-sm cursor-pointer text-[10px]',
    cancelFormBtn: 'bg-transparent border border-border text-text-secondary px-2 py-[2px] rounded-sm cursor-pointer text-[10px]',
    addButton: 'bg-transparent border-none text-accent cursor-pointer p-1.5 text-[11px]',
  },
  variants: {
    active: {
      true: { sendBtn: 'text-accent cursor-pointer opacity-100' },
      false: { sendBtn: 'text-text-secondary cursor-not-allowed opacity-50' },
    },
    adding: {
      true: { addButton: 'border-t-0' },
      false: { addButton: 'border-t border-border' },
    },
  },
})
```

- [ ] **步骤 6：迁移 QuickSendPanel.tsx**

- `import { quickSendPanel } from './quick-send-panel.variants'`
- 解构所有 slots
- 所有内联 style 替换为对应 slot
- sendBtn 用 `sendBtn({ active: !!activePortId })`
- addButton 用 `addButton({ adding })`
- addInput 中有 `fontFamily: 'Consolas, monospace'` 的那个添加 `font-mono` class

- [ ] **步骤 7：验证构建**

运行：`cd packages/jackcom && pnpm build`

- [ ] **步骤 8：Commit**

```bash
git add packages/jackcom/src/components/sidebar/
git commit -m "refactor(jackcom): sidebar 组件迁移到 tailwind-variants"
```

---

## 任务 6：history/ 组件组

**文件：**
- 创建：`packages/jackcom/src/components/history/filter-bar.variants.ts`
- 创建：`packages/jackcom/src/components/history/frame-table.variants.ts`
- 创建：`packages/jackcom/src/components/history/frame-detail.variants.ts`
- 创建：`packages/jackcom/src/components/history/session-list.variants.ts`
- 修改对应 4 个 .tsx 文件

- [ ] **步骤 1：创建 filter-bar.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const filterBar = tv({
  slots: {
    root: 'px-2.5 py-1 bg-sidebar-bg border-b border-border flex gap-2 items-center',
    label: 'text-text-secondary text-[10px]',
    pill: 'border-none rounded-sm text-[10px] cursor-pointer',
    separator: 'text-border',
  },
  variants: {
    active: {
      true: { pill: 'bg-accent text-white' },
      false: { pill: 'bg-transparent text-text-secondary' },
    },
  },
})
```

- [ ] **步骤 2：迁移 FilterBar.tsx**

- 删除 `pillStyle` 函数
- `import { filterBar } from './filter-bar.variants'`
- 解构 slots，pill 使用 `pill({ active: direction === d.value })`

- [ ] **步骤 3：创建 frame-table.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const frameTable = tv({
  slots: {
    empty: 'flex-1 flex items-center justify-center text-text-secondary text-[11px]',
    root: 'flex-1 overflow-auto bg-editor-bg',
    header: 'flex px-2.5 py-1 bg-sidebar-bg text-text-secondary text-[10px] border-b border-border sticky top-0 z-[1]',
    headerTime: 'w-[90px]',
    headerDir: 'w-[30px]',
    headerProto: 'w-[60px]',
    headerData: 'flex-1',
    row: 'flex px-2.5 py-[3px] border-b border-[#2d2d2d] cursor-pointer data-[expanded=true]:bg-[#2a2d2e] data-[expanded=false]:bg-transparent',
    cellTime: 'w-[90px] text-text-secondary text-[11px]',
    cellDir: 'w-[30px] text-[11px] font-semibold',
    cellProto: 'w-[60px] text-[11px]',
    cellData: 'flex-1 text-text text-[11px] overflow-hidden text-ellipsis whitespace-nowrap',
    cellSummary: 'text-text-secondary ml-2',
  },
})
```

注意：`dirColor` 和 `protoColor` 是运行时动态颜色，保留内联 style。

- [ ] **步骤 4：迁移 FrameTable.tsx**

- `import { frameTable } from './frame-table.variants'`
- 解构所有 slots
- row：添加 `data-expanded={isExpanded} className={row()}`
- cellDir/cellProto：保留 `style={{ color: dirColor(frame.direction) }}` 等动态颜色，加 `className`
- 删除 `dirColor`、`protoColor` 函数以外的静态样式

- [ ] **步骤 5：创建 frame-detail.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const frameDetail = tv({
  slots: {
    root: 'px-2.5 py-2 bg-sidebar-bg border-t border-border',
    header: 'text-[10px] text-text-secondary mb-1',
    hexSection: 'text-[11px] text-text font-mono break-all',
    hexLabel: 'text-text-secondary text-[10px] mb-[2px]',
    hexData: 'text-rx',
    parsedSection: 'mt-1 text-[11px] font-mono',
    parsedLabel: 'text-text-secondary text-[10px] mb-[2px]',
    parsedData: 'text-text',
    summary: 'mt-1 text-[10px] text-text-secondary',
  },
})
```

- [ ] **步骤 6：迁移 FrameDetail.tsx**

- `import { frameDetail } from './frame-detail.variants'`
- 解构所有 slots，逐一替换内联 style

- [ ] **步骤 7：创建 session-list.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const sessionList = tv({
  slots: {
    empty: 'flex-1 flex items-center justify-center text-text-secondary text-[11px] p-5 text-center',
    root: 'flex-1 overflow-auto',
    item: 'px-2.5 py-1.5 cursor-pointer border-b border-border data-[selected=true]:bg-accent data-[selected=false]:bg-transparent',
    portInfo: 'font-semibold text-text text-[11px]',
    time: 'text-text-secondary text-[10px]',
  },
})
```

- [ ] **步骤 8：迁移 SessionList.tsx**

- `import { sessionList } from './session-list.variants'`
- item：`data-selected={isSelected} className={item()}`
- 所有内联 style 替换

- [ ] **步骤 9：验证构建**

运行：`cd packages/jackcom && pnpm build`

- [ ] **步骤 10：Commit**

```bash
git add packages/jackcom/src/components/history/
git commit -m "refactor(jackcom): history 组件迁移到 tailwind-variants"
```

---

## 任务 7：layout/ 组件组

**文件：**
- 创建 6 个 `.variants.ts` 文件
- 修改 6 个 `.tsx` 文件

- [ ] **步骤 1：创建 app-layout.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const appLayout = tv({
  slots: {
    root: 'flex flex-col h-screen bg-editor-bg text-text',
    mainRow: 'flex-1 flex overflow-hidden',
    contentCol: 'flex-1 flex flex-col overflow-hidden',
    contentArea: 'flex-1 overflow-hidden',
  },
})
```

- [ ] **步骤 2：迁移 AppLayout.tsx**

- `import { appLayout } from './app-layout.variants'`
- 解构 slots，替换所有内联 style

- [ ] **步骤 3：创建 title-bar.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const titleBar = tv({
  slots: {
    root: 'h-[30px] bg-titlebar-bg border-b border-border flex items-center text-[13px] select-none',
    brand: 'flex items-center gap-1.5 px-2.5 h-full shrink-0',
    brandIcon: 'text-accent text-sm',
    brandText: 'text-xs font-semibold text-text',
    menuArea: 'flex h-full flex-1',
    menuContainer: 'relative h-full',
    menuTrigger: 'px-2.5 h-full flex items-center cursor-pointer text-xs rounded-t-sm',
  },
})
```

- [ ] **步骤 4：迁移 TitleBar.tsx**

- `import { titleBar } from './title-bar.variants'`
- 解构所有 slots
- menuTrigger 的动态颜色（openMenuId === menu.id）用 data 属性：
  `data-open={openMenuId === menu.id} className={menuTrigger()}`
  在 variants.ts 的 menuTrigger 中添加：
  `data-[open=true]:text-text data-[open=true]:bg-menu-bg data-[open=false]:text-text-secondary data-[open=false]:bg-transparent`

  更新 title-bar.variants.ts 的 menuTrigger：
  ```
  menuTrigger: 'px-2.5 h-full flex items-center cursor-pointer text-xs rounded-t-sm data-[open=true]:text-text data-[open=true]:bg-menu-bg data-[open=false]:text-text-secondary data-[open=false]:bg-transparent',
  ```

- [ ] **步骤 5：创建 toolbar.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const toolbar = tv({
  slots: {
    root: 'bg-titlebar-bg border-b border-border px-3 py-1 flex items-center gap-2 text-xs',
    connectBtn: 'border-none px-3.5 py-[3px] rounded-sm cursor-pointer font-semibold text-[11px] text-white',
    connInfo: 'text-text-secondary text-[11px]',
    separator: 'text-border mx-1',
    toolBtn: 'bg-transparent border-none text-text-secondary cursor-pointer text-[11px] px-1.5 py-0.5',
    windowBtn: 'bg-transparent border-none text-[11px] px-1.5 py-0.5',
    onlineIndicator: 'text-online text-[11px] font-semibold',
    spacer: 'ml-auto',
  },
  variants: {
    online: {
      true: { connectBtn: 'bg-accent' },
      false: { connectBtn: 'bg-border' },
    },
    active: {
      true: { windowBtn: 'text-accent cursor-pointer opacity-100' },
      false: { windowBtn: 'text-text-secondary cursor-not-allowed opacity-50' },
    },
  },
})
```

- [ ] **步骤 6：迁移 Toolbar.tsx**

- `import { toolbar } from './toolbar.variants'`
- 解构所有 slots
- connectBtn：`className={connectBtn({ online: isOnline })}`
- 波形/解码按钮：`className={windowBtn({ active: !!activePortId })}`
- 其余内联 style 全部替换

- [ ] **步骤 7：创建 status-bar.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const statusBar = tv({
  slots: {
    root: 'bg-accent px-3 py-[2px] flex gap-4 text-[11px] text-white',
    stats: 'ml-auto',
    encoding: '',
  },
})
```

- [ ] **步骤 8：迁移 StatusBar.tsx**

- `import { statusBar } from './status-bar.variants'`
- 替换所有内联 style
- stats span 的动态 `marginLeft` 改用条件类名：有 stats 时 `className={stats()}`，无 stats 时 `className={encoding()} ml-auto`

- [ ] **步骤 9：创建 activity-bar.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const activityBar = tv({
  slots: {
    root: 'w-10 bg-titlebar-bg border-r border-border flex flex-col items-center pt-1 gap-0.5',
    item: 'text-lg p-1.5 cursor-pointer border-l-2 data-[active=true]:border-accent data-[active=true]:opacity-100 data-[active=false]:border-transparent data-[active=false]:opacity-60',
  },
})
```

- [ ] **步骤 10：迁移 ActivityBar.tsx**

- `import { activityBar } from './activity-bar.variants'`
- 解构 slots
- item：`data-active={sidebarVisible && sidebarTab === id} className={item()}`

- [ ] **步骤 11：创建 window-controls.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const windowControls = tv({
  slots: {
    root: 'flex h-full',
    btn: 'w-[46px] h-full flex items-center justify-center cursor-pointer text-text',
  },
  variants: {
    hovered: {
      true: { btn: '' },
      false: { btn: 'bg-transparent' },
    },
    closeHovered: {
      true: { btn: 'bg-[#e81123] text-white' },
      false: { btn: '' },
    },
  },
})
```

注意：WindowButton 组件使用 JS `onMouseEnter/Leave` 管理 hovered 状态。迁移方案：保留 state 管理，但用 data 属性替代内联 style。

- [ ] **步骤 12：迁移 WindowControls.tsx**

- `import { windowControls } from './window-controls.variants'`
- WindowButton 改为使用 data 属性：
  ```tsx
  <div
    data-hovered={hovered}
    className={btn()}
    ...
  >
  ```
- 在 variants.ts 中 btn 改为：
  ```
  btn: 'w-[46px] h-full flex items-center justify-center cursor-pointer data-[hovered=false]:bg-transparent data-[hovered=false]:text-text',
  ```
- 关闭按钮的特殊 hover 颜色需要在 WindowButton 中传入 variant 区分：
  保留 `<WindowButton variant="close" ...>` 和 `<WindowButton variant="default" ...>` 的区分
- 最终方案：hoverBg 是 prop（`#e81123` 或 `var(--color-border)`），这属于动态值，保留 `style={{ background: hovered ? hoverBg : 'transparent' }}`。仅静态部分迁移到 className。

  简化方案：WindowButton 组件由于 hover 行为依赖 prop（不同按钮不同 hover 色），保留少量内联 style 是合理的。迁移静态部分：
  ```tsx
  <div
    className="w-[46px] h-full flex items-center justify-center cursor-pointer"
    style={{ color: hovered && hoverBg === '#e81123' ? '#fff' : 'var(--color-text)', background: hovered ? hoverBg : 'transparent' }}
  >
  ```
  根容器 div：`className="flex h-full"`

- [ ] **步骤 13：验证构建**

运行：`cd packages/jackcom && pnpm build`

- [ ] **步骤 14：Commit**

```bash
git add packages/jackcom/src/components/layout/
git commit -m "refactor(jackcom): layout 组件迁移到 tailwind-variants"
```

---

## 任务 8：waveform/ 组件

**文件：**
- 创建：`packages/jackcom/src/components/waveform/waveform-canvas.variants.ts`
- 修改：`packages/jackcom/src/components/waveform/WaveformCanvas.tsx`

- [ ] **步骤 1：创建 waveform-canvas.variants.ts**

```ts
import { tv } from 'tailwind-variants'

export const waveformCanvas = tv({
  slots: {
    error: 'text-text-secondary text-center p-10 text-xs',
    errorDetail: 'text-[11px]',
    canvas: 'w-full h-full block',
  },
})
```

- [ ] **步骤 2：迁移 WaveformCanvas.tsx**

- error div：`style={{...}}` → `className={error()}`
- error detail span：`style={{ fontSize: '11px' }}` → `className={errorDetail()}`
- canvas：静态部分 `className={canvas()}`，保留 `style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}`（动态值）

- [ ] **步骤 3：验证构建**

运行：`cd packages/jackcom && pnpm build`

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src/components/waveform/
git commit -m "refactor(jackcom): waveform 组件迁移到 tailwind-variants"
```

---

## 任务 9：Admin 业务组件清理

**文件：**
- 修改：`packages/admin/src/components/auth/LoginView.vue`
- 修改：`packages/admin/src/components/layout/Header.vue`
- 修改：`packages/admin/src/components/layout/Sidebar.vue`
- 修改：`packages/admin/src/components/logs/LogsTable.vue`
- 修改：`packages/admin/src/components/software/DownloadView.vue`
- 修改：`packages/admin/src/components/software/ManualEditor.vue`
- 修改：`packages/admin/src/components/software/ManualView.vue`
- 修改：`packages/admin/src/components/software/SoftwareCreateDialog.vue`
- 修改：`packages/admin/src/components/software/SoftwareDetail.vue`
- 修改：`packages/admin/src/components/software/SoftwareEditDialog.vue`
- 修改：`packages/admin/src/components/software/SoftwareTable.vue`
- 修改：`packages/admin/src/components/software/VersionEditDialog.vue`
- 修改：`packages/admin/src/components/software/VersionTable.vue`

Admin 组件不需要 tv，直接将内联 `style="..."` 转为 Tailwind class。原则：
- `style="color: #94a3b8; font-size: 12px;"` → `class="text-[#94a3b8] text-xs"`
- `style="background: rgba(255,255,255,0.04);"` → `class="bg-white/[0.04]"`
- 动态 `:style` 保留或用条件 class

- [ ] **步骤 1：清理 LoginView.vue + DownloadView.vue**

这两个文件是登录/下载页面，内联样式模式相似（渐变背景、毛玻璃卡片）。逐个替换。

- [ ] **步骤 2：清理 Header.vue + Sidebar.vue**

Header：纯静态内联样式，直接替换。
Sidebar：有动态 `:style`（sidebarWidth），宽度保留内联，其余转 Tailwind。

- [ ] **步骤 3：清理 LogsTable.vue**

所有内联样式都是静态的，直接替换。

- [ ] **步骤 4：清理 Software*.vue + Version*.vue + Manual*.vue**

这些文件共享相似的模式（对话框表单、标签样式、表格行）。逐文件替换。

- [ ] **步骤 5：清理 VersionTable.vue**

有动态 `:style`（index===0 条件），转为条件 class。

- [ ] **步骤 6：验证 admin 构建**

运行：`cd packages/admin && pnpm build`

- [ ] **步骤 7：Commit**

```bash
git add packages/admin/src/components/
git commit -m "refactor(admin): 业务组件内联样式迁移到 Tailwind class"
```

---

## 任务 10：最终验证

- [ ] **步骤 1：全量构建**

运行：`cd D:/Project/upgrade-component && pnpm build`

- [ ] **步骤 2：运行所有测试**

运行：`cd packages/jackcom && pnpm test -- --run`

- [ ] **步骤 3：确认无残留内联样式（jackcom）**

运行：`grep -r "style={{" packages/jackcom/src/components/ --include="*.tsx" | grep -v "cursor:" | grep -v "transform:" | grep -v "height.*virtualizer" | head -20`

预期：仅保留动态值（cursor: grab/grabbing、transform: translateY、height: virtualizer 等）

- [ ] **步骤 4：确认无残留内联样式（admin 业务组件）**

运行：`grep -r 'style="' packages/admin/src/components/auth/ packages/admin/src/components/layout/ packages/admin/src/components/logs/ packages/admin/src/components/software/ --include="*.vue" | head -20`

预期：仅保留动态 `:style`（sidebarWidth 等）

- [ ] **步骤 5：Final commit（如有遗漏修复）**
