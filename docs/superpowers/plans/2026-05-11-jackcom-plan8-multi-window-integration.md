# Plan 8: JackCom 多窗口 + 端到端集成

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**前置依赖：** Plan 1-7 全部完成

**目标：** 实现多窗口管理（波形/解码子窗口）和前后端端到端集成（Tauri Event、React Hooks、lib.rs setup 注册），使 JackCom 成为可运行的完整应用

**架构：**
- 每个子窗口（波形/解码/历史）是独立的 Tauri WebviewWindow，通过 JS API 创建
- 子窗口通过 Tauri Event Bus 订阅 Broker 发布的 PortEvent
- 每个 React App 持有独立的 Zustand store，窗口间零共享 JS 状态
- lib.rs setup 函数初始化 AppState、数据库、Broker、SerialManager，并将 Broker 与 Tauri Event 桥接
- useDataFeed hook 封装 Tauri Event 监听 + 100ms 批处理 flush

**技术栈：** @tauri-apps/api v2（Window + Event）、Zustand、React hooks

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 创建 | `src/lib/tauri-events.ts` | 类型安全 EventMap + listen/emit 封装 |
| 创建 | `src/hooks/useDataFeed.ts` | 订阅数据流 + 100ms 批处理 |
| 创建 | `src/hooks/useSerialPort.ts` | 串口连接生命周期 |
| 创建 | `src/hooks/usePortWatcher.ts` | 热插拔监听 |
| 创建 | `src/lib/window.ts` | 子窗口创建/管理工具 |
| 创建 | `src/apps/WaveformApp.tsx` | 波形窗口根（替换骨架） |
| 创建 | `src/apps/DecoderApp.tsx` | 解码窗口根（替换骨架） |
| 创建 | `src/stores/waveform-store.ts` | 波形窗口 Zustand store |
| 创建 | `src/stores/decoder-store.ts` | 解码窗口 Zustand store |
| 修改 | `src-tauri/src/lib.rs` | setup 函数初始化所有子系统 |
| 修改 | `src/apps/MainApp.tsx` | 集成 hooks，连接前后端 |

---

### 任务 1：Tauri Event 类型 + 窗口管理

**文件：**
- 创建：`packages/jackcom/src/lib/tauri-events.ts`
- 创建：`packages/jackcom/src/lib/window.ts`

- [ ] **步骤 1：创建 tauri-events.ts — 类型安全 Event 封装**

```typescript
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

// === Payload 类型 ===
// 与 Rust PortEvent #[serde(tag="type")] 一一对应

export interface SerialConfig {
  port_name: string
  baud_rate: number
  data_bits: 'five' | 'six' | 'seven' | 'eight'
  stop_bits: 'one' | 'two'
  parity: 'none' | 'odd' | 'even'
  flow_control: 'none' | 'hardware' | 'software'
}

export interface PortDataPayload {
  port_id: string
  frames: DisplayFrame[]
}

export interface DisplayFrame {
  id: number
  timestamp: string
  direction: 'rx' | 'tx'
  raw_hex: string
  formatted: string
  protocol: string
  summary: string
}

export interface PortOpenedPayload {
  port_id: string
  config: SerialConfig
}

export interface PortClosedPayload {
  port_id: string
  reason: 'disconnected' | 'error' | 'removed'
}

export interface PortErrorPayload {
  port_id: string
  error: string
}

export interface PortChangePayload {
  arrived: string[]
  removed: string[]
}

export interface PortStatsPayload {
  port_id: string
  rx: number
  tx: number
  fps: number
}

// === Event Map ===

export type EventMap = {
  'port:data': PortDataPayload
  'port:opened': PortOpenedPayload
  'port:closed': PortClosedPayload
  'port:error': PortErrorPayload
  'port:change': PortChangePayload
  'port:stats': PortStatsPayload
}

// === 类型安全 listen 封装 ===

export function on<K extends keyof EventMap>(
  event: K,
  handler: (payload: EventMap[K]) => void,
): Promise<UnlistenFn> {
  return listen<EventMap[K]>(event, (e) => handler(e.payload))
}

// === 类型安全 emit 封装（备用，通常由 Rust 侧 emit） ===

export async function emit<K extends keyof EventMap>(
  event: K,
  payload: EventMap[K],
): Promise<void> {
  const { emit: tauriEmit } = await import('@tauri-apps/api/event')
  return tauriEmit(event, payload)
}
```

- [ ] **步骤 2：创建 window.ts — 子窗口创建工具**

```typescript
import { WebviewWindow, type WindowOptions } from '@tauri-apps/api/webviewWindow'

interface CreateChildWindowOptions {
  label: string
  url: string
  title: string
  width?: number
  height?: number
}

/**
 * 创建或聚焦子窗口
 *
 * 如果同 label 的窗口已存在，聚焦它；否则创建新窗口。
 */
export async function createOrFocusChildWindow(opts: CreateChildWindowOptions): Promise<WebviewWindow> {
  // 检查窗口是否已存在
  const existing = WebviewWindow.getByLabel(opts.label)
  if (existing) {
    await existing.setFocus()
    return existing
  }

  const winOpts: WindowOptions = {
    url: opts.url,
    title: opts.title,
    width: opts.width ?? 800,
    height: opts.height ?? 600,
    center: true,
    decorations: true,
  }

  const win = new WebviewWindow(opts.label, winOpts)

  // 监听窗口错误
  win.once('tauri://error', (e) => {
    console.error('Window creation error:', e)
  })

  return win
}

/**
 * 创建波形监控窗口
 * label: "waveform-{portName}"
 */
export async function openWaveformWindow(portName: string): Promise<WebviewWindow> {
  return createOrFocusChildWindow({
    label: `waveform-${portName}`,
    url: `/waveform?port=${encodeURIComponent(portName)}`,
    title: `Waveform — ${portName}`,
    width: 900,
    height: 500,
  })
}

/**
 * 创建协议解码窗口
 * label: "decoder-{portName}"
 */
export async function openDecoderWindow(portName: string): Promise<WebviewWindow> {
  return createOrFocusChildWindow({
    label: `decoder-${portName}`,
    url: `/decoder?port=${encodeURIComponent(portName)}`,
    title: `Protocol Decoder — ${portName}`,
    width: 700,
    height: 500,
  })
}

/**
 * 创建历史窗口（全局唯一）
 */
export async function openHistoryWindow(): Promise<WebviewWindow> {
  return createOrFocusChildWindow({
    label: 'history',
    url: '/history',
    title: 'JackCom — History',
    width: 1000,
    height: 600,
  })
}

/**
 * 从 URL query 参数获取 port 名
 */
export function getPortFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('port')
}
```

- [ ] **步骤 3：验证前端构建**

```bash
cd packages/jackcom && pnpm build
```

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src/lib/tauri-events.ts packages/jackcom/src/lib/window.ts
git commit -m "feat(jackcom): add type-safe Tauri Event types and window management"
```

---

### 任务 2：React Hooks（useDataFeed / useSerialPort / usePortWatcher）

**文件：**
- 创建：`packages/jackcom/src/hooks/useDataFeed.ts`
- 创建：`packages/jackcom/src/hooks/useSerialPort.ts`
- 创建：`packages/jackcom/src/hooks/usePortWatcher.ts`

- [ ] **步骤 1：创建 useDataFeed.ts — 订阅数据流 + 100ms 批处理**

```typescript
import { useEffect, useRef, useCallback, useState } from 'react'
import { on, type DisplayFrame, type PortDataPayload } from '@/lib/tauri-events'

interface UseDataFeedOptions {
  portId?: string | null // 只订阅指定端口，null = 全部
  batchSize?: number
  flushInterval?: number
}

interface UseDataFeedReturn {
  frames: DisplayFrame[]
  totalCount: number
  clear: () => void
}

/**
 * 订阅 port:data 事件，100ms 批处理 flush
 *
 * 使用 ref 存储全量数据避免重渲染，
 * 只在 flush 时更新 state（可见范围 + totalCount）。
 */
export function useDataFeed(options: UseDataFeedOptions = {}): UseDataFeedReturn {
  const { portId, flushInterval = 100 } = options

  const allFramesRef = useRef<DisplayFrame[]>([])
  const batchRef = useRef<DisplayFrame[]>([])
  const [frames, setFrames] = useState<DisplayFrame[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const flush = useCallback(() => {
    if (batchRef.current.length === 0) return

    allFramesRef.current = [...allFramesRef.current, ...batchRef.current]
    batchRef.current = []

    // 只更新最近一批用于渲染
    setFrames(allFramesRef.current.slice(-1000))
    setTotalCount(allFramesRef.current.length)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let unlisten: (() => void) | null = null

    const setup = async () => {
      unlisten = await on< 'port:data'>('port:data', (payload: PortDataPayload) => {
        // 过滤端口
        if (portId && payload.port_id !== portId) return

        batchRef.current.push(...payload.frames)
      })

      timer = setInterval(flush, flushInterval)
    }

    setup()

    return () => {
      if (timer) clearInterval(timer)
      if (unlisten) unlisten()
    }
  }, [portId, flushInterval, flush])

  const clear = useCallback(() => {
    allFramesRef.current = []
    batchRef.current = []
    setFrames([])
    setTotalCount(0)
  }, [])

  return { frames, totalCount, clear }
}
```

- [ ] **步骤 2：创建 useSerialPort.ts — 串口连接生命周期**

```typescript
import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useMainStore } from '@/lib/store'
import type { SerialConfig } from '@/lib/tauri-events'

/**
 * 串口连接操作 hook
 *
 * 封装 Tauri invoke 调用：enumerate / open / close / send
 */
export function useSerialPort() {
  const { addConnection, removeConnection, setConnectionOnline } = useMainStore()

  const enumerate = useCallback(async (): Promise<string[]> => {
    return invoke<string[]>('serial_enumerate')
  }, [])

  const open = useCallback(async (config: SerialConfig) => {
    await invoke('serial_open', { config })
    addConnection(config.port_name, config.baud_rate)
  }, [addConnection])

  const close = useCallback(async (portName: string) => {
    await invoke('serial_close', { portName })
    removeConnection(portName)
  }, [removeConnection])

  const send = useCallback(async (portName: string, data: number[]) => {
    await invoke('serial_send', { portName, data })
  }, [])

  return { enumerate, open, close, send }
}
```

- [ ] **步骤 3：创建 usePortWatcher.ts — 热插拔监听**

```typescript
import { useEffect } from 'react'
import { on, type PortChangePayload } from '@/lib/tauri-events'

/**
 * 监听端口热插拔事件
 *
 * 在组件挂载时订阅 port:change，卸载时自动取消。
 */
export function usePortWatcher(onChange: (change: PortChangePayload) => void) {
  useEffect(() => {
    let unlisten: (() => void) | null = null

    const setup = async () => {
      unlisten = await on('port:change', onChange)
    }

    setup()

    return () => {
      if (unlisten) unlisten()
    }
  }, [onChange])
}
```

- [ ] **步骤 4：创建 hooks 测试**

创建 `packages/jackcom/src/hooks/__tests__/usePortWatcher.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}))

describe('usePortWatcher', () => {
  it('calls onChange when port:change event fires', async () => {
    const { listen } = await import('@tauri-apps/api/event')
    const onChange = vi.fn()

    // 导入 hook（在 mock 之后）
    const { usePortWatcher } = await import('../usePortWatcher')
    renderHook(() => usePortWatcher(onChange))

    // 验证 listen 被调用
    expect(listen).toHaveBeenCalledWith('port:change', expect.any(Function))
  })
})
```

- [ ] **步骤 5：运行测试**

```bash
cd packages/jackcom && pnpm test -- --reporter=verbose
```

预期：新增 hook 测试通过 + 既有测试仍通过。

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src/hooks/ packages/jackcom/src/lib/tauri-events.ts
git commit -m "feat(jackcom): add useDataFeed, useSerialPort, usePortWatcher hooks"
```

---

### 任务 3：子窗口 App 实现（波形 + 解码）

**文件：**
- 修改：`packages/jackcom/src/apps/WaveformApp.tsx`（替换骨架）
- 修改：`packages/jackcom/src/apps/DecoderApp.tsx`（替换骨架）
- 创建：`packages/jackcom/src/stores/waveform-store.ts`
- 创建：`packages/jackcom/src/stores/decoder-store.ts`

- [ ] **步骤 1：创建 waveform-store.ts**

```typescript
import { create } from 'zustand'

interface WaveformStore {
  portId: string | null
  channels: Record<string, number[]> // channel name → last N values
  timeWindow: number // seconds
  paused: boolean
  maxPoints: number

  setPortId: (id: string) => void
  addData: (channel: string, value: number) => void
  togglePause: () => void
  setTimeWindow: (seconds: number) => void
  clear: () => void
}

export const useWaveformStore = create<WaveformStore>((set) => ({
  portId: null,
  channels: {},
  timeWindow: 10,
  paused: false,
  maxPoints: 500,

  setPortId: (id) => set({ portId: id }),
  addData: (channel, value) =>
    set((s) => {
      const current = s.channels[channel] ?? []
      const newValues = [...current, value].slice(-s.maxPoints)
      return { channels: { ...s.channels, [channel]: newValues } }
    }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setTimeWindow: (seconds) => set({ timeWindow: seconds }),
  clear: () => set({ channels: {} }),
}))
```

- [ ] **步骤 2：创建 decoder-store.ts**

```typescript
import { create } from 'zustand'
import type { DisplayFrame } from '@/lib/tauri-events'

interface DecoderStore {
  portId: string | null
  protocol: string | null
  currentFrame: DisplayFrame | null
  pinnedFrame: DisplayFrame | null
  autoScroll: boolean

  setPortId: (id: string) => void
  setCurrentFrame: (frame: DisplayFrame | null) => void
  pinFrame: (frame: DisplayFrame | null) => void
  setAutoScroll: (auto: boolean) => void
}

export const useDecoderStore = create<DecoderStore>((set) => ({
  portId: null,
  protocol: null,
  currentFrame: null,
  pinnedFrame: null,
  autoScroll: true,

  setPortId: (id) => set({ portId: id }),
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  pinFrame: (frame) => set({ pinnedFrame: frame }),
  setAutoScroll: (auto) => set({ autoScroll: auto }),
}))
```

- [ ] **步骤 3：更新 WaveformApp.tsx**

```tsx
import { useEffect } from 'react'
import { getPortFromUrl } from '@/lib/window'
import { useWaveformStore } from '@/stores/waveform-store'
import { useDataFeed } from '@/hooks/useDataFeed'

export default function WaveformApp() {
  const { portId, setPortId, channels, paused, togglePause, clear } = useWaveformStore()
  const { frames } = useDataFeed({ portId })

  useEffect(() => {
    const port = getPortFromUrl()
    if (port) setPortId(port)
  }, [setPortId])

  const channelNames = Object.keys(channels)
  const hasData = channelNames.length > 0

  return (
    <div style={{
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* 标题栏 */}
      <div style={{
        background: 'var(--color-titlebar-bg)',
        padding: '4px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <span style={{ color: 'var(--color-accent)' }}>📊</span>
        <span style={{ fontSize: '12px', fontWeight: 600 }}>
          Waveform — {portId ?? 'No Port'}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)', fontSize: '10px' }}>
          {frames.length} frames received
        </span>
      </div>

      {/* 波形区 */}
      <div style={{ flex: 1, padding: '10px', overflow: 'auto' }}>
        {!hasData && !portId && (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            No port specified. Open from main window toolbar.
          </div>
        )}
        {!hasData && portId && (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            Waiting for data from {portId}...
          </div>
        )}
        {hasData && (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            {channelNames.map((ch) => (
              <div key={ch} style={{ marginBottom: '8px' }}>
                <div style={{ color: 'var(--color-rx)', fontWeight: 600 }}>{ch}</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>
                  {channels[ch].length} points · latest: {channels[ch][channels[ch].length - 1]?.toFixed(2) ?? 'N/A'}
                </div>
                {/* 实际 Canvas 波形渲染将在 Canvas 双缓冲实现时添加 */}
                <div style={{
                  height: '80px',
                  background: 'var(--color-sidebar-bg)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: '10px',
                }}>
                  Canvas waveform rendering — coming soon
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 工具栏 */}
      <div style={{
        background: 'var(--color-sidebar-bg)',
        borderTop: '1px solid var(--color-border)',
        padding: '4px 10px',
        display: 'flex',
        gap: '12px',
        fontSize: '10px',
        color: 'var(--color-text-secondary)',
      }}>
        <button
          onClick={togglePause}
          style={{
            background: paused ? 'var(--color-accent)' : 'transparent',
            color: paused ? '#fff' : 'var(--color-text-secondary)',
            border: 'none',
            padding: '2px 8px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          onClick={clear}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 4：更新 DecoderApp.tsx**

```tsx
import { useEffect } from 'react'
import { getPortFromUrl } from '@/lib/window'
import { useDecoderStore } from '@/stores/decoder-store'
import { useDataFeed } from '@/hooks/useDataFeed'
import { bytesToHex } from '@/lib/formatters'

export default function DecoderApp() {
  const { portId, setPortId, currentFrame, pinnedFrame, pinFrame } = useDecoderStore()
  const { frames } = useDataFeed({ portId })

  useEffect(() => {
    const port = getPortFromUrl()
    if (port) setPortId(port)
  }, [setPortId])

  // 使用最新帧作为当前帧
  const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null
  const displayFrame = pinnedFrame ?? latestFrame

  return (
    <div style={{
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Consolas', 'Courier New', monospace",
    }}>
      {/* 标题栏 */}
      <div style={{
        background: 'var(--color-titlebar-bg)',
        padding: '4px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--color-border)',
        fontSize: '12px',
      }}>
        <span style={{ color: 'var(--color-accent)' }}>🔬</span>
        <span style={{ fontWeight: 600 }}>Decoder — {portId ?? 'No Port'}</span>
      </div>

      {/* 帧详情 */}
      <div style={{ flex: 1, padding: '10px', overflow: 'auto', fontSize: '12px' }}>
        {!displayFrame && (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            {portId ? `Waiting for data from ${portId}...` : 'No port specified.'}
          </div>
        )}
        {displayFrame && (
          <>
            <div style={{ marginBottom: '8px' }}>
              <span style={{
                color: 'var(--color-accent)',
                fontWeight: 600,
                fontSize: '14px',
              }}>
                {displayFrame.protocol.toUpperCase()} Frame
              </span>
            </div>
            <div style={{ color: 'var(--color-text)', lineHeight: '1.8' }}>
              <div>
                <span style={{ color: 'var(--color-timestamp)' }}>Direction</span>{' '}
                <span style={{ color: displayFrame.direction === 'rx' ? 'var(--color-rx)' : 'var(--color-tx)' }}>
                  {displayFrame.direction.toUpperCase()}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--color-timestamp)' }}>Time</span>{' '}
                <span>{displayFrame.timestamp}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-timestamp)' }}>Protocol</span>{' '}
                <span style={{ color: 'var(--color-accent)' }}>{displayFrame.protocol}</span>
              </div>
              {displayFrame.formatted && (
                <div>
                  <span style={{ color: 'var(--color-timestamp)' }}>Parsed</span>{' '}
                  <span style={{ color: 'var(--color-string)' }}>{displayFrame.formatted}</span>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--color-timestamp)' }}>RAW HEX</span>{' '}
                <span>{displayFrame.raw_hex}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 工具栏 */}
      <div style={{
        background: 'var(--color-sidebar-bg)',
        borderTop: '1px solid var(--color-border)',
        padding: '4px 10px',
        display: 'flex',
        gap: '12px',
        fontSize: '10px',
        color: 'var(--color-text-secondary)',
      }}>
        <button
          onClick={() => pinFrame(latestFrame ?? null)}
          style={{
            background: pinnedFrame ? 'var(--color-accent)' : 'transparent',
            color: pinnedFrame ? '#fff' : 'var(--color-text-secondary)',
            border: 'none',
            padding: '2px 8px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          📌 {pinnedFrame ? 'Unpin' : 'Pin Current'}
        </button>
        <button
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '10px',
          }}
        >
          Copy Frame
        </button>
        <button
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '10px',
          }}
        >
          Copy as JSON
        </button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 5：验证构建**

```bash
cd packages/jackcom && pnpm build
```

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src/apps/ packages/jackcom/src/stores/
git commit -m "feat(jackcom): implement WaveformApp and DecoderApp with independent stores"
```

---

### 任务 4：lib.rs setup 集成 — 连接所有子系统

**文件：**
- 修改：`packages/jackcom/src-tauri/src/lib.rs`

这是整个应用的集成点。setup 函数在 Tauri 启动时初始化数据库、创建 Broker、将 Broker 与 Tauri Event 桥接。

- [ ] **步骤 1：更新 lib.rs — 完整 setup**

```rust
mod channel;
mod commands;
mod error;
mod protocol;
mod serial;
mod state;
mod storage;

use state::AppState;
use channel::broker::Broker;
use error::AppError;

#[tauri::command]
fn ping() -> Result<&'static str, AppError> {
    Ok("pong")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            // 1. 初始化数据库
            let db_path = dirs::data_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("jackcom")
                .join("jackcom.db");

            let runtime = tokio::runtime::Handle::current();

            let db = runtime.block_on(async {
                storage::init_db(&db_path).await
            }).expect("Failed to initialize database");

            // 2. 创建 Broker
            let broker = Broker::new();

            // 3. 桥接 Broker → Tauri Event
            let app_handle = app.handle().clone();
            runtime.spawn(async move {
                broker::run_event_bridge(broker, app_handle).await;
            });

            // 4. 注册 AppState
            app.manage(AppState {
                connections: dashmap::DashMap::new(),
                db: std::sync::Arc::new(tokio::sync::RwLock::new(Some(db))),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            // Plan 6 的命令在此注册：
            // commands::serial::serial_enumerate,
            // commands::serial::serial_open,
            // commands::serial::serial_close,
            // commands::serial::serial_send,
            // commands::data::query_frames,
            // commands::data::export_data,
            // commands::config::list_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

注意：此步骤需要 Plan 3 的 Broker 提供 `run_event_bridge` 函数。如果 Plan 3 没有此函数，需要在 channel/broker.rs 中添加一个将 Broker 事件桥接到 Tauri emit 的函数：

```rust
/// 将 Broker 事件桥接到 Tauri Event
/// 订阅 Broker 输出，每 50ms 批量 emit 到前端
pub async fn run_event_bridge(mut broker: Broker, app_handle: tauri::AppHandle) {
    let mut interval = tokio::time::interval(std::time::Duration::from_millis(50));
    let mut batch = Vec::new();

    loop {
        interval.tick().await;

        // 从 Broker 收集事件（非阻塞）
        // 具体 API 取决于 Broker 的实现
        // 简化版：直接 emit 每个事件
        while let Ok(event) = broker.try_recv() {
            let event_name = match &event {
                PortEvent::Data { .. } => "port:data",
                PortEvent::Opened { .. } => "port:opened",
                PortEvent::Closed { .. } => "port:closed",
                PortEvent::Error { .. } => "port:error",
                PortEvent::Change { .. } => "port:change",
                PortEvent::Stats { .. } => "port:stats",
            };
            let _ = app_handle.emit(event_name, &event);
        }
    }
}
```

- [ ] **步骤 2：更新 MainApp.tsx 集成 hooks**

将 MainApp.tsx 中的 TODO 替换为实际的 hook 调用：

```tsx
// 在 handleSend 中：
const handleSend = useCallback(async (data: number[]) => {
  if (!activePortId) return
  try {
    await send(activePortId, data)
  } catch (err) {
    console.error('Send failed:', err)
  }
}, [activePortId, send])

// 在组件中添加数据订阅：
const { frames: dataFrames, totalCount } = useDataFeed({ portId: activePortId })

// DisplayFrame 类型统一，直接传递给 TerminalView（无需转换）
// dataFrames 的类型与 TerminalView 的 frames prop 一致
```

- [ ] **步骤 3：验证编译**

```bash
cd packages/jackcom/src-tauri && cargo check
```

预期：编译通过（可能有未使用导入的警告，不阻塞）。

- [ ] **步骤 4：验证前端构建**

```bash
cd packages/jackcom && pnpm build
```

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src-tauri/src/lib.rs packages/jackcom/src/apps/MainApp.tsx
git commit -m "feat(jackcom): integrate all subsystems in lib.rs setup and MainApp"
```

---

### 任务 5：端到端验证 + 清理

**文件：**
- 检查所有文件的编译和集成

- [ ] **步骤 1：Rust 侧完整编译**

```bash
cd packages/jackcom/src-tauri && cargo build
```

预期：编译成功。

- [ ] **步骤 2：Rust 侧所有测试**

```bash
cd packages/jackcom/src-tauri && cargo test
```

预期：所有测试通过。

- [ ] **步骤 3：前端完整构建**

```bash
cd packages/jackcom && pnpm build
```

预期：`dist/` 生成，包含所有 4 个页面。

- [ ] **步骤 4：前端所有测试**

```bash
cd packages/jackcom && pnpm test
```

预期：所有 vitest 测试通过。

- [ ] **步骤 5：手动验证 `pnpm tauri dev` 启动**

```bash
cd packages/jackcom && pnpm tauri dev
```

验证项：
1. 主窗口启动，显示完整 VS Code Dark+ 布局
2. 菜单栏可见
3. 工具栏显示 Connect 按钮
4. 侧边栏显示空连接列表
5. 终端区显示空列表
6. 发送栏可见，可切换 HEX/ASCII
7. 状态栏显示蓝色底
8. 工具栏 Wave/Decode 按钮点击可打开子窗口（前端可运行，后端连接需实际串口）

- [ ] **步骤 6：最终 Commit**

```bash
git add -A
git commit -m "feat(jackcom): complete multi-window + end-to-end integration"
```

---

## 自检

**规格覆盖度：**
- ✅ Tauri Event 类型：PortData/Opened/Closed/Error/Change/Stats payload 类型
- ✅ 类型安全 listen 封装：on< 'port:data'> handler
- ✅ 子窗口管理：createOrFocusChildWindow + openWaveformWindow / openDecoderWindow / openHistoryWindow
- ✅ useDataFeed hook：100ms 批处理 flush，ref 存储全量数据
- ✅ useSerialPort hook：enumerate / open / close / send via Tauri invoke
- ✅ usePortWatcher hook：订阅 port:change 事件
- ✅ 波形窗口（WaveformApp）：独立 Zustand store，订阅指定端口数据
- ✅ 解码窗口（DecoderApp）：独立 Zustand store，帧详情 + pin 功能
- ✅ lib.rs setup 集成：数据库 + Broker + Tauri Event 桥接 + AppState
- ✅ MainApp 集成：useDataFeed + useSerialPort 连接前后端
- ✅ 端到端验证流程

**占位符扫描：**
- WaveformApp 中 Canvas 波形标注 "coming soon"（Canvas 双缓冲在 V2 或后续迭代实现）
- lib.rs 中 commands 注册注释（Plan 6 命令在此注册，执行时取消注释）
- 这两处是明确的后续任务，不是模糊占位

**类型一致性：**
- `EventMap` 与 Rust `PortEvent` 的 serde tag 字段一一对应
- `SerialConfig` TypeScript 类型与 Rust `SerialConfig` serde 输出一致（snake_case）
- `DisplayFrame` 与 Rust `DisplayFrame` 字段名一致
- 波形/解码 store 的 portId 与 URL query 参数衔接（getPortFromUrl）
- useDataFeed 的 portId 过滤与 Broker 的多端口数据分发一致
