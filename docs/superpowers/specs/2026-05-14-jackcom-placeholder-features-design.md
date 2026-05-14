# JackCom 占位符功能实现设计

**日期：** 2026-05-14
**目标：** 实现 05-11/05-13 批次计划中 4 项未完成的占位符功能

---

## 1. HistoryApp — 历史会话浏览

### 布局

双栏结构：左侧会话列表 + 右侧帧数据表格。VS Code Dark+ 主题风格。

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/stores/history-store.ts` | 历史窗口 Zustand store（会话列表、帧查询状态、分页、过滤条件） |
| `src/hooks/useHistory.ts` | 封装 Tauri command 调用（list_recent_sessions、query_history、export_data） |
| `src/components/history/SessionList.tsx` | 左栏会话列表组件 |
| `src/components/history/FrameTable.tsx` | 右栏帧数据表格（虚拟滚动） |
| `src/components/history/FrameDetail.tsx` | 帧展开详情面板（完整 HEX + 解析结果） |
| `src/components/history/FilterBar.tsx` | 过滤栏（方向 + 协议） |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/apps/HistoryApp.tsx` | 从骨架替换为完整实现 |

### 数据流

1. HistoryApp 挂载 → `useHistory` 调用 `list_recent_sessions` 加载会话列表
2. 用户点击会话 → `useHistory` 调用 `query_history(sessionId, filters, page)` 加载帧数据
3. 帧数据存入 `history-store`，FrameTable 通过虚拟滚动渲染
4. 过滤栏变更 → 更新 store 过滤条件 → 重新查询
5. 分页 → 更新 store offset → 重新查询

### history-store 状态

```typescript
interface HistoryStore {
  sessions: SessionRow[]
  selectedSessionId: number | null
  frames: FrameRow[]
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
  setFrames: (frames: FrameRow[], total: number) => void
  setPage: (page: number) => void
  setDirectionFilter: (dir: 'all' | 'rx' | 'tx') => void
  setProtocolFilter: (proto: string | null) => void
  toggleFrameExpand: (id: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}
```

### SessionList 组件

- 列表项：端口名 + 波特率 + 时间 + 帧数
- 选中项高亮（`var(--color-accent)` 背景）
- 空状态文案

### FrameTable 组件

- 表头固定：Time | Dir | Protocol | Data（摘要）
- 方向列：RX 绿色（`var(--color-rx)`），TX 蓝色（`var(--color-tx)`）
- 协议列：不同协议不同颜色
- 使用 CSS overflow-y auto 实现滚动（帧数据量由分页控制，无需虚拟滚动）
- 点击行展开 FrameDetail

### FilterBar 组件

- 方向过滤：All / RX / TX（pill 按钮组）
- 协议过滤：Raw / Modbus / AT / JSON（pill 按钮组）
- 选中项高亮

### 底部状态栏

- 显示 "X frames | Showing Y-Z | Export CSV" 链接

---

## 2. WaveformApp — WebGPU 波形渲染

### 架构

使用 WebGPU API + WGSL compute/vertex/fragment shader 实现实时折线图渲染。不支持降级，WebGPU 不可用时显示提示。

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/components/waveform/WaveformRenderer.ts` | WebGPU 渲染器类（device/pipeline/buffer 管理） |
| `src/components/waveform/WaveformCanvas.tsx` | React 组件（Canvas 元素 + 渲染器生命周期管理） |
| `src/components/waveform/shaders.wgsl.ts` | WGSL shader 源码（线段绘制 + 网格背景） |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/apps/WaveformApp.tsx` | 替换 "coming soon" 占位符为 WaveformCanvas |

### WaveformRenderer 类

```typescript
class WaveformRenderer {
  // 初始化 WebGPU
  async init(canvas: HTMLCanvasElement): Promise<boolean>
  // 更新通道数据（从 store channels 映射）
  updateData(channels: Record<string, number[]>): void
  // 渲染帧
  render(): void
  // 缩放（鼠标滚轮）
  setZoom(level: number): void
  // 平移（鼠标拖拽）
  setOffset(x: number): void
  // 清理资源
  destroy(): void
}
```

### 渲染流程

1. 初始化：获取 GPU adapter → device → 配置 canvas context
2. 每帧：将通道数据写入 GPU buffer → vertex shader 映射坐标 → fragment shader 绘制
3. 背景：绘制网格线（X 轴时间刻度、Y 轴数值刻度）
4. 前景：每个通道一条折线，不同颜色区分

### Shader 设计

- Vertex shader：接收点数据（index, value），映射到 clip space
- Fragment shader：输出通道颜色（从 uniform buffer 读取）
- 网格背景：单独的 draw call，用细线绘制

### WebGPU 不可用处理

检测 `navigator.gpu` 是否存在：
- 不存在 → 显示 "WebGPU not available in this environment" 提示
- 存在但 `requestAdapter()` 返回 null → 同样显示不支持提示

### 交互

- 鼠标滚轮：缩放时间窗口
- 鼠标拖拽：平移时间轴
- 暂停按钮：已有（store togglePause）

---

## 3. Ctrl+L 清屏

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/lib/store.ts` | 添加 `clearFrames` action（清空帧数组计数器） |
| `src/hooks/useDataFeed.ts` | 帧数组响应 clearFrames 重置 |
| `src/components/layout/AppLayout.tsx` | Ctrl+L handler 接通 clearFrames |
| `src/components/layout/TitleBar.tsx` | "Clear Terminal" 菜单 onClick 接通 clearFrames |

### 实现方式

在 `useDataFeed` hook 内部维护一个 `frameIdCounter` ref。`clearFrames` 重置此计数器，导致帧列表被清空。store 中不需要存储帧数据（帧数据在 useDataFeed 的 ref 中），只需要一个 `clearSequence` 数字，每次清屏递增，useDataFeed 监听变化后清空 ref。

---

## 4. 菜单项 onClick 接通

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/components/layout/TitleBar.tsx` | 菜单项 onClick 接通实际动作 |

### 接通项

| 菜单项 | 实现 |
|--------|------|
| Export Data | 调用 `export_data` Tauri command，参数为当前 sessionId |
| Quick Send | 调用 `setSidebarTab('snippets')` + `toggleSidebar()` 打开 Quick Send 面板 |
| About | `window.alert('JackCom v1.0.0 — Serial Debugger')` |
| Documentation | `window.open('https://github.com/...', '_blank')` |
| Check Updates | 同 Documentation 暂时，后续可接自动更新 |

### 不实现项（保持 disabled 或 onClick 为空）

- Connect / Disconnect / Port Settings — 需要连接对话框，留到下个迭代
- New Connection / Close Connection / Close All — 同上

---

## 规格自检

### 占位符扫描

无 TODO/TBD。所有功能有明确实现方案。

### 内部一致性

- HistoryApp 使用 `list_recent_sessions` / `query_history` API，与 Rust commands/data.rs 定义的接口一致
- WaveformApp 从 `useWaveformStore.channels` 取数据，与已有 store 一致
- 清屏 action 影响范围限于 useDataFeed + AppLayout，不涉及 Rust 后端

### 范围检查

4 个功能独立，可以拆分为 4 个实现计划。Connection Dialog 明确排除。

### 模糊性检查

- Export Data 触发时机：菜单项点击时，导出当前选中 session 的全部帧
- WebGPU 不可用：只显示提示文字，不做 Canvas 2D 降级
- 帧展开详情：在表格行内展开，不是新窗口
