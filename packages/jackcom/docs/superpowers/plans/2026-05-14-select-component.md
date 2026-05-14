# Select 通用组件实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建自定义 Select UI 组件，替换连接对话框中原生 `<select>`，统一 VS Code 暗色主题风格。

**架构：** 纯 React + tailwind-variants 实现，div 模拟 select 行为。通过语义化 CSS 变量（`--color-input-bg` 等）实现主题化。组件位于 `components/ui/`，作为全应用通用基础组件。

**技术栈：** React、tailwind-variants、Tailwind CSS v4、VS Code 主题变量

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 创建 | `src/components/ui/select.variants.ts` | Select 样式变体定义 |
| 创建 | `src/components/ui/Select.tsx` | Select 组件实现 |
| 修改 | `src/styles/vscode-theme.css` | 新增 4 个语义化颜色变量 |
| 修改 | `src/components/connection/port-selector.variants.ts` | 移除 `select` slot |
| 修改 | `src/components/connection/PortSelector.tsx` | 替换 `<select>` 为 `<Select>` |
| 修改 | `src/components/connection/serial-config-form.variants.ts` | 移除 `select`、`compactSelect` slot |
| 修改 | `src/components/connection/SerialConfigForm.tsx` | 替换 5 个 `<select>` 为 `<Select>` |

所有路径相对于 `packages/jackcom/`。

---

### 任务 1：新增主题变量

**文件：**
- 修改：`src/styles/vscode-theme.css`

- [ ] **步骤 1：在 `@theme` 块中新增 4 个颜色变量**

在 `vscode-theme.css` 的 `@theme` 块末尾（`--color-warning` 之后）添加：

```css
  /* 输入控件 */
  --color-input-bg: #3C3C3C;
  --color-input-border: #4c4c4c;

  /* 列表交互 */
  --color-list-hover: #2a2d2e;
  --color-list-active: #094771;
```

- [ ] **步骤 2：Commit**

```bash
git add src/styles/vscode-theme.css
git commit -m "feat(ui): 新增 input-bg/input-border/list-hover/list-active 主题变量"
```

---

### 任务 2：创建 select.variants.ts

**文件：**
- 创建：`src/components/ui/select.variants.ts`

- [ ] **步骤 1：创建目录和文件**

```bash
mkdir -p src/components/ui
```

创建 `src/components/ui/select.variants.ts`，内容如下：

```ts
import { tv } from 'tailwind-variants'

export const select = tv({
  slots: {
    root: 'relative',
    trigger: 'flex items-center justify-between bg-input-bg text-text border border-input-border rounded-sm outline-none cursor-pointer',
    arrow: 'text-text-secondary ml-1 shrink-0',
    panel: 'absolute left-0 top-full mt-0.5 min-w-full bg-menu-bg border border-border rounded-sm shadow-lg py-0.5 z-[1000] overflow-hidden',
    option: 'px-2 py-1 cursor-pointer text-xs whitespace-nowrap',
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
      false: { option: 'border-l-2 border-transparent' },
    },
    hovered: {
      true: { option: 'bg-list-hover' },
    },
    disabled: {
      true: { option: 'opacity-50 cursor-not-allowed' },
    },
    triggerDisabled: {
      true: { trigger: 'opacity-50 cursor-not-allowed' },
    },
  },
})
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/ui/select.variants.ts
git commit -m "feat(ui): 创建 select.variants.ts 样式变体定义"
```

---

### 任务 3：创建 Select.tsx 组件

**文件：**
- 创建：`src/components/ui/Select.tsx`

- [ ] **步骤 1：创建组件文件**

创建 `src/components/ui/Select.tsx`，内容如下：

```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { select } from './select.variants'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  size?: 'default' | 'compact'
  className?: string
}

export function Select({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  size = 'default',
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)
  const displayText = selectedOption?.label ?? placeholder ?? ''

  const enabledOptions = options.filter(o => !o.disabled)

  const close = useCallback(() => {
    setOpen(false)
    setHoveredIndex(-1)
  }, [])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, close])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, close])

  const handleTriggerClick = () => {
    if (disabled) return
    setOpen(prev => !prev)
    setHoveredIndex(-1)
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setHoveredIndex(-1)
        return
      }
      if (e.key === 'ArrowDown') {
        setHoveredIndex(prev => {
          const next = prev + 1
          return next >= enabledOptions.length ? 0 : next
        })
      } else if (e.key === 'ArrowUp') {
        setHoveredIndex(prev => {
          const next = prev - 1
          return next < 0 ? enabledOptions.length - 1 : next
        })
      } else if ((e.key === 'Enter' || e.key === ' ') && hoveredIndex >= 0) {
        const opt = enabledOptions[hoveredIndex]
        if (opt && !opt.disabled) {
          onChange(opt.value)
          close()
        }
      }
    }
  }

  const handleOptionClick = (opt: SelectOption) => {
    if (opt.disabled) return
    onChange(opt.value)
    close()
  }

  const handleOptionMouseEnter = (index: number) => {
    setHoveredIndex(index)
  }

  const { root, trigger, arrow, panel, option } = select({
    size,
    open: open || undefined,
    triggerDisabled: disabled || undefined,
  })

  // 找到当前 hoveredIndex 对应的 enabled option
  const hoveredValue = hoveredIndex >= 0 && hoveredIndex < enabledOptions.length
    ? enabledOptions[hoveredIndex].value
    : null

  return (
    <div ref={rootRef} className={root()}>
      <div
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={trigger()}
      >
        <span className={selectedOption ? 'text-text' : 'text-text-secondary'}>
          {displayText}
        </span>
        <ChevronDownIcon className={arrow()} />
      </div>
      {open && (
        <div ref={panelRef} role="listbox" className={panel()}>
          {options.map(opt => {
            const isSelected = opt.value === value
            const isHovered = opt.value === hoveredValue
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleOptionClick(opt)}
                onMouseEnter={() => {
                  if (!opt.disabled) {
                    const idx = enabledOptions.indexOf(opt)
                    if (idx >= 0) handleOptionMouseEnter(idx)
                  }
                }}
                className={option({
                  selected: isSelected,
                  hovered: isHovered,
                  disabled: opt.disabled,
                })}
              >
                {opt.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ChevronDownIcon({ className }: { className: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={className}>
      <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/ui/Select.tsx
git commit -m "feat(ui): 实现 Select 自定义下拉组件"
```

---

### 任务 4：更新 PortSelector

**文件：**
- 修改：`src/components/connection/port-selector.variants.ts`
- 修改：`src/components/connection/PortSelector.tsx`

- [ ] **步骤 1：更新 port-selector.variants.ts，移除 select slot**

将文件改为：

```ts
import { tv } from 'tailwind-variants'

export const portSelector = tv({
  slots: {
    root: 'flex flex-col gap-1',
    row: 'flex gap-1.5 items-center',
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

- [ ] **步骤 2：更新 PortSelector.tsx，替换原生 select**

将文件改为：

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSerialPort } from '@/hooks/useSerialPort'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import { portSelector } from './port-selector.variants'

interface PortInfo {
  name: string
  manufacturer: string | null
  product: string | null
  serial_number: string | null
  port_type: string
}

interface PortSelectorProps {
  value: string
  onChange: (portName: string) => void
}

export function PortSelector({ value, onChange }: PortSelectorProps) {
  const { enumerate } = useSerialPort()
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrMsg] = useState<string | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const { root, row, refreshBtn, error } = portSelector()

  const refresh = useCallback(async () => {
    setLoading(true)
    setErrMsg(null)
    try {
      const list = await enumerate()
      setPorts(list)
      if (!valueRef.current && list.length > 0) {
        onChangeRef.current(list[0].name)
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [enumerate])

  useEffect(() => {
    refresh()
  }, [refresh])

  const portOptions: SelectOption[] = ports.map(p => ({
    value: p.name,
    label: p.name + (p.manufacturer ? ` (${p.manufacturer})` : ''),
  }))

  return (
    <div className={root()}>
      <div className={row()}>
        <Select
          value={value}
          options={portOptions}
          onChange={onChange}
          placeholder={loading ? '...' : 'No ports'}
          disabled={loading || ports.length === 0}
          className="flex-1"
        />
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh"
          className={refreshBtn({ loading })}
        >
          {loading ? '...' : 'R'}
        </button>
      </div>
      {errorMsg && (
        <span className={error()}>{errorMsg}</span>
      )}
    </div>
  )
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/connection/port-selector.variants.ts src/components/connection/PortSelector.tsx
git commit -m "feat(connection): PortSelector 使用自定义 Select 组件"
```

---

### 任务 5：更新 SerialConfigForm

**文件：**
- 修改：`src/components/connection/serial-config-form.variants.ts`
- 修改：`src/components/connection/SerialConfigForm.tsx`

- [ ] **步骤 1：更新 serial-config-form.variants.ts，移除 select/compactSelect slot**

将文件改为：

```ts
import { tv } from 'tailwind-variants'

export const serialConfigForm = tv({
  slots: {
    row: 'flex items-center gap-2',
    label: 'text-[10px] text-text-secondary text-right w-[70px] shrink-0',
    portRow: 'flex-1 flex gap-1',
  },
})
```

- [ ] **步骤 2：更新 SerialConfigForm.tsx，替换 5 个原生 select**

将文件改为：

```tsx
import { useT } from '@/i18n'
import type { SerialConfig } from '@/hooks/useSerialConfig'
import type { SelectOption } from '@/components/ui/Select'
import { Select } from '@/components/ui/Select'
import { PortSelector } from './PortSelector'
import { serialConfigForm } from './serial-config-form.variants'

interface SerialConfigFormProps {
  config: SerialConfig
  onChange: (partial: Partial<SerialConfig>) => void
}

const BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
]

const DATA_BITS_OPTIONS: SelectOption[] = [5, 6, 7, 8].map(b => ({ value: String(b), label: `${b} bit` }))
const STOP_BITS_OPTIONS: SelectOption[] = [1, 2].map(b => ({ value: String(b), label: `${b} stop` }))
const PARITY_OPTIONS: SelectOption[] = ['none', 'odd', 'even'].map(p => ({ value: p, label: p }))
const FLOW_CONTROL_OPTIONS: SelectOption[] = ['none', 'hardware', 'software'].map(f => ({ value: f, label: f }))

export function SerialConfigForm({ config, onChange }: SerialConfigFormProps) {
  const { t } = useT()
  const { row, label, portRow } = serialConfigForm()

  return (
    <>
      {/* Port selector */}
      <div className={row()}>
        <label className={label()}>{t('connection.port')}</label>
        <div className={portRow()}>
          <div className="flex-1">
            <PortSelector
              value={config.portName}
              onChange={v => onChange({ portName: v })}
            />
          </div>
        </div>
      </div>

      {/* Baud rate */}
      <div className={row()}>
        <label className={label()}>{t('connection.baudRate')}</label>
        <Select
          value={String(config.baudRate)}
          options={BAUD_RATES.map(rate => ({ value: String(rate), label: rate.toLocaleString() }))}
          onChange={v => onChange({ baudRate: Number(v) })}
          className="flex-1"
        />
      </div>

      {/* Advanced: data bits / stop bits / parity / flow control */}
      <div className={row()}>
        <label className={label()}>Advanced</label>
        <div className="flex gap-1 flex-1">
          <Select
            value={String(config.dataBits)}
            options={DATA_BITS_OPTIONS}
            onChange={v => onChange({ dataBits: Number(v) })}
            size="compact"
            className="flex-1"
          />
          <Select
            value={String(config.stopBits)}
            options={STOP_BITS_OPTIONS}
            onChange={v => onChange({ stopBits: Number(v) })}
            size="compact"
            className="flex-1"
          />
          <Select
            value={config.parity}
            options={PARITY_OPTIONS}
            onChange={v => onChange({ parity: v })}
            size="compact"
            className="flex-1"
          />
          <Select
            value={config.flowControl}
            options={FLOW_CONTROL_OPTIONS}
            onChange={v => onChange({ flowControl: v })}
            size="compact"
            className="flex-1"
          />
        </div>
      </div>
    </>
  )
}
```

- [ ] **步骤 3：验证构建**

```bash
cd packages/jackcom && npx tsc --noEmit
```

预期：无类型错误。

- [ ] **步骤 4：Commit**

```bash
git add src/components/connection/serial-config-form.variants.ts src/components/connection/SerialConfigForm.tsx
git commit -m "feat(connection): SerialConfigForm 使用自定义 Select 组件"
```

---

### 任务 6：视觉验证

- [ ] **步骤 1：启动开发服务器**

```bash
cd packages/jackcom && pnpm tauri dev
```

- [ ] **步骤 2：验证以下要点**

- [ ] 打开连接对话框，波特率下拉框外观和交互正常
- [ ] Advanced 行的 4 个 compact 下拉框正常
- [ ] Port 下拉框 + 刷新按钮正常
- [ ] 点击外部关闭下拉面板
- [ ] Esc 关闭下拉面板
- [ ] 上下键导航、Enter 选中
- [ ] 选中项有蓝色左边框高亮
- [ ] 整体颜色风格与 VS Code 主题协调
