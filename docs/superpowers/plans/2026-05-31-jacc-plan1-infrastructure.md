# jacc 前端重构 - 批次 1：基础设施层

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 安装 tailwind-variants，创建基础 UI 组件（Button、Input、Dialog、CollapsibleCard），建立变体系统基础

**架构：** 创建 shared/components/ui/ 目录，所有组件使用 tailwind-variants 的 tv() 函数定义样式变体，组件和变体文件分离

**技术栈：** React 18、TypeScript、tailwind-variants、Vitest + Testing Library

---

## 文件结构

### 新增文件
```
packages/jacc/src/shared/components/ui/
├── button.variants.ts
├── Button.tsx
├── Button.test.tsx
├── input.variants.ts
├── Input.tsx
├── Input.test.tsx
├── dialog.variants.ts
├── Dialog.tsx
├── collapsible-card.variants.ts
├── CollapsibleCard.tsx
└── CollapsibleCard.test.tsx
```

### 修改文件
```
packages/jacc/package.json          # 依赖调整
```

---

## 任务 1.1：依赖调整

**文件：**
- 修改：`packages/jacc/package.json`

- [ ] **步骤 1：读取当前 package.json**

读取：`packages/jacc/package.json`
目的：确认当前依赖配置

- [ ] **步骤 2：修改 package.json 依赖**

在 `packages/jacc/package.json` 的 `dependencies` 中：
- 移除：`"class-variance-authority": "catalog:"`
- 添加：`"tailwind-variants": "catalog:"`

注意：catalog 中已经有 `tailwind-variants: ^1.0.0`，直接引用即可。

- [ ] **步骤 3：安装依赖**

```bash
cd "D:\Project\jackit" && pnpm install
```

- [ ] **步骤 4：验证依赖安装**

运行：`cd packages/jacc && pnpm list tailwind-variants`
预期：显示 tailwind-variants 1.0.0（从 catalog）

- [ ] **步骤 5：Commit**

```bash
cd "D:\Project\jackit" && git add packages/jacc/package.json pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
chore(jacc): 替换 cva 为 tailwind-variants

移除 class-variance-authority，添加 tailwind-variants（从 catalog）以对齐 jackcom 架构。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 任务 1.2：创建 Button 组件

**文件：**
- 创建：`packages/jacc/src/shared/components/ui/button.variants.ts`
- 创建：`packages/jacc/src/shared/components/ui/Button.tsx`
- 创建：`packages/jacc/src/shared/components/ui/Button.test.tsx`

- [ ] **步骤 1：创建 shared/components/ui 目录**

```bash
mkdir -p packages/jacc/src/shared/components/ui
```

- [ ] **步骤 2：编写 button.variants.ts**

创建文件：`packages/jacc/src/shared/components/ui/button.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const button = tv({
  slots: {
    root: 'inline-flex items-center justify-center rounded-[4px] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  },
  variants: {
    variant: {
      primary: {
        root: 'bg-primary text-white hover:bg-primary/90',
      },
      ghost: {
        root: 'text-muted hover:bg-sidebar hover:text-foreground border border-border',
      },
      danger: {
        root: 'text-muted hover:bg-danger/10 hover:text-danger border border-border',
      },
    },
    size: {
      sm: {
        root: 'px-2 py-1 text-[11px]',
      },
      md: {
        root: 'px-3 py-2 text-xs',
      },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})
```

- [ ] **步骤 3：编写 Button.tsx**

创建文件：`packages/jacc/src/shared/components/ui/Button.tsx`

```typescript
import type { ReactNode } from 'react'
import { button } from './button.variants'

export interface ButtonProps {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  disabled?: boolean
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export function Button({
  variant,
  size,
  disabled,
  children,
  onClick,
  type = 'button',
  className,
}: ButtonProps) {
  const { root } = button({ variant, size })

  return (
    <button
      type={type}
      className={root({ className })}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
```

- [ ] **步骤 4：编写 Button.test.tsx**

创建文件：`packages/jacc/src/shared/components/ui/Button.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    await userEvent.click(screen.getByText('Click me'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} disabled>Click me</Button>)
    await userEvent.click(screen.getByText('Click me'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies primary variant by default', () => {
    render(<Button>Primary</Button>)
    const button = screen.getByText('Primary')
    expect(button).toHaveClass('bg-primary')
  })

  it('applies ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const button = screen.getByText('Ghost')
    expect(button).toHaveClass('text-muted')
    expect(button).toHaveClass('border')
  })

  it('applies danger variant', () => {
    render(<Button variant="danger">Danger</Button>)
    const button = screen.getByText('Danger')
    expect(button).toHaveClass('hover:text-danger')
  })

  it('applies sm size', () => {
    render(<Button size="sm">Small</Button>)
    const button = screen.getByText('Small')
    expect(button).toHaveClass('px-2')
    expect(button).toHaveClass('py-1')
  })
})
```

- [ ] **步骤 5：运行测试验证**

运行：`cd packages/jacc && pnpm test Button.test.tsx`
预期：所有 7 个测试通过

- [ ] **步骤 6：Commit**

```bash
cd "D:\Project\jackit" && git add packages/jacc/src/shared/components/ui/Button* && git commit -m "$(cat <<'EOF'
feat(jacc): 添加 Button 组件（tailwind-variants）

使用 tailwind-variants 创建 Button 组件，支持 primary/ghost/danger 变体和 sm/md 尺寸。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 任务 1.3：创建 Input 组件

**文件：**
- 创建：`packages/jacc/src/shared/components/ui/input.variants.ts`
- 创建：`packages/jacc/src/shared/components/ui/Input.tsx`
- 创建：`packages/jacc/src/shared/components/ui/Input.test.tsx`

- [ ] **步骤 1：编写 input.variants.ts**

创建文件：`packages/jacc/src/shared/components/ui/input.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const input = tv({
  slots: {
    root: 'w-full bg-sidebar border border-border rounded-[4px] text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
    label: 'text-[11px] text-muted mb-1 block',
    error: 'text-[11px] text-danger mt-1',
  },
  variants: {
    size: {
      sm: {
        root: 'px-2 py-1',
      },
      md: {
        root: 'px-3 py-2',
      },
    },
    hasError: {
      true: {
        root: 'border-danger focus:ring-danger',
      },
    },
    disabled: {
      true: {
        root: 'opacity-50 cursor-not-allowed',
      },
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
```

- [ ] **步骤 2：编写 Input.tsx**

创建文件：`packages/jacc/src/shared/components/ui/Input.tsx`

```typescript
import { input } from './input.variants'

export interface InputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  type?: 'text' | 'password' | 'email' | 'number'
  className?: string
}

export function Input({
  value,
  onChange,
  placeholder,
  label,
  error,
  disabled,
  size,
  type = 'text',
  className,
}: InputProps) {
  const { root, label: labelClass, error: errorClass } = input({
    size,
    hasError: !!error,
    disabled,
  })

  return (
    <div className={className}>
      {label && <label className={labelClass()}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={root()}
      />
      {error && <div className={errorClass()}>{error}</div>}
    </div>
  )
}
```

- [ ] **步骤 3：编写 Input.test.tsx**

创建文件：`packages/jacc/src/shared/components/ui/Input.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('renders with value', () => {
    render(<Input value="test" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('test')).toBeInTheDocument()
  })

  it('calls onChange when typing', async () => {
    const onChange = vi.fn()
    render(<Input value="" onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'hello')
    expect(onChange).toHaveBeenCalledTimes(5)
  })

  it('renders label', () => {
    render(<Input value="" onChange={vi.fn()} label="Username" />)
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('renders error message', () => {
    render(<Input value="" onChange={vi.fn()} error="Required field" />)
    expect(screen.getByText('Required field')).toBeInTheDocument()
  })

  it('disables input when disabled prop is true', () => {
    render(<Input value="" onChange={vi.fn()} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('applies error styles when error is present', () => {
    render(<Input value="" onChange={vi.fn()} error="Error" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('border-danger')
  })
})
```

- [ ] **步骤 4：运行测试验证**

运行：`cd packages/jacc && pnpm test Input.test.tsx`
预期：所有 6 个测试通过

- [ ] **步骤 5：Commit**

```bash
cd "D:\Project\jackit" && git add packages/jacc/src/shared/components/ui/Input* && git commit -m "$(cat <<'EOF'
feat(jacc): 添加 Input 组件（tailwind-variants）

支持 label、error、disabled 状态，使用 tailwind-variants 管理样式。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 任务 1.4：创建 Dialog 基础组件

**文件：**
- 创建：`packages/jacc/src/shared/components/ui/dialog.variants.ts`
- 创建：`packages/jacc/src/shared/components/ui/Dialog.tsx`

- [ ] **步骤 1：编写 dialog.variants.ts**

创建文件：`packages/jacc/src/shared/components/ui/dialog.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const dialog = tv({
  slots: {
    overlay: 'fixed inset-0 bg-black/30 flex items-center justify-center z-50',
    content: 'bg-card border border-border rounded-[4px] shadow-xl',
    header: 'px-6 pt-6 pb-4',
    title: 'text-[15px] font-medium text-foreground',
    body: 'px-6 pb-4',
    footer: 'px-6 pb-6 flex justify-end gap-2',
  },
  variants: {
    size: {
      sm: {
        content: 'w-[320px]',
      },
      md: {
        content: 'w-[400px]',
      },
      lg: {
        content: 'w-[600px]',
      },
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
```

- [ ] **步骤 2：编写 Dialog.tsx**

创建文件：`packages/jacc/src/shared/components/ui/Dialog.tsx`

```typescript
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { dialog } from './dialog.variants'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Dialog({ open, onClose, title, children, footer, size }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  const { overlay, content, header, title: titleClass, body, footer: footerClass } = dialog({ size })

  return (
    <div
      ref={overlayRef}
      className={overlay()}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) {
          onClose()
        }
      }}
    >
      <div className={content()}>
        {title && (
          <div className={header()}>
            <h3 className={titleClass()}>{title}</h3>
          </div>
        )}
        <div className={body()}>{children}</div>
        {footer && <div className={footerClass()}>{footer}</div>}
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：Commit**

```bash
cd "D:\Project\jackit" && git add packages/jacc/src/shared/components/ui/Dialog* && git commit -m "$(cat <<'EOF'
feat(jacc): 添加 Dialog 基础组件

支持 sm/md/lg 尺寸，ESC 关闭，点击遮罩关闭。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 任务 1.5：创建 CollapsibleCard 组件

**文件：**
- 创建：`packages/jacc/src/shared/components/ui/collapsible-card.variants.ts`
- 创建：`packages/jacc/src/shared/components/ui/CollapsibleCard.tsx`
- 创建：`packages/jacc/src/shared/components/ui/CollapsibleCard.test.tsx`

- [ ] **步骤 1：编写 collapsible-card.variants.ts**

创建文件：`packages/jacc/src/shared/components/ui/collapsible-card.variants.ts`

```typescript
import { tv } from 'tailwind-variants'

export const collapsibleCard = tv({
  slots: {
    root: 'bg-card border rounded-[4px] overflow-hidden',
    header: 'flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar/30',
    headerLeft: 'flex items-center gap-2.5 min-w-0 flex-1',
    headerRight: 'flex items-center gap-2 shrink-0',
    icon: 'text-muted shrink-0',
    content: 'border-t border-border-light',
  },
  variants: {
    expanded: {
      true: {
        root: 'border-primary',
      },
      false: {
        root: 'border-border-light',
      },
    },
  },
  defaultVariants: {
    expanded: false,
  },
})
```

- [ ] **步骤 2：编写 CollapsibleCard.tsx**

创建文件：`packages/jacc/src/shared/components/ui/CollapsibleCard.tsx`

```typescript
import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { collapsibleCard } from './collapsible-card.variants'

export interface CollapsibleCardProps {
  expanded: boolean
  onToggle: () => void
  header: ReactNode
  headerRight?: ReactNode
  children: ReactNode
}

export function CollapsibleCard({
  expanded,
  onToggle,
  header,
  headerRight,
  children,
}: CollapsibleCardProps) {
  const { root, header: headerClass, headerLeft, headerRight: headerRightClass, icon, content } =
    collapsibleCard({ expanded })

  return (
    <div className={root()}>
      <div className={headerClass()} onClick={onToggle}>
        <div className={headerLeft()}>
          {expanded ? (
            <ChevronDown size={14} className={icon()} />
          ) : (
            <ChevronRight size={14} className={icon()} />
          )}
          {header}
        </div>
        {headerRight && (
          <div className={headerRightClass()} onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}
      </div>
      {expanded && <div className={content()}>{children}</div>}
    </div>
  )
}
```

- [ ] **步骤 3：编写 CollapsibleCard.test.tsx**

创建文件：`packages/jacc/src/shared/components/ui/CollapsibleCard.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CollapsibleCard } from './CollapsibleCard'

describe('CollapsibleCard', () => {
  it('renders header', () => {
    render(
      <CollapsibleCard expanded={false} onToggle={vi.fn()} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    expect(screen.getByText('Header')).toBeInTheDocument()
  })

  it('shows content when expanded', () => {
    render(
      <CollapsibleCard expanded={true} onToggle={vi.fn()} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('hides content when collapsed', () => {
    render(
      <CollapsibleCard expanded={false} onToggle={vi.fn()} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('calls onToggle when header clicked', async () => {
    const onToggle = vi.fn()
    render(
      <CollapsibleCard expanded={false} onToggle={onToggle} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    await userEvent.click(screen.getByText('Header'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('does not call onToggle when headerRight clicked', async () => {
    const onToggle = vi.fn()
    render(
      <CollapsibleCard
        expanded={false}
        onToggle={onToggle}
        header={<div>Header</div>}
        headerRight={<button>Action</button>}
      >
        Content
      </CollapsibleCard>
    )
    await userEvent.click(screen.getByText('Action'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('shows ChevronDown when expanded', () => {
    const { container } = render(
      <CollapsibleCard expanded={true} onToggle={vi.fn()} header={<div>Header</div>}>
        Content
      </CollapsibleCard>
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
```

- [ ] **步骤 4：运行测试验证**

运行：`cd packages/jacc && pnpm test CollapsibleCard.test.tsx`
预期：所有 6 个测试通过

- [ ] **步骤 5：Commit**

```bash
cd "D:\Project\jackit" && git add packages/jacc/src/shared/components/ui/CollapsibleCard* && git commit -m "$(cat <<'EOF'
feat(jacc): 添加 CollapsibleCard 组件

通用可折叠卡片组件，支持 header、headerRight、展开/折叠状态。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 任务 1.6：批次 1 验证

- [ ] **步骤 1：运行所有测试**

运行：`cd packages/jacc && pnpm test`
预期：所有测试通过（包括新增的 Button、Input、CollapsibleCard 测试）

- [ ] **步骤 2：检查 TypeScript 错误**

运行：`cd packages/jacc && pnpm exec tsc --noEmit`
预期：无错误

- [ ] **步骤 3：检查 ESLint 警告**

运行：`cd packages/jacc && pnpm lint`
预期：无警告或仅有可忽略的警告

- [ ] **步骤 4：启动开发服务器验证**

运行：`cd packages/jacc && pnpm dev`
预期：应用正常启动，无报错，可以在浏览器中访问

- [ ] **步骤 5：验证清单**

确认以下所有项：
- ✅ tailwind-variants 已安装
- ✅ class-variance-authority 已移除
- ✅ Button 组件及测试已创建
- ✅ Input 组件及测试已创建
- ✅ Dialog 组件已创建
- ✅ CollapsibleCard 组件及测试已创建
- ✅ 所有组件使用命名导出
- ✅ 所有 Props 接口已导出
- ✅ 所有测试通过
- ✅ 无 TypeScript 错误
- ✅ 无 ESLint 警告

---

## 批次 1 完成

**已完成：**
- ✅ 依赖调整（tailwind-variants 替换 cva）
- ✅ Button 组件（3 个变体，2 个尺寸）
- ✅ Input 组件（支持 label、error、disabled）
- ✅ Dialog 基础组件（3 个尺寸）
- ✅ CollapsibleCard 组件（通用折叠卡片）
- ✅ 测试覆盖（Button、Input、CollapsibleCard）

**下一步：**
批次 2 - 原子组件层（TitleBar、Sidebar、Fab、EmptyState、SourceBadge、ProjectSwitcher、ConfirmDialog）
