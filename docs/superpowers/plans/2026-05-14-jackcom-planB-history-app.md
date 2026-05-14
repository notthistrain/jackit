# HistoryApp 历史会话浏览 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 HistoryApp 从骨架替换为完整的双栏历史会话浏览器（左会话列表 + 右帧数据表格），支持过滤、分页、帧详情展开。

**架构：** 新建 Zustand history-store 管理会话列表/帧数据/过滤条件/分页状态。新建 useHistory hook 封装 Tauri command 调用。新建 SessionList、FrameTable、FrameDetail、FilterBar 四个组件。HistoryApp 组合这些组件。

**技术栈：** React 19 + Zustand 5 + Tauri v2 invoke（query_history / list_recent_sessions / export_data）

**规格文档：** `docs/superpowers/specs/2026-05-14-jackcom-placeholder-features-design.md` 第 1 节

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `packages/jackcom/src/stores/history-store.ts` | 历史窗口 Zustand store（会话列表、帧数据、分页、过滤） |
| `packages/jackcom/src/hooks/useHistory.ts` | 封装 Tauri command 调用（list_recent_sessions、query_history、export_data） |
| `packages/jackcom/src/components/history/SessionList.tsx` | 左栏会话列表 |
| `packages/jackcom/src/components/history/FrameTable.tsx` | 右栏帧数据表格 |
| `packages/jackcom/src/components/history/FrameDetail.tsx` | 帧展开详情面板 |
| `packages/jackcom/src/components/history/FilterBar.tsx` | 过滤栏（方向 + 协议） |
| `packages/jackcom/src/stores/__tests__/history-store.test.ts` | history-store 测试 |
| `packages/jackcom/src/hooks/__tests__/useHistory.test.ts` | useHistory 测试 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `packages/jackcom/src/apps/HistoryApp.tsx` | 从骨架替换为完整实现 |
| `packages/jackcom/src/i18n/locales/zh.json` | 添加历史相关翻译 |
| `packages/jackcom/src/i18n/locales/en.json` | 添加历史相关翻译 |

---

### 任务 1：history-store

**文件：**
- 创建：`packages/jackcom/src/stores/history-store.ts`
- 测试：`packages/jackcom/src/stores/__tests__/history-store.test.ts`

- [ ] **步骤 1：编写 history-store 测试**

创建 `packages/jackcom/src/stores/__tests__/history-store.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useHistoryStore } from '../history-store'

describe('useHistoryStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useHistoryStore.setState({
      sessions: [],
      selectedSessionId: null,
      frames: [],
      totalFrames: 0,
      page: 0,
      pageSize: 50,
      directionFilter: 'all',
      protocolFilter: null,
      expandedFrameId: null,
      loading: false,
      error: null,
    })
  })

  it('sets sessions', () => {
    const sessions = [{ id: 1, port_name: 'COM3', baud_rate: 115200, created_at: '2026-05-14T10:00:00Z' }]
    useHistoryStore.getState().setSessions(sessions as any)
    expect(useHistoryStore.getState().sessions).toEqual(sessions)
  })

  it('selects session', () => {
    useHistoryStore.getState().selectSession(42)
    expect(useHistoryStore.getState().selectedSessionId).toBe(42)
  })

  it('sets frames with total', () => {
    useHistoryStore.getState().setFrames([{ id: 1 } as any], 100)
    expect(useHistoryStore.getState().frames).toHaveLength(1)
    expect(useHistoryStore.getState().totalFrames).toBe(100)
  })

  it('sets page', () => {
    useHistoryStore.getState().setPage(3)
    expect(useHistoryStore.getState().page).toBe(3)
  })

  it('sets direction filter', () => {
    useHistoryStore.getState().setDirectionFilter('rx')
    expect(useHistoryStore.getState().directionFilter).toBe('rx')
  })

  it('sets protocol filter', () => {
    useHistoryStore.getState().setProtocolFilter('modbus')
    expect(useHistoryStore.getState().protocolFilter).toBe('modbus')
  })

  it('toggles frame expand', () => {
    useHistoryStore.getState().toggleFrameExpand(5)
    expect(useHistoryStore.getState().expandedFrameId).toBe(5)
    // 再次点击取消展开
    useHistoryStore.getState().toggleFrameExpand(5)
    expect(useHistoryStore.getState().expandedFrameId).toBeNull()
  })

  it('sets loading and error', () => {
    useHistoryStore.getState().setLoading(true)
    expect(useHistoryStore.getState().loading).toBe(true)
    useHistoryStore.getState().setError('test error')
    expect(useHistoryStore.getState().error).toBe('test error')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm test -- --run src/stores/__tests__/history-store.test.ts`
预期：FAIL — 模块找不到

- [ ] **步骤 3：实现 history-store**

创建 `packages/jackcom/src/stores/history-store.ts`：

```typescript
import { create } from 'zustand'
import type { DisplayFrame } from '@/lib/tauri-events'

export interface SessionRow {
  id: number
  port_name: string
  baud_rate: number
  created_at: string
}

interface HistoryStore {
  sessions: SessionRow[]
  selectedSessionId: number | null
  frames: DisplayFrame[]
  totalFrames: number
  page: number
  pageSize: number
  directionFilter: 'all' | 'rx' | 'tx'
  protocolFilter: string | null
  expandedFrameId: number | null
  loading: boolean
  error: string | null

  setSessions: (sessions: SessionRow[]) => void
  selectSession: (id: number) => void
  setFrames: (frames: DisplayFrame[], total: number) => void
  setPage: (page: number) => void
  setDirectionFilter: (dir: 'all' | 'rx' | 'tx') => void
  setProtocolFilter: (proto: string | null) => void
  toggleFrameExpand: (id: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  sessions: [],
  selectedSessionId: null,
  frames: [],
  totalFrames: 0,
  page: 0,
  pageSize: 50,
  directionFilter: 'all',
  protocolFilter: null,
  expandedFrameId: null,
  loading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),
  selectSession: (id) => set({ selectedSessionId: id, page: 0, expandedFrameId: null }),
  setFrames: (frames, total) => set({ frames, totalFrames: total }),
  setPage: (page) => set({ page }),
  setDirectionFilter: (directionFilter) => set({ directionFilter, page: 0 }),
  setProtocolFilter: (protocolFilter) => set({ protocolFilter, page: 0 }),
  toggleFrameExpand: (id) =>
    set(s => ({ expandedFrameId: s.expandedFrameId === id ? null : id })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm test -- --run src/stores/__tests__/history-store.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src/stores/history-store.ts packages/jackcom/src/stores/__tests__/history-store.test.ts
git commit -m "feat(jackcom): 添加 history-store 历史会话状态管理"
```

---

### 任务 2：useHistory hook

**文件：**
- 创建：`packages/jackcom/src/hooks/useHistory.ts`
- 测试：`packages/jackcom/src/hooks/__tests__/useHistory.test.ts`

- [ ] **步骤 1：编写 useHistory 测试**

创建 `packages/jackcom/src/hooks/__tests__/useHistory.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}))

import { useHistory } from '../useHistory'

describe('useHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads sessions', async () => {
    const sessions = [{ id: 1, port_name: 'COM3', baud_rate: 115200, created_at: '2026-05-14' }]
    mockInvoke.mockResolvedValueOnce({ sessions })

    const { result } = renderHook(() => useHistory())

    await act(async () => {
      await result.current.loadSessions()
    })

    expect(mockInvoke).toHaveBeenCalledWith('list_recent_sessions', { request: { limit: 20 } })
    expect(result.current.store.sessions).toHaveLength(1)
  })

  it('loads frames for session', async () => {
    const frames = [{ id: 1, timestamp: '2026-05-14', direction: 'rx', raw_hex: 'AA', formatted: 'test', protocol: 'raw', summary: '1 byte' }]
    mockInvoke.mockResolvedValueOnce({ frames, total: 1 })

    const { result } = renderHook(() => useHistory())

    await act(async () => {
      await result.current.loadFrames(1)
    })

    expect(mockInvoke).toHaveBeenCalledWith('query_history', {
      request: {
        session_id: 1,
        direction: undefined,
        protocol: undefined,
        limit: 50,
        offset: 0,
      },
    })
    expect(result.current.store.frames).toHaveLength(1)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jackcom && pnpm test -- --run src/hooks/__tests__/useHistory.test.ts`
预期：FAIL

- [ ] **步骤 3：实现 useHistory hook**

创建 `packages/jackcom/src/hooks/useHistory.ts`：

```typescript
import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useHistoryStore, type SessionRow } from '@/stores/history-store'

export function useHistory() {
  const store = useHistoryStore()

  const loadSessions = useCallback(async () => {
    try {
      store.setLoading(true)
      store.setError(null)
      const res = await invoke<{ sessions: SessionRow[] }>('list_recent_sessions', {
        request: { limit: 20 },
      })
      store.setSessions(res.sessions)
    } catch (e: any) {
      store.setError(String(e))
    } finally {
      store.setLoading(false)
    }
  }, [store])

  const loadFrames = useCallback(async (sessionId: number) => {
    try {
      store.setLoading(true)
      store.setError(null)
      const { directionFilter, protocolFilter, page, pageSize } = useHistoryStore.getState()
      const res = await invoke<{ frames: any[]; total: number }>('query_history', {
        request: {
          session_id: sessionId,
          direction: directionFilter === 'all' ? undefined : directionFilter,
          protocol: protocolFilter,
          limit: pageSize,
          offset: page * pageSize,
        },
      })
      store.setFrames(res.frames, res.total)
    } catch (e: any) {
      store.setError(String(e))
    } finally {
      store.setLoading(false)
    }
  }, [store])

  const exportCsv = useCallback(async (sessionId: number) => {
    try {
      const res = await invoke<{ file_path: string }>('export_data', {
        request: { session_id: sessionId, format: 'csv', file_path: `jackcom-session-${sessionId}.csv` },
      })
      return res.file_path
    } catch {
      return null
    }
  }, [])

  return { store, loadSessions, loadFrames, exportCsv }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jackcom && pnpm test -- --run src/hooks/__tests__/useHistory.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src/hooks/useHistory.ts packages/jackcom/src/hooks/__tests__/useHistory.test.ts
git commit -m "feat(jackcom): 添加 useHistory hook 封装 Tauri 历史命令"
```

---

### 任务 3：SessionList 组件

**文件：**
- 创建：`packages/jackcom/src/components/history/SessionList.tsx`

- [ ] **步骤 1：创建 SessionList 组件**

创建 `packages/jackcom/src/components/history/SessionList.tsx`：

```typescript
import type { SessionRow } from '@/stores/history-store'

interface SessionListProps {
  sessions: SessionRow[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function SessionList({ sessions, selectedId, onSelect }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: '11px',
        padding: '20px',
        textAlign: 'center',
      }}>
        暂无会话记录
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {sessions.map(session => {
        const isSelected = session.id === selectedId
        return (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            style={{
              padding: '6px 10px',
              background: isSelected ? '#094771' : 'transparent',
              cursor: 'pointer',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '11px' }}>
              {session.port_name} @ {session.baud_rate}
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>
              {new Date(session.created_at).toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src/components/history/SessionList.tsx
git commit -m "feat(jackcom): 添加 SessionList 会话列表组件"
```

---

### 任务 4：FilterBar + FrameDetail 组件

**文件：**
- 创建：`packages/jackcom/src/components/history/FilterBar.tsx`
- 创建：`packages/jackcom/src/components/history/FrameDetail.tsx`

- [ ] **步骤 1：创建 FilterBar 组件**

创建 `packages/jackcom/src/components/history/FilterBar.tsx`：

```typescript
interface FilterBarProps {
  direction: 'all' | 'rx' | 'tx'
  protocol: string | null
  onDirectionChange: (dir: 'all' | 'rx' | 'tx') => void
  onProtocolChange: (proto: string | null) => void
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '1px 6px',
  borderRadius: '2px',
  fontSize: '10px',
  cursor: 'pointer',
  background: active ? '#094771' : 'transparent',
  color: active ? '#fff' : 'var(--color-text-secondary)',
  border: 'none',
})

export function FilterBar({ direction, protocol, onDirectionChange, onProtocolChange }: FilterBarProps) {
  const directions: Array<{ value: 'all' | 'rx' | 'tx'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'rx', label: 'RX' },
    { value: 'tx', label: 'TX' },
  ]
  const protocols: Array<{ value: string | null; label: string }> = [
    { value: null, label: 'All' },
    { value: 'raw', label: 'Raw' },
    { value: 'modbus', label: 'Modbus' },
    { value: 'at', label: 'AT' },
    { value: 'json', label: 'JSON' },
  ]

  return (
    <div style={{
      padding: '4px 10px',
      background: 'var(--color-sidebar-bg)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>Filter:</span>
      {directions.map(d => (
        <button key={d.value} style={pillStyle(direction === d.value)} onClick={() => onDirectionChange(d.value)}>
          {d.label}
        </button>
      ))}
      <span style={{ color: 'var(--color-border)' }}>|</span>
      {protocols.map(p => (
        <button key={p.label} style={pillStyle(protocol === p.value)} onClick={() => onProtocolChange(p.value)}>
          {p.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **步骤 2：创建 FrameDetail 组件**

创建 `packages/jackcom/src/components/history/FrameDetail.tsx`：

```typescript
import type { DisplayFrame } from '@/lib/tauri-events'

interface FrameDetailProps {
  frame: DisplayFrame
}

export function FrameDetail({ frame }: FrameDetailProps) {
  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--color-sidebar-bg)',
      borderTop: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
        Frame #{frame.id} · {frame.timestamp}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-text)', fontFamily: 'Consolas, monospace', wordBreak: 'break-all' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginBottom: '2px' }}>HEX:</div>
        <div style={{ color: 'var(--color-rx)' }}>{frame.raw_hex}</div>
      </div>
      {frame.formatted && (
        <div style={{ marginTop: '4px', fontSize: '11px', fontFamily: 'Consolas, monospace' }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginBottom: '2px' }}>Parsed:</div>
          <div style={{ color: 'var(--color-text)' }}>{frame.formatted}</div>
        </div>
      )}
      {frame.summary && (
        <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
          {frame.summary}
        </div>
      )}
    </div>
  )
}
```

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src/components/history/FilterBar.tsx packages/jackcom/src/components/history/FrameDetail.tsx
git commit -m "feat(jackcom): 添加 FilterBar 和 FrameDetail 组件"
```

---

### 任务 5：FrameTable 组件

**文件：**
- 创建：`packages/jackcom/src/components/history/FrameTable.tsx`

- [ ] **步骤 1：创建 FrameTable 组件**

创建 `packages/jackcom/src/components/history/FrameTable.tsx`：

```typescript
import type { DisplayFrame } from '@/lib/tauri-events'
import { FrameDetail } from './FrameDetail'

interface FrameTableProps {
  frames: DisplayFrame[]
  expandedFrameId: number | null
  onToggleExpand: (id: number) => void
}

const dirColor = (dir: string) => dir === 'rx' ? 'var(--color-rx)' : 'var(--color-tx)'
const protoColor = (proto: string) => {
  switch (proto.toLowerCase()) {
    case 'modbus': return '#569CD6'
    case 'at': return '#CE9178'
    case 'json': return '#DCDCAA'
    default: return 'var(--color-text)'
  }
}

export function FrameTable({ frames, expandedFrameId, onToggleExpand }: FrameTableProps) {
  if (frames.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: '11px',
      }}>
        选择左侧会话以查看帧数据
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-editor-bg)' }}>
      {/* 表头 */}
      <div style={{
        display: 'flex',
        padding: '4px 10px',
        background: 'var(--color-sidebar-bg)',
        color: 'var(--color-text-secondary)',
        fontSize: '10px',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}>
        <span style={{ width: '90px' }}>Time</span>
        <span style={{ width: '30px' }}>Dir</span>
        <span style={{ width: '60px' }}>Protocol</span>
        <span style={{ flex: 1 }}>Data</span>
      </div>
      {/* 数据行 */}
      {frames.map(frame => {
        const isExpanded = frame.id === expandedFrameId
        const timeStr = new Date(frame.timestamp).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        })
        return (
          <div key={frame.id}>
            <div
              onClick={() => onToggleExpand(frame.id)}
              style={{
                display: 'flex',
                padding: '3px 10px',
                borderBottom: '1px solid #2d2d2d',
                cursor: 'pointer',
                background: isExpanded ? '#2a2d2e' : 'transparent',
              }}
            >
              <span style={{ width: '90px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                {timeStr}
              </span>
              <span style={{ width: '30px', color: dirColor(frame.direction), fontSize: '11px', fontWeight: 600 }}>
                {frame.direction.toUpperCase()}
              </span>
              <span style={{ width: '60px', color: protoColor(frame.protocol), fontSize: '11px' }}>
                {frame.protocol}
              </span>
              <span style={{ flex: 1, color: 'var(--color-text)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {frame.raw_hex.substring(0, 30)}{frame.raw_hex.length > 30 ? ' ...' : ''}
                {frame.summary && (
                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    {frame.summary.substring(0, 40)}
                  </span>
                )}
              </span>
            </div>
            {isExpanded && <FrameDetail frame={frame} />}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src/components/history/FrameTable.tsx
git commit -m "feat(jackcom): 添加 FrameTable 帧数据表格组件"
```

---

### 任务 6：HistoryApp 完整实现

**文件：**
- 修改：`packages/jackcom/src/apps/HistoryApp.tsx`

- [ ] **步骤 1：替换 HistoryApp 骨架为完整实现**

修改 `packages/jackcom/src/apps/HistoryApp.tsx`，替换全部内容为：

```typescript
import { useEffect } from 'react'
import { useHistory } from '@/hooks/useHistory'
import { SessionList } from '@/components/history/SessionList'
import { FilterBar } from '@/components/history/FilterBar'
import { FrameTable } from '@/components/history/FrameTable'

export default function HistoryApp() {
  const { store, loadSessions, loadFrames, exportCsv } = useHistory()
  const {
    sessions, selectedSessionId, frames, totalFrames,
    page, pageSize, directionFilter, protocolFilter, expandedFrameId, loading,
  } = store

  // 挂载时加载会话列表
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // 选择会话 / 过滤 / 分页变化时加载帧数据
  useEffect(() => {
    if (selectedSessionId !== null) {
      loadFrames(selectedSessionId)
    }
  }, [selectedSessionId, directionFilter, protocolFilter, page, loadFrames])

  const handleExport = async () => {
    if (selectedSessionId === null) return
    await exportCsv(selectedSessionId)
  }

  const startIdx = page * pageSize + 1
  const endIdx = Math.min((page + 1) * pageSize, totalFrames)

  return (
    <div style={{
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
      display: 'flex',
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
    }}>
      {/* 左侧会话列表 */}
      <div style={{
        width: '200px',
        background: 'var(--color-sidebar-bg)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '6px 10px',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.5px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          SESSIONS
        </div>
        <SessionList
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={store.selectSession}
        />
      </div>

      {/* 右侧帧列表 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <FilterBar
          direction={directionFilter}
          protocol={protocolFilter}
          onDirectionChange={store.setDirectionFilter}
          onProtocolChange={store.setProtocolFilter}
        />
        <FrameTable
          frames={frames}
          expandedFrameId={expandedFrameId}
          onToggleExpand={store.toggleFrameExpand}
        />
        {/* 底部状态栏 */}
        <div style={{
          padding: '3px 10px',
          background: 'var(--color-sidebar-bg)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          gap: '12px',
          color: 'var(--color-text-secondary)',
          fontSize: '10px',
          alignItems: 'center',
        }}>
          <span>{totalFrames.toLocaleString()} frames</span>
          {totalFrames > 0 && <>
            <span>|</span>
            <span>Showing {startIdx}-{endIdx}</span>
          </>}
          {selectedSessionId !== null && <>
            <span>|</span>
            <button
              onClick={handleExport}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                fontSize: '10px',
                padding: 0,
              }}
            >
              Export CSV
            </button>
          </>}
          {loading && <span style={{ color: 'var(--color-accent)' }}>Loading...</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：验证编译**

运行：`cd packages/jackcom && pnpm build`
预期：编译通过

- [ ] **步骤 3：运行所有测试确认无回归**

运行：`cd packages/jackcom && pnpm test -- --run`
预期：全部 PASS

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src/apps/HistoryApp.tsx
git commit -m "feat(jackcom): HistoryApp 从骨架替换为完整双栏实现"
```

---

### 任务 7：i18n 翻译更新

**文件：**
- 修改：`packages/jackcom/src/i18n/locales/zh.json`
- 修改：`packages/jackcom/src/i18n/locales/en.json`

- [ ] **步骤 1：添加历史相关翻译**

在 `packages/jackcom/src/i18n/locales/zh.json` 末尾 `}` 前添加：

```json
  "history.title": "历史记录",
  "history.sessions": "会话列表",
  "history.noSessions": "暂无会话记录",
  "history.noFrames": "选择左侧会话以查看帧数据",
  "history.export": "导出 CSV",
  "history.loading": "加载中..."
```

在 `packages/jackcom/src/i18n/locales/en.json` 末尾 `}` 前添加：

```json
  "history.title": "History",
  "history.sessions": "SESSIONS",
  "history.noSessions": "No sessions",
  "history.noFrames": "Select a session to view frames",
  "history.export": "Export CSV",
  "history.loading": "Loading..."
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src/i18n/locales/zh.json packages/jackcom/src/i18n/locales/en.json
git commit -m "feat(jackcom): 添加 HistoryApp i18n 翻译"
```

---

## 自检

### 规格覆盖度

| 规格需求 | 对应任务 |
|----------|----------|
| history-store（会话列表、帧数据、分页、过滤） | 任务 1 |
| useHistory hook（Tauri command 封装） | 任务 2 |
| SessionList 组件 | 任务 3 |
| FilterBar 组件 | 任务 4 |
| FrameDetail 组件 | 任务 4 |
| FrameTable 组件（虚拟滚动 → CSS overflow） | 任务 5 |
| HistoryApp 双栏布局 | 任务 6 |
| 底部状态栏（frames / Showing / Export CSV） | 任务 6 |
| i18n 翻译 | 任务 7 |

### 占位符扫描

无 TODO/TBD。所有组件有完整实现。

### 类型一致性

- `SessionRow` 在 history-store.ts 中定义和导出，被 useHistory.ts 和 SessionList.tsx 引用
- `DisplayFrame` 从 tauri-events.ts 导入，被 FrameTable.tsx、FrameDetail.tsx 引用
- `useHistoryStore` 的 `selectSession` 重置 page 和 expandedFrameId，确保选中新会话时从第一页开始
