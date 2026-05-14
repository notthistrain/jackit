# Select 组件设计规格

## 概述

将连接对话框中原生 `<select>` 元素替换为自定义 `Select` 组件，统一 VS Code 暗色主题风格，作为全应用通用的 UI 基础组件。

## 背景

当前连接对话框（PortSelector + SerialConfigForm）中有 6 个原生 `<select>` 元素，存在以下问题：

1. 原生 select 的下拉箭头和弹出列表无法自定义样式，暗色主题下不协调
2. 样式不统一 — PortSelector 用 `bg-editor-bg`，SerialConfigForm 硬编码 `bg-[#3c3c3c]`
3. 无法实现选中项高亮、悬停效果等 VS Code 风格的交互

## 方案

完全自定义实现，用 `div` 模拟 `<select>` 行为，零外部依赖。

## 组件 API

```tsx
// components/ui/Select.tsx

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  size?: 'default' | 'compact'
  className?: string
}
```

- 纯受控组件（`value` + `onChange`），和原生 select 使用方式一致
- `size` 变体通过 tailwind-variants 的 `variants` 处理
- 不含 `label` prop — label 由外层表单渲染

## 组件结构

```
Select
├── trigger (div, role=combobox)
│   ├── 选中项文本
│   └── 下拉箭头 SVG
└── dropdown panel (div, role=listbox, 绝对定位)
    └── option (div, role=option) × N
```

## 交互行为

| 操作 | 行为 |
|------|------|
| 点击触发器 | 打开/关闭下拉面板 |
| 悬停选项 | 高亮当前悬停项 |
| 点击选项 | 选中并关闭 |
| 点击外部 | 关闭，不改变选中值 |
| Esc | 关闭 |
| ↑ ↓ | 在选项间移动焦点 |
| Enter | 选中当前焦点项 |
| disabled 选项 | 跳过，不可选中 |

## 主题变量

在 `vscode-theme.css` 的 `@theme` 中新增：

```css
/* 输入控件 */
--color-input-bg: #3C3C3C;
--color-input-border: #4c4c4c;

/* 列表交互 */
--color-list-hover: #2a2d2e;
--color-list-active: #094771;
```

## 样式变体

```ts
// components/ui/select.variants.ts

select: tv({
  slots: {
    root: 'relative',
    trigger: 'flex items-center justify-between bg-input-bg text-text border border-input-border rounded-sm outline-none cursor-pointer',
    arrow: 'text-text-secondary ml-1 shrink-0',
    panel: 'absolute left-0 top-full mt-0.5 min-w-full bg-menu-bg border border-border rounded-sm shadow-lg py-0.5 z-[1000]',
    option: 'px-2 py-1 cursor-pointer text-xs',
  },
  variants: {
    size: {
      default: { trigger: 'px-2 py-1 text-xs' },
      compact: { trigger: 'px-1.5 py-[3px] text-[10px]' },
    },
    open: {
      true: { trigger: 'border-accent' },
    },
    selected: {
      true: { option: 'bg-accent/10 border-l-2 border-accent' },
    },
    hovered: {
      true: { option: 'bg-list-hover' },
    },
    disabled: {
      true: { option: 'opacity-50 cursor-not-allowed' },
    },
  },
})
```

## 文件变更

### 新增

| 文件 | 说明 |
|------|------|
| `components/ui/Select.tsx` | Select 组件实现 |
| `components/ui/select.variants.ts` | 样式变体定义 |

### 修改

| 文件 | 变更 |
|------|------|
| `styles/vscode-theme.css` | 新增 input-bg、input-border、list-hover、list-active 变量 |
| `components/connection/PortSelector.tsx` | 替换 `<select>` 为 `<Select>` |
| `components/connection/SerialConfigForm.tsx` | 替换 5 个 `<select>` 为 `<Select>` |
| `components/connection/port-selector.variants.ts` | 移除 `select` slot |
| `components/connection/serial-config-form.variants.ts` | 移除 `select`、`compactSelect` slot |

### 不变

- `ConnectionDialog.tsx` — 无需改动
- 其他非连接组件 — 无需改动

## 范围约束

- 仅实现简单下拉选择，不含搜索/多选
- 不引入外部依赖
- 仅替换连接对话框中的原生 select，不涉及其他组件
