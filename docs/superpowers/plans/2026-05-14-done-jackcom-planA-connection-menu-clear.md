# ConnectionDialog + 菜单接通 + Ctrl+L 清屏 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 ConnectionDialog 模态对话框、接通所有菜单项 onClick、实现 Ctrl+L 清屏功能，使 JackCom 主窗口完全可用。

**架构：** 在 Zustand store 中添加 `clearSequence`（清屏计数器）和 `connectionDialogOpen`（对话框状态）。新建 `useSerialConfig` hook 管理 localStorage 配置。新建 ConnectionDialog 组件（双栏：左 Recent + 右配置表单）。修改 TitleBar、Toolbar、AppLayout 接通所有交互。

**技术栈：** React 19 + Zustand 5 + Tauri v2 + @tauri-apps/plugin-shell + @tauri-apps/plugin-dialog

**规格文档：** `docs/superpowers/specs/2026-05-14-jackcom-placeholder-features-design.md` 第 3-6 节

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `packages/jackcom/src/hooks/useSerialConfig.ts` | 串口配置状态管理 + localStorage 读写 + 最近连接列表 |
| `packages/jackcom/src/components/connection/PortSelector.tsx` | 端口选择下拉框 + 刷新按钮 |
| `packages/jackcom/src/components/connection/SerialConfigForm.tsx` | 串口参数配置表单（波特率/数据位/停止位/校验位/流控） |
| `packages/jackcom/src/components/connection/ConnectionDialog.tsx` | 模态对话框主组件（双栏布局） |
| `packages/jackcom/src/hooks/__tests__/useSerialConfig.test.ts` | useSerialConfig 测试 |
| `packages/jackcom/src/components/connection/__tests__/ConnectionDialog.test.tsx` | ConnectionDialog 测试 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `packages/jackcom/src/lib/store.ts` | 添加 `clearSequence` 计数器 + `incrementClearSequence` action + `connectionDialogOpen` + `toggleConnectionDialog` |
| `packages/jackcom/src/hooks/useDataFeed.ts` | 监听 `clearSequence` 变化触发清空 |
| `packages/jackcom/src/components/layout/AppLayout.tsx` | Ctrl+L handler 接通 `incrementClearSequence`，渲染 `ConnectionDialog` |
| `packages/jackcom/src/components/layout/TitleBar.tsx` | 接通所有菜单 onClick，移除 Check Updates |
| `packages/jackcom/src/components/layout/Toolbar.tsx` | 连接按钮接通 ConnectionDialog / 断开逻辑 |
| `packages/jackcom/src/i18n/locales/zh.json` | 添加 ConnectionDialog 相关翻译 |
| `packages/jackcom/src/i18n/locales/en.json` | 添加 ConnectionDialog 相关翻译 |
| `packages/jackcom/src-tauri/Cargo.toml` | 添加 `tauri-plugin-dialog` 和 `tauri-plugin-shell` |
| `packages/jackcom/src-tauri/src/lib.rs` | 注册 dialog 和 shell 插件 |
| `packages/jackcom/src-tauri/tauri.conf.json` | 添加 dialog 和 shell 插件权限 |
| `packages/jackcom/package.json` | 添加 `@tauri-apps/plugin-dialog` 和 `@tauri-apps/plugin-shell` |

---

### 任务 1：Store — 添加 clearSequence + connectionDialogOpen

**文件：**
- 修改：`packages/jackcom/src/lib/store.ts`
- 测试：`packages/jackcom/src/lib/__tests__/stores.test.ts`

- [ ] **步骤 1：编写 store 新字段的失败测试**

在 `packages/jackcom/src/lib/__tests__/stores.test.ts` 的 `useMainStore` describe 块末尾添加：

```typescript
  it('increments clearSequence', () => {
    const initial = useMainStore.getState().clearSequence
    useMainStore.getState().incrementClearSequence()
    expect(useMainStore.getState().clearSequence).toBe(initial + 1)
  })

  it('toggles connection dialog', () => {
    expect(useMainStore.getState().connectionDialogOpen).toBe(false)
    useMainStore.getState().toggleConnectionDialog(true)
    expect(useMainStore.getState().connectionDialogOpen).toBe(true)
    useMainStore.getState().toggleConnectionDialog(false)
    expect(useMainStore.getState().connectionDialogOpen).toBe(false)
  })
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm test -- --run`
预期：FAIL — `clearSequence` 和 `connectionDialogOpen` 属性不存在

- [ ] **步骤 3：在 store 中添加新字段**

修改 `packages/jackcom/src/lib/store.ts`，在 `MainStore` interface 中 `hexDisplay` 之后添加：

```typescript
  // 清屏计数器（每次清屏递增，useDataFeed 监听变化后清空）
  clearSequence: number
  incrementClearSequence: () => void

  // 连接对话框
  connectionDialogOpen: boolean
  toggleConnectionDialog: (open: boolean) => void
```

在 `create<MainStore>(set => ({` 中 `toggleHexDisplay` 之后添加：

```typescript
  clearSequence: 0,
  incrementClearSequence: () => set(s => ({ clearSequence: s.clearSequence + 1 })),

  connectionDialogOpen: false,
  toggleConnectionDialog: (open) => set({ connectionDialogOpen: open }),
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm test -- --run`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src/lib/store.ts packages/jackcom/src/lib/__tests__/stores.test.ts
git commit -m "feat(jackcom): store 添加 clearSequence 和 connectionDialogOpen 状态"
```

---

### 任务 2：useSerialConfig hook

**文件：**
- 创建：`packages/jackcom/src/hooks/useSerialConfig.ts`
- 测试：`packages/jackcom/src/hooks/__tests__/useSerialConfig.test.ts`

- [ ] **步骤 1：编写 useSerialConfig 测试**

创建 `packages/jackcom/src/hooks/__tests__/useSerialConfig.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

import { useSerialConfig } from '../useSerialConfig'

describe('useSerialConfig', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('returns default config when localStorage is empty', () => {
    const { result } = renderHook(() => useSerialConfig())
    expect(result.current.config.baudRate).toBe(115200)
    expect(result.current.config.dataBits).toBe(8)
    expect(result.current.config.stopBits).toBe(1)
    expect(result.current.config.parity).toBe('none')
    expect(result.current.config.flowControl).toBe('none')
  })

  it('updates config with setConfig', () => {
    const { result } = renderHook(() => useSerialConfig())
    act(() => {
      result.current.setConfig({ baudRate: 9600 })
    })
    expect(result.current.config.baudRate).toBe(9600)
  })

  it('saves to recent configs via saveAsRecent', () => {
    const { result } = renderHook(() => useSerialConfig())
    act(() => {
      result.current.setConfig({ portName: 'COM3', baudRate: 115200 })
    })
    act(() => {
      result.current.saveAsRecent()
    })
    expect(result.current.recentConfigs).toHaveLength(1)
    expect(result.current.recentConfigs[0].portName).toBe('COM3')
  })

  it('keeps at most 5 recent configs', () => {
    const { result } = renderHook(() => useSerialConfig())
    for (let i = 0; i < 7; i++) {
      act(() => {
        result.current.setConfig({ portName: `COM${i}`, baudRate: 9600 + i })
      })
      act(() => {
        result.current.saveAsRecent()
      })
    }
    expect(result.current.recentConfigs).toHaveLength(5)
    // 最新的在前面
    expect(result.current.recentConfigs[0].portName).toBe('COM6')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm test -- --run src/hooks/__tests__/useSerialConfig.test.ts`
预期：FAIL — 模块找不到

- [ ] **步骤 3：实现 useSerialConfig hook**

创建 `packages/jackcom/src/hooks/useSerialConfig.ts`：

```typescript
import { useState, useCallback } from 'react'

export interface SerialConfig {
  portName: string
  baudRate: number
  dataBits: number
  stopBits: number
  parity: string
  flowControl: string
}

const STORAGE_KEY = 'jackcom:serial-config'
const RECENT_KEY = 'jackcom:recent-connections'
const MAX_RECENT = 5

const defaultConfig: SerialConfig = {
  portName: '',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
}

function loadConfig(): SerialConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...defaultConfig, ...JSON.parse(saved) }
  } catch { /* ignore */ }
  return { ...defaultConfig }
}

function loadRecent(): SerialConfig[] {
  try {
    const saved = localStorage.getItem(RECENT_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return []
}

export function useSerialConfig() {
  const [config, setConfigState] = useState<SerialConfig>(loadConfig)
  const [recentConfigs, setRecentConfigs] = useState<SerialConfig[]>(loadRecent)

  const setConfig = useCallback((partial: Partial<SerialConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...partial }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const saveAsRecent = useCallback(() => {
    setRecentConfigs(prev => {
      const filtered = prev.filter(
        c => !(c.portName === config.portName && c.baudRate === config.baudRate)
      )
      const next = [config, ...filtered].slice(0, MAX_RECENT)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [config])

  return { config, setConfig, recentConfigs, saveAsRecent }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm test -- --run src/hooks/__tests__/useSerialConfig.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src/hooks/useSerialConfig.ts packages/jackcom/src/hooks/__tests__/useSerialConfig.test.ts
git commit -m "feat(jackcom): 添加 useSerialConfig hook 管理串口配置"
```

---

### 任务 3：Tauri 插件依赖（dialog + shell）

**文件：**
- 修改：`packages/jackcom/src-tauri/Cargo.toml`
- 修改：`packages/jackcom/src-tauri/src/lib.rs`
- 修改：`packages/jackcom/src-tauri/tauri.conf.json`
- 修改：`packages/jackcom/package.json`

- [ ] **步骤 1：添加 Rust 依赖**

在 `packages/jackcom/src-tauri/Cargo.toml` 的 `[dependencies]` 中添加：

```toml
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
```

- [ ] **步骤 2：注册插件到 Tauri builder**

修改 `packages/jackcom/src-tauri/src/lib.rs`，在 builder 链中（`.plugin(tauri_plugin_log::Builder::new().build())` 之后）添加：

```rust
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
```

- [ ] **步骤 3：更新 tauri.conf.json 插件配置**

修改 `packages/jackcom/src-tauri/tauri.conf.json`，将 `plugins` 部分替换为：

```json
  "plugins": {
    "log": null,
    "dialog": null,
    "shell": {
      "open": true
    }
  }
```

- [ ] **步骤 4：添加前端 npm 依赖**

运行：
```bash
cd packages/jackcom && pnpm add @tauri-apps/plugin-dialog @tauri-apps/plugin-shell
```

- [ ] **步骤 5：验证 Rust 编译**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：编译通过，无错误

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src-tauri/Cargo.toml packages/jackcom/src-tauri/src/lib.rs packages/jackcom/src-tauri/tauri.conf.json packages/jackcom/package.json pnpm-lock.yaml
git commit -m "feat(jackcom): 添加 tauri-plugin-dialog 和 tauri-plugin-shell 依赖"
```

---

### 任务 4：PortSelector 组件

**文件：**
- 创建：`packages/jackcom/src/components/connection/PortSelector.tsx`

- [ ] **步骤 1：创建 PortSelector 组件**

创建 `packages/jackcom/src/components/connection/PortSelector.tsx`：

```typescript
import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface PortInfo {
  name: string
  manufacturer: string | null
}

interface PortSelectorProps {
  value: string
  onChange: (portName: string) => void
}

export function PortSelector({ value, onChange }: PortSelectorProps) {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<PortInfo[]>('enumerate_ports')
      setPorts(list)
    } catch {
      setPorts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1,
          background: 'var(--color-sidebar-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '3px',
          padding: '4px 8px',
          color: 'var(--color-text)',
          fontSize: '12px',
          outline: 'none',
        }}
      >
        <option value="">-- 选择端口 --</option>
        {ports.map(p => (
          <option key={p.name} value={p.name}>
            {p.name}{p.manufacturer ? ` (${p.manufacturer})` : ''}
          </option>
        ))}
      </select>
      <button
        onClick={refresh}
        disabled={loading}
        style={{
          background: 'var(--color-sidebar-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '3px',
          padding: '4px 8px',
          color: 'var(--color-text-secondary)',
          cursor: loading ? 'wait' : 'pointer',
          fontSize: '12px',
        }}
      >
        ↻
      </button>
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src/components/connection/PortSelector.tsx
git commit -m "feat(jackcom): 添加 PortSelector 端口选择组件"
```

---

### 任务 5：SerialConfigForm 组件

**文件：**
- 创建：`packages/jackcom/src/components/connection/SerialConfigForm.tsx`

- [ ] **步骤 1：创建 SerialConfigForm 组件**

创建 `packages/jackcom/src/components/connection/SerialConfigForm.tsx`：

```typescript
import type { SerialConfig } from '@/hooks/useSerialConfig'

interface SerialConfigFormProps {
  config: SerialConfig
  onChange: (partial: Partial<SerialConfig>) => void
}

const baudRates = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

const selectStyle: React.CSSProperties = {
  background: 'var(--color-sidebar-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '3px',
  padding: '3px 6px',
  color: 'var(--color-text)',
  fontSize: '11px',
  outline: 'none',
  flex: 1,
  textAlign: 'center' as const,
}

const labelStyle: React.CSSProperties = {
  width: '70px',
  color: 'var(--color-text-secondary)',
  textAlign: 'right' as const,
  fontSize: '11px',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

export function SerialConfigForm({ config, onChange }: SerialConfigFormProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={rowStyle}>
        <label style={labelStyle}>Baud Rate</label>
        <select
          value={config.baudRate}
          onChange={e => onChange({ baudRate: Number(e.target.value) })}
          style={{ ...selectStyle, flex: 'none', width: '100%' }}
        >
          {baudRates.map(br => (
            <option key={br} value={br}>{br.toLocaleString()}</option>
          ))}
        </select>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>Advanced</label>
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          <select
            value={config.dataBits}
            onChange={e => onChange({ dataBits: Number(e.target.value) })}
            style={selectStyle}
          >
            <option value={5}>5 bit</option>
            <option value={6}>6 bit</option>
            <option value={7}>7 bit</option>
            <option value={8}>8 bit</option>
          </select>
          <select
            value={config.stopBits}
            onChange={e => onChange({ stopBits: Number(e.target.value) })}
            style={selectStyle}
          >
            <option value={1}>1 stop</option>
            <option value={2}>2 stop</option>
          </select>
          <select
            value={config.parity}
            onChange={e => onChange({ parity: e.target.value })}
            style={selectStyle}
          >
            <option value="none">none</option>
            <option value="odd">odd</option>
            <option value="even">even</option>
          </select>
          <select
            value={config.flowControl}
            onChange={e => onChange({ flowControl: e.target.value })}
            style={selectStyle}
          >
            <option value="none">none</option>
            <option value="hardware">HW</option>
            <option value="software">SW</option>
          </select>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src/components/connection/SerialConfigForm.tsx
git commit -m "feat(jackcom): 添加 SerialConfigForm 串口参数配置表单"
```

---

### 任务 6：ConnectionDialog 组件

**文件：**
- 创建：`packages/jackcom/src/components/connection/ConnectionDialog.tsx`
- 创建：`packages/jackcom/src/components/connection/__tests__/ConnectionDialog.test.tsx`

- [ ] **步骤 1：编写 ConnectionDialog 测试**

创建 `packages/jackcom/src/components/connection/__tests__/ConnectionDialog.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
}))

// Mock useSerialConfig
vi.mock('@/hooks/useSerialConfig', () => ({
  useSerialConfig: () => ({
    config: { portName: '', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    setConfig: vi.fn(),
    recentConfigs: [
      { portName: 'COM3', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    ],
    saveAsRecent: vi.fn(),
  }),
}))

// Mock useMainStore
vi.mock('@/lib/store', () => ({
  useMainStore: () => ({
    toggleConnectionDialog: vi.fn(),
  }),
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { ConnectionDialog } from '../ConnectionDialog'

describe('ConnectionDialog', () => {
  it('renders modal when open', () => {
    render(<ConnectionDialog open={true} onClose={vi.fn()} onConnected={vi.fn()} />)
    expect(screen.getByText('connection.title')).toBeTruthy()
  })

  it('does not render when closed', () => {
    const { container } = render(<ConnectionDialog open={false} onClose={vi.fn()} onConnected={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows recent connections', () => {
    render(<ConnectionDialog open={true} onClose={vi.fn()} onConnected={vi.fn()} />)
    expect(screen.getByText('COM3')).toBeTruthy()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm test -- --run src/components/connection/__tests__/ConnectionDialog.test.tsx`
预期：FAIL — 模块找不到

- [ ] **步骤 3：实现 ConnectionDialog**

创建 `packages/jackcom/src/components/connection/ConnectionDialog.tsx`：

```typescript
import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { useSerialConfig, type SerialConfig } from '@/hooks/useSerialConfig'
import { PortSelector } from './PortSelector'
import { SerialConfigForm } from './SerialConfigForm'

interface ConnectionDialogProps {
  open: boolean
  onClose: () => void
  onConnected: (portName: string) => void
}

const dataBitsMap: Record<number, string> = { 5: 'five', 6: 'six', 7: 'seven', 8: 'eight' }
const stopBitsMap: Record<number, string> = { 1: 'one', 2: 'two' }

export function ConnectionDialog({ open, onClose, onConnected }: ConnectionDialogProps) {
  const { t } = useT()
  const { config, setConfig, recentConfigs, saveAsRecent } = useSerialConfig()
  const { addConnection } = useMainStore()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = useCallback(async () => {
    if (!config.portName) {
      setError('请选择端口')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      await invoke('open_port', {
        request: {
          port_name: config.portName,
          baud_rate: config.baudRate,
          data_bits: dataBitsMap[config.dataBits] ?? 'eight',
          stop_bits: stopBitsMap[config.stopBits] ?? 'one',
          parity: config.parity,
          flow_control: config.flowControl,
        },
      })
      addConnection(config.portName, config.baudRate)
      saveAsRecent()
      onConnected(config.portName)
      onClose()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setConnecting(false)
    }
  }, [config, addConnection, saveAsRecent, onConnected, onClose])

  const handleRecentClick = useCallback((recent: SerialConfig) => {
    setConfig(recent)
  }, [setConfig])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-editor-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          overflow: 'hidden',
          width: '480px',
          maxHeight: '80vh',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* 标题栏 */}
        <div style={{
          background: 'var(--color-titlebar-bg)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '12px' }}>
            {t('connection.title')}
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>

        {/* 双栏布局 */}
        <div style={{ display: 'flex', minHeight: '200px' }}>
          {/* 左侧 Recent */}
          <div style={{
            width: '160px',
            borderRight: '1px solid var(--color-border)',
            padding: '10px',
          }}>
            <div style={{
              color: 'var(--color-text-secondary)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}>
              {t('connection.recent')}
            </div>
            {recentConfigs.length === 0 && (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>
                {t('connection.noRecent')}
              </div>
            )}
            {recentConfigs.map((rc, i) => (
              <div
                key={`${rc.portName}-${rc.baudRate}-${i}`}
                onClick={() => handleRecentClick(rc)}
                style={{
                  background: config.portName === rc.portName && config.baudRate === rc.baudRate
                    ? '#094771' : 'var(--color-sidebar-bg)',
                  borderRadius: '3px',
                  padding: '6px 8px',
                  marginBottom: '3px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: 'var(--color-text)', fontSize: '11px', fontWeight: 600 }}>
                  {rc.portName}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>
                  {rc.baudRate} {rc.dataBits}{rc.parity[0].toUpperCase()}{rc.stopBits}
                </div>
              </div>
            ))}
          </div>

          {/* 右侧配置表单 */}
          <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{
                width: '70px',
                color: 'var(--color-text-secondary)',
                textAlign: 'right',
                fontSize: '11px',
              }}>
                Port
              </label>
              <PortSelector
                value={config.portName}
                onChange={portName => setConfig({ portName })}
              />
            </div>
            <SerialConfigForm config={config} onChange={setConfig} />

            {error && (
              <div style={{ color: 'var(--color-error)', fontSize: '11px', padding: '4px 0' }}>
                {error}
              </div>
            )}

            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: '3px',
                  padding: '5px 16px',
                  color: 'var(--color-text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConnect}
                disabled={connecting || !config.portName}
                style={{
                  background: connecting ? 'var(--color-text-secondary)' : 'var(--color-accent)',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '5px 16px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: connecting ? 'wait' : 'pointer',
                }}
              >
                {connecting ? t('connection.connecting') : t('connection.connect')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm test -- --run src/components/connection/__tests__/ConnectionDialog.test.tsx`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src/components/connection/ConnectionDialog.tsx packages/jackcom/src/components/connection/__tests__/ConnectionDialog.test.tsx
git commit -m "feat(jackcom): 添加 ConnectionDialog 双栏模态对话框"
```

---

### 任务 7：Ctrl+L 清屏接通

**文件：**
- 修改：`packages/jackcom/src/hooks/useDataFeed.ts`
- 修改：`packages/jackcom/src/components/layout/AppLayout.tsx`

- [ ] **步骤 1：修改 useDataFeed 监听 clearSequence**

修改 `packages/jackcom/src/hooks/useDataFeed.ts`：

在文件顶部 import 区添加：
```typescript
import { useMainStore } from '@/lib/store'
```

在 `useDataFeed` 函数体内，`const { portId, flushInterval = 100 } = options` 之后添加：
```typescript
  const clearSequence = useMainStore(s => s.clearSequence)
```

在 `const clear = useCallback(...)` 之前添加 useEffect 监听 clearSequence：
```typescript
  // 监听 clearSequence 变化，执行清屏
  useEffect(() => {
    if (clearSequence > 0) {
      allFramesRef.current = []
      batchRef.current = []
      setFrames([])
      setTotalCount(0)
    }
  }, [clearSequence])
```

- [ ] **步骤 2：修改 AppLayout 接通 Ctrl+L handler**

修改 `packages/jackcom/src/components/layout/AppLayout.tsx`：

将 `incrementClearSequence` 添加到 `useMainStore` 解构中：
```typescript
  const { activePortId, toggleSidebar, toggleHexDisplay, incrementClearSequence } = useMainStore()
```

将 Ctrl+L handler 从占位符改为实际调用：
```typescript
    { key: 'l', ctrl: true, handler: () => { incrementClearSequence() } },
```

- [ ] **步骤 3：运行现有测试确认无回归**

运行：`cd packages/jackcom && pnpm test -- --run`
预期：全部 PASS

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src/hooks/useDataFeed.ts packages/jackcom/src/components/layout/AppLayout.tsx
git commit -m "feat(jackcom): Ctrl+L 清屏接通 store clearSequence"
```

---

### 任务 8：TitleBar 菜单 onClick 接通

**文件：**
- 修改：`packages/jackcom/src/components/layout/TitleBar.tsx`

- [ ] **步骤 1：修改 TitleBar 菜单配置**

修改 `packages/jackcom/src/components/layout/TitleBar.tsx`：

1. 在顶部 import 区添加：
```typescript
import { openUrl } from '@tauri-apps/plugin-shell'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
```

2. 在组件内部，从 store 解构中添加新字段：
```typescript
  const { activePortId, toggleSidebar, toggleHexDisplay, setSidebarTab, incrementClearSequence, toggleConnectionDialog } = useMainStore()
```

3. 修改 menus 数组：

**file 菜单**：将 `newConnection` 改为接通 ConnectionDialog：
```typescript
        { labelKey: 'menu.file.newConnection', shortcut: 'Ctrl+N', onClick: () => toggleConnectionDialog(true) },
```

将 `export` 改为接通导出功能：
```typescript
        { labelKey: 'menu.file.export', onClick: () => activePortId && exportCurrentSession() },
```

**connection 菜单**：将 `connect` 改为接通 ConnectionDialog：
```typescript
        { labelKey: 'menu.connection.connect', onClick: () => toggleConnectionDialog(true) },
```

将 `portSettings` 改为打开 ConnectionDialog（预填配置）：
```typescript
        { labelKey: 'menu.connection.portSettings', onClick: () => toggleConnectionDialog(true) },
```

**tools 菜单**：将 `clearTerminal` 的 disabled 移除，接通清屏：
```typescript
        { labelKey: 'menu.tools.clearTerminal', shortcut: 'Ctrl+L', onClick: () => incrementClearSequence() },
```

将 `export` 改为：
```typescript
        { labelKey: 'menu.tools.export', onClick: () => activePortId && exportCurrentSession() },
```

**help 菜单**：将 about 和 documentation 合并，移除 checkUpdates：
```typescript
        { labelKey: 'menu.help.about', onClick: () => openUrl('https://github.com/nicepkg/jackcom#readme') },
```

移除 `{ labelKey: 'menu.help.checkUpdates', disabled: true }` 和 `{ labelKey: 'menu.help.documentation', disabled: true }` 行。

4. 在 menus 定义之前添加 exportCurrentSession 辅助函数：
```typescript
  const exportCurrentSession = async () => {
    try {
      const filePath = await save({
        defaultPath: 'jackcom-export.csv',
        filters: [
          { name: 'CSV', extensions: ['csv'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'HEX', extensions: ['txt'] },
        ],
      })
      if (!filePath) return
      const ext = filePath.split('.').pop()?.toLowerCase()
      const format = ext === 'json' ? 'json' : ext === 'txt' ? 'hex' : 'csv'
      await invoke('export_data', { request: { session_id: null, format, file_path: filePath } })
    } catch {
      // 用户取消或导出失败，静默处理
    }
  }
```

- [ ] **步骤 2：验证编译**

运行：`cd packages/jackcom && pnpm build`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src/components/layout/TitleBar.tsx
git commit -m "feat(jackcom): TitleBar 菜单 onClick 接通，移除 Check Updates"
```

---

### 任务 9：Toolbar 接通 + AppLayout 渲染 ConnectionDialog

**文件：**
- 修改：`packages/jackcom/src/components/layout/Toolbar.tsx`
- 修改：`packages/jackcom/src/components/layout/AppLayout.tsx`

- [ ] **步骤 1：修改 Toolbar 连接按钮**

修改 `packages/jackcom/src/components/layout/Toolbar.tsx`：

1. 在 import 区添加：
```typescript
import { useMainStore } from '@/lib/store'
```

（如果已导入则跳过）

2. 从 store 解构中添加 `toggleConnectionDialog`：
```typescript
  const { connections, activePortId, toggleSidebar, toggleConnectionDialog } = useMainStore()
```

3. 替换连接按钮的 onClick：
```typescript
      <button
        onClick={() => {
          if (isOnline && activePortId) {
            close(activePortId).catch(() => {})
          } else {
            toggleConnectionDialog(true)
          }
        }}
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
        {isOnline ? `⏹ ${t('toolbar.disconnect')}` : `⚡ ${t('toolbar.connect')}`}
      </button>
```

注意：需要从 useSerialPort 导入 close，确保 Toolbar.tsx 中有：
```typescript
import { useSerialPort } from '@/hooks/useSerialPort'
```

并在组件内解构：
```typescript
  const { close } = useSerialPort()
```

- [ ] **步骤 2：在 AppLayout 中渲染 ConnectionDialog**

修改 `packages/jackcom/src/components/layout/AppLayout.tsx`：

1. 在 import 区添加：
```typescript
import { ConnectionDialog } from '@/components/connection/ConnectionDialog'
```

2. 在组件内从 store 解构添加：
```typescript
  const { activePortId, toggleSidebar, toggleHexDisplay, incrementClearSequence, connectionDialogOpen, toggleConnectionDialog } = useMainStore()
```

3. 在 return 的最外层 div 内，`<StatusBar />` 之后添加：
```typescript
      <ConnectionDialog
        open={connectionDialogOpen}
        onClose={() => toggleConnectionDialog(false)}
        onConnected={() => {}}
      />
```

- [ ] **步骤 3：验证编译**

运行：`cd packages/jackcom && pnpm build`
预期：编译通过

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src/components/layout/Toolbar.tsx packages/jackcom/src/components/layout/AppLayout.tsx
git commit -m "feat(jackcom): Toolbar 连接按钮接通，AppLayout 渲染 ConnectionDialog"
```

---

### 任务 10：i18n 翻译更新

**文件：**
- 修改：`packages/jackcom/src/i18n/locales/zh.json`
- 修改：`packages/jackcom/src/i18n/locales/en.json`

- [ ] **步骤 1：添加中文翻译**

在 `packages/jackcom/src/i18n/locales/zh.json` 末尾 `}` 前添加：

```json
  "connection.title": "连接到串口",
  "connection.recent": "最近连接",
  "connection.connect": "连接",
  "connection.connecting": "连接中...",
  "connection.noRecent": "暂无最近连接"
```

- [ ] **步骤 2：添加英文翻译**

在 `packages/jackcom/src/i18n/locales/en.json` 末尾 `}` 前添加：

```json
  "connection.title": "Connect to Serial Port",
  "connection.recent": "RECENT",
  "connection.connect": "Connect",
  "connection.connecting": "Connecting...",
  "connection.noRecent": "No recent connections"
```

- [ ] **步骤 3：运行 i18n 测试确认无回归**

运行：`cd packages/jackcom && pnpm test -- --run src/i18n/__tests__/i18n.test.tsx`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src/i18n/locales/zh.json packages/jackcom/src/i18n/locales/en.json
git commit -m "feat(jackcom): 添加 ConnectionDialog i18n 翻译"
```

---

## 自检

### 规格覆盖度

| 规格需求 | 对应任务 |
|----------|----------|
| store clearSequence | 任务 1 |
| store connectionDialogOpen | 任务 1 |
| useSerialConfig hook | 任务 2 |
| Tauri 插件依赖 | 任务 3 |
| PortSelector 组件 | 任务 4 |
| SerialConfigForm 组件 | 任务 5 |
| ConnectionDialog 组件 | 任务 6 |
| Ctrl+L 清屏接通 | 任务 7 |
| 菜单 onClick 接通 | 任务 8 |
| Toolbar 连接按钮 | 任务 9 |
| i18n 翻译 | 任务 10 |
| Export Data | 任务 8（exportCurrentSession） |
| About/Documentation | 任务 8（openUrl） |
| Check Updates 移除 | 任务 8 |
| Quick Send 菜单 | 已在 TitleBar 中实现 |

### 占位符扫描

无 TODO/TBD。所有代码步骤包含完整实现。

### 类型一致性

- `SerialConfig` interface 在 `useSerialConfig.ts` 中定义，被 `SerialConfigForm.tsx` 和 `ConnectionDialog.tsx` 引用
- `clearSequence: number` 和 `incrementClearSequence: () => void` 在 store 中定义，被 `useDataFeed.ts`、`AppLayout.tsx`、`TitleBar.tsx` 引用
- `connectionDialogOpen: boolean` 和 `toggleConnectionDialog: (open: boolean) => void` 在 store 中定义，被 `AppLayout.tsx`、`TitleBar.tsx`、`Toolbar.tsx` 引用
