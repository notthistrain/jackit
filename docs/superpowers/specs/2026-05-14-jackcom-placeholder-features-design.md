# JackCom 占位符功能实现设计

**日期：** 2026-05-14
**目标：** 实现 05-11/05-13 批次计划中 4 项未完成的占位符功能 + Mock MCU 测试工具 + ConnectionDialog

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
| New Connection / Connect | 打开 ConnectionDialog（见第 6 节） |
| Disconnect | 调用 `close_port(activePortId)` |
| Port Settings | 打开 ConnectionDialog（预填当前配置） |
| Close Connection | 调用 `close_port(activePortId)` |
| Close All | 调用 `close_all()` |
| Export Data | 调用 `export_data` Tauri command，参数为当前 sessionId |
| Quick Send | 调用 `setSidebarTab('snippets')` + `toggleSidebar()` 打开 Quick Send 面板 |
| About / Documentation | 用默认浏览器打开 GitHub 仓库 README（`@tauri-apps/plugin-shell` 的 `openUrl`） |

### 移除项

- Check Updates — 从菜单中移除，不实现

---

## 5. Mock MCU — 端到端测试工具

### 定位

独立 Rust crate，不并入生产构建。用于在没有真实 MCU 硬件时，通过虚拟串口对模拟 MCU 发送串口数据，完成 JackCom 前后端端到端测试。

### 前置依赖

用户需安装虚拟串口驱动（Windows 上推荐 com0com 或 VSPD），创建端口对，例如 COM20 ↔ COM21。

### 新建文件

独立 crate：`packages/jackcom-mock-mcu/`

```
packages/jackcom-mock-mcu/
├── Cargo.toml
└── src/
    ├── main.rs          # CLI 入口 + 串口连接 + 发送循环
    ├── scenarios.rs      # 场景定义（Modbus/AT/JSON/Raw）
    └── protocols.rs      # 帧构造器（复用 jackcom 的 CRC-16 等，或独立实现）
```

### CLI 接口

```bash
# 混合场景（默认），100ms 间隔
jackcom-mock-mcu --port COM20 --interval 100

# 指定场景
jackcom-mock-mcu --port COM20 --scenario modbus
jackcom-mock-mcu --port COM20 --scenario at-esp32
jackcom-mock-mcu --port COM20 --scenario json-sensor
jackcom-mock-mcu --port COM20 --scenario raw

# 列出可用端口
jackcom-mock-mcu --list-ports
```

### 场景定义

| 场景 | 模拟内容 | 数据模式 |
|------|----------|----------|
| `modbus` | Modbus RTU 从站 | 周期性发读保持寄存器响应（10 个寄存器，数值递增） |
| `at-esp32` | ESP32 AT 固件 | 响应式：收到 `AT` → 回 `OK`，收到 `AT+RST` → 回 `OK` + `ready` |
| `json-sensor` | 传感器数据 | 每 500ms 发 `{"temp":25.6,"hum":60.1,"press":1013}` |
| `raw` | 随机二进制 | 随机长度随机字节 |
| `mixed`（默认）| 混合以上所有 | 按比例轮流发送（Modbus 40% / AT 20% / JSON 20% / Raw 20%） |

### protocols.rs 帧构造器

独立实现（不依赖 jackcom crate），避免生产代码和测试工具耦合：

- `fn build_modbus_response(slave: u8, values: &[u16]) -> Vec<u8>` — 含 CRC-16
- `fn build_at_response(command: &str) -> Vec<u8>` — 含 `\r\n`
- `fn build_json_payload(temp: f64, hum: f64) -> Vec<u8>`
- `fn build_raw_random(len: usize) -> Vec<u8>`
- `fn crc16_modbus(data: &[u8]) -> u16` — CRC-16/Modbus 独立实现

### main.rs 流程

1. 解析 CLI 参数（clap）
2. 打开指定串口（serialport crate），配置 115200 8N1
3. 选择场景 → 进入发送循环
4. AT 场景为响应式：先读串口收到命令，再回复；其他场景为主动发送
5. Ctrl+C 优雅退出

### 依赖

```toml
[dependencies]
serialport = "4"
clap = { version = "4", features = ["derive"] }
serde_json = "1"
rand = "0.8"
```

### 与 JackCom 的使用流程

1. 安装 com0com，创建虚拟端口对 COM20 ↔ COM21
2. 启动 mock-mcu：`cargo run --port COM20`
3. 启动 JackCom，连接 COM21
4. 观察终端/波形/解码窗口是否正确显示数据

### workspace 集成

在根 `Cargo.toml` 的 `[workspace]` 中注册：
```toml
members = [
    # ... 已有成员
    "packages/jackcom-mock-mcu",
]
```

在根 `package.json` 添加脚本：
```json
"mock:mcu": "cd packages/jackcom-mock-mcu && cargo run"
```

---

## 6. ConnectionDialog — 串口连接对话框

### 定位

模态对话框，用于选择串口、配置参数、建立/断开连接。菜单 Connect / Toolbar 连接按钮共用此组件。

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/components/connection/ConnectionDialog.tsx` | 模态对话框主组件 |
| `src/components/connection/PortSelector.tsx` | 端口选择下拉框（实时刷新） |
| `src/components/connection/SerialConfigForm.tsx` | 串口参数配置表单 |
| `src/hooks/useSerialConfig.ts` | 串口配置状态管理 + 保存/加载最近配置 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/lib/store.ts` | 添加 `connectionDialogOpen` 状态和 `toggleConnectionDialog` action |
| `src/components/layout/TitleBar.tsx` | Connect/Port Settings 菜单 onClick 打开对话框 |
| `src/components/layout/Toolbar.tsx` | 连接按钮 onClick 打开对话框 |
| `src/components/layout/AppLayout.tsx` | 渲染 ConnectionDialog |

### 对话框布局

双栏结构：左侧 Recent 列表 + 右侧配置表单。点击左侧历史连接自动填充右侧表单。

```
┌──────────────────────────────────────────┐
│  Connect to Serial Port              [×]  │
├────────────┬─────────────────────────────┤
│  RECENT    │  Port        [COM3     ▾][↻]│
│            │  Baud Rate   [115200   ▾]    │
│  COM3      │  Advanced                    │
│  115200 8N1│  [8bit][1stop][none][none]   │
│            │                              │
│  COM5      │                              │
│  9600 8E1  │                              │
│            │              [Cancel][Connect]│
│  COM3      │                              │
│  57600 8N1 │                              │
└────────────┴─────────────────────────────┘
```

点击左侧 Recent 项 → 自动填充右侧表单 → 用户点 Connect。

### 数据流

1. 用户点击 Connect → `toggleConnectionDialog(true)` → 对话框打开
2. PortSelector 挂载 → 调用 `enumerate_ports` Tauri command → 填充下拉框
3. 刷新按钮 → 重新调用 `enumerate_ports`
4. 表单默认值：最近一次成功连接的配置（localStorage `jackcom:last-serial-config`）
5. Recent 列表：最近 5 次成功连接配置（localStorage `jackcom:recent-connections`）
6. 点击 Connect → 调用 `open_port` Tauri command → 成功后关闭对话框 → store 更新 `activePortId` + `connections`
7. 连接失败 → 显示错误提示，对话框保持打开

### SerialConfigForm 表单项

| 字段 | 类型 | 选项 |
|------|------|------|
| Port | 下拉 | `enumerate_ports()` 返回的端口列表 |
| Baud Rate | 下拉 | 1200/2400/4800/9600/19200/38400/57600/115200/230400/460800/921600 |
| Data Bits | 下拉 | 5/6/7/8（默认 8） |
| Stop Bits | 下拉 | 1/2（默认 1） |
| Parity | 下拉 | None/Odd/Even（默认 None） |
| Flow Control | 下拉 | None/Hardware/Software（默认 None） |

### useSerialConfig hook

```typescript
interface SerialConfig {
  portName: string
  baudRate: number
  dataBits: number
  stopBits: number
  parity: string
  flowControl: string
}

function useSerialConfig(): {
  config: SerialConfig
  setConfig: (config: Partial<SerialConfig>) => void
  recentConfigs: SerialConfig[]
  saveAsRecent: () => void
}
```

从 localStorage 读写，key 为 `jackcom:serial-config` 和 `jackcom:recent-connections`。

### 快捷连接（Recent 列表）

- 显示最近 5 次成功连接
- 每项一行：端口名 @ 波特率 数据位校验位停止位
- 点击直接用该配置连接，无需确认
- 连接成功后保存到 recent 列表

### 与 Toolbar 连接按钮的关系

- 未连接时：按钮显示 "Connect"，点击打开 ConnectionDialog
- 已连接时：按钮显示 "Disconnect"，点击直接断开（不打开对话框）
- Toolbar 上的端口信息从 store `connections[activePortId]` 读取

---

## 规格自检

### 占位符扫描

无 TODO/TBD。所有功能有明确实现方案。

### 内部一致性

- HistoryApp 使用 `list_recent_sessions` / `query_history` API，与 Rust commands/data.rs 定义的接口一致
- WaveformApp 从 `useWaveformStore.channels` 取数据，与已有 store 一致
- 清屏 action 影响范围限于 useDataFeed + AppLayout，不涉及 Rust 后端
- Mock MCU 的 CRC-16 和帧格式与 jackcom protocol parsers 兼容（相同算法，独立实现）

### 范围检查

6 个功能独立。Mock MCU 为独立 crate 不影响生产代码。ConnectionDialog 补齐了 Connect/Disconnect 菜单项的缺失。

### 模糊性检查

- Export Data 触发时机：菜单项点击时，导出当前选中 session 的全部帧
- WebGPU 不可用：只显示提示文字，不做 Canvas 2D 降级
- 帧展开详情：在表格行内展开，不是新窗口
- Mock MCU 的 AT 场景是响应式（需双向通信），其他场景是单向主动发送
- Mock MCU 不依赖 jackcom crate，所有协议构造逻辑独立实现
- About / Documentation 合为一项：打开 GitHub README，不再有 Check Updates
- ConnectionDialog 是模态弹窗，不是独立窗口
- Recent 连接列表存 localStorage，最多 5 条
- Disconnect 操作直接断开，不打开对话框
