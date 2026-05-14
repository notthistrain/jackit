# 统一样式方案设计

## 背景

项目两个前端包存在不一致的样式写法：

| 包 | 技术栈 | 当前样式方式 |
|---|---|---|
| jackcom (React) | Tailwind v4 已安装但未使用 | 100% 内联样式 + CSS 变量 |
| admin (Vue) | Tailwind v4 正常使用 | ~70% 原子化 class + ~30% 内联样式 |

目标：统一为 Tailwind 原子化 class + tailwind-variants (tv) 变体写法。

## 方案决策

### 样式工具：tailwind-variants (tv)

选择 `tailwind-variants` 而非 CVA，核心优势是 **slots**：

- 一个 `tv()` 调用可定义组件内所有子元素的样式
- 内置 `twMerge` + `clsx`，无需额外 `cn()` 工具函数
- 对比 CVA 需要每个子元素单独一个 `cva()` 调用

### 状态样式：语义变体 vs 运行时状态分离

两种场景严格区分，不混用：

- **语义变体**（如按钮的 primary/secondary）→ tv `variants`，组件传参 `variant({ variant: 'primary' })`
- **运行时状态**（如 active、hovered、selected）→ `data-*` 属性 + Tailwind `data-[xxx]:` 选择器，组件只设属性、CSS 自动匹配，不需要传 variant prop

### 组织方式：独立 .variants.ts 文件

每个组件配套一个 `.variants.ts` 文件，与组件同目录：

```
components/
  connection/
    ConnectionDialog.tsx
    connection-dialog.variants.ts
  layout/
    ActivityBar.tsx
    activity-bar.variants.ts
```

## 基础设施

### 1. 添加 cn() 工具函数

`packages/jackcom/src/lib/utils.ts`（少量场景需要手动合并 class）：

```ts
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ClassValue } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 2. 安装 tailwind-variants

```bash
cd packages/jackcom && pnpm add tailwind-variants
cd packages/admin && pnpm add tailwind-variants  # admin 仅用于清理参考
```

### 3. CSS 变量映射到 Tailwind 主题

在 `packages/jackcom/src/styles/globals.css` 中用 Tailwind v4 的 `@theme` 指令：

```css
@import "tailwindcss";
@import "./vscode-theme.css";

@theme {
  --color-accent: var(--color-accent);
  --color-accent-hover: var(--color-accent-hover);
  --color-rx: var(--color-rx);
  --color-tx: var(--color-tx);
  --color-timestamp: var(--color-timestamp);
  --color-editor-bg: var(--color-editor-bg);
  --color-sidebar-bg: var(--color-sidebar-bg);
  --color-menu-bg: var(--color-menu-bg);
  --color-titlebar-bg: var(--color-titlebar-bg);
  --color-border: var(--color-border);
  --color-text: var(--color-text);
  --color-text-secondary: var(--color-text-secondary);
  --color-online: var(--color-online);
  --color-error: var(--color-error);
  --color-warning: var(--color-warning);
}
```

映射后可在 Tailwind 中使用 `bg-accent`、`text-text`、`border-border` 等语义化 class。

## 组件写法规范

### variants 文件示例

```ts
// activity-bar.variants.ts
import { tv } from 'tailwind-variants'

export const activityBar = tv({
  slots: {
    root: 'w-10 bg-titlebar-bg border-r border-border flex flex-col items-center pt-1 gap-0.5',
    item: 'text-lg p-1.5 cursor-pointer border-l-2 data-[active=true]:border-accent data-[active=true]:opacity-100 data-[active=false]:border-transparent data-[active=false]:opacity-60',
  },
})
```

### 组件消费方式

```tsx
// ActivityBar.tsx
import { activityBar } from './activity-bar.variants'

export function ActivityBar() {
  const { root, item } = activityBar()

  return (
    <div className={root()}>
      {ICONS.map(({ id }) => (
        <div
          data-active={sidebarVisible && sidebarTab === id}
          className={item()}
        >
          ...
        </div>
      ))}
    </div>
  )
}
```

### 语义变体示例（对比）

```ts
// button.variants.ts — 语义变体用 tv variants
import { tv } from 'tailwind-variants'

export const button = tv({
  base: 'rounded-sm px-3.5 py-1 text-[10px] cursor-pointer',
  variants: {
    intent: {
      primary: 'bg-accent text-white font-semibold',
      outline: 'bg-transparent border border-[#4c4c4c] text-text-secondary',
    },
    disabled: {
      true: 'opacity-60 cursor-not-allowed',
      false: '',
    },
  },
})
```

```tsx
// 消费 — 语义变体通过参数传递，状态通过 data-* 属性
<button
  className={button({ intent: 'primary', disabled: connecting })}
  disabled={connecting}
>
  Connect
</button>
```

### 关键规则

1. **每个组件配套 `.variants.ts` 文件**，用 `tv()` 定义所有 slots + variants
2. **语义变体**用 tv `variants`（如 intent: primary/secondary），组件传参驱动
3. **运行时状态**用 `data-*` 属性 + Tailwind `data-[xxx]:` 选择器，组件只设属性，不需要传 variant prop
4. **动态计算值**（如 Canvas 尺寸、来自 props 的颜色）保留内联 `style`
5. 所有组件接受可选 `className` prop 以支持外部覆盖
6. 静态内联 `style` 全部消除

## Admin 包清理策略

- **UI 组件** (`components/ui/`) — 已有 CVA，保持不变
- **业务组件** — 零散内联样式直接转 Tailwind class，不加 tv 层

## 迁移顺序

按依赖顺序，从叶子组件到根组件：

1. **基础设施** — cn()、tailwind-variants 安装、@theme 映射
2. **terminal/** — TerminalLine, SendBar, TerminalView
3. **connection/** — PortSelector, SerialConfigForm, ConnectionDialog
4. **menu/** — MenuItem, MenuDropdown
5. **sidebar/** — ConnectionList, QuickSendPanel, Sidebar
6. **history/** — FilterBar, FrameTable, FrameDetail, SessionList
7. **layout/** — WindowControls, TitleBar, Toolbar, StatusBar, ActivityBar, AppLayout
8. **waveform/** — WaveformCanvas
9. **Admin 业务组件** — 清理零散内联样式
10. **测试更新** — 更新测试中的样式断言

## 不动的部分

- Admin 的 `components/ui/` — 已有 CVA，保持现状
- 真正动态计算的值（如 Canvas 尺寸、运行时计算的颜色）— 保留内联 style
- `vscode-theme.css` 中的 CSS 变量定义 — 继续作为主题 token 源头
