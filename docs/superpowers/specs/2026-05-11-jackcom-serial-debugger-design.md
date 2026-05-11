# JackCom 串口调试工具设计规格

日期: 2026-05-11
状态: 待实现

## 概述

JackCom 是一个基于 Tauri v2 的桌面串口调试工具，作为 monorepo 中 `packages/jackcom` 子项目独立开发。通过 toolbox 工具市场分发，完全离线运行。

技术栈: Tauri v2 + Astro 5 + React 19 + shadcn/ui + TailwindCSS + Rust (tokio-serial)

## 产品定位

- 独立的 Tauri v2 桌面应用，不依赖 server
- 通过 toolbox 工具市场分发（发布到软件服务器后出现在工具列表）
- 面向嵌入式开发者、测试工程师、通用开发者，通过分层设计按需使用
- Windows 平台优先
- 完全离线运行

## V1 功能范围

### 包含

- 串口枚举 + 连接/断开
- HEX/ASCII 数据收发
- 多串口同时连接（连接管理器）
- 协议自动检测 + 解析（Modbus RTU / AT 命令 / JSON / 原始）
- 实时数据终端（虚拟列表）
- 波形监控窗口（Canvas 双缓冲）
- 协议解码窗口（帧详情）
- 快速发送片段管理
- 命令面板（Ctrl+Shift+P）
- 数据导出（CSV / JSON / HEX）
- 会话保存/恢复
- 端口热插拔监听
- VS Code Dark+ 主题

### 不包含（V2+）

- 自动化脚本引擎
- 插件系统
- 定时/循环发送
- 表达式计算器
- CRC 校验工具
- 明暗主题切换
- 历史回放窗口

## UI 设计

### 布局结构

VS Code 风格的多窗口架构：

**主窗口**（唯一，不可关闭）：
- 标题栏
- 菜单栏（File / Connection / View / Tools / Window / Help）
- 工具栏（快捷操作 + 连接状态 + 一键打开子窗口）
- 活动栏（左侧图标列）
- 侧边栏（连接管理器 + 快速发送片段）
- 中央编辑器 Tab（Terminal / Table / Modbus / AT Command）
- 底部面板（Send + Problems + Output）
- 状态栏（蓝色底，连接状态 + 统计信息）

**独立子窗口**（Tauri WebviewWindow）：
- 波形监控窗口 — 每个连接可弹出一个，实时折线图
- 协议解码窗口 — 每个连接可弹出一个，帧详情结构化展示
- 历史窗口 — 全局一个，搜索/回放历史会话

### 多窗口交互规则

- 弹出方式：View 菜单 / 工具栏按钮 / 活动栏图标
- 数据共享：子窗口通过 Tauri Event 订阅主窗口数据流，Rust Broker 中转
- 窗口管理：Window 菜单列出所有窗口，支持层叠/平铺
- 布局记忆：关闭时保存窗口位置和大小，启动时恢复
- Tauri 实现：WebviewWindow 独立 Webview，Window Label 唯一标识（如 "waveform-COM3"）

### 色板（VS Code Dark+）

| 用途 | 色值 | 说明 |
|---|---|---|
| 主强调色 | `#007ACC` | 按钮、活动 Tab、状态栏 |
| RX 数据 / 在线 | `#4EC9B0` | 接收数据、连接状态 |
| TX 数据 / 关键字 | `#569CD6` | 发送数据、HEX 标记 |
| 时间戳 / 注释 | `#6A9955` | 时间戳、元信息 |
| 字符串值 / Modbus 数据 | `#CE9178` | 数据高亮 |
| AT 命令 / 控制指令 | `#C586C0` | 控制类指令 |
| 编辑器背景 | `#1E1E1E` | 数据区 |
| 侧边栏 / Tab 栏 | `#252526` | 面板背景 |
| 菜单栏 | `#2D2D2D` | 菜单背景 |
| 标题栏 / 状态栏 | `#323233` | 标题栏 |
| 边框 | `#3C3C3C` | 分割线、边框 |
| 文字主色 | `#D4D4D4` | 正文 |
| 文字辅助 | `#858585` | 次要文字 |

### 菜单栏功能分布

**File**: 新建会话 / 打开会话 / 保存会话 / 导出数据 / 最近打开 / 退出

**Connection**: 快速连接 / 连接管理 / 断开 / 全部断开 / 端口配置 / 热插拔通知

**View**: 数据终端 / 表格视图 / 波形监控窗口 / 协议解析窗口 / 连接面板 / 状态栏

**Tools**: 快速发送管理 / HEX 转换器 / 数据计算器 / CRC 校验工具

**Window**: 层叠 / 平铺 / 全部关闭 / 独立子窗口列表 / 记住窗口布局

**Help**: 使用手册 / 快捷键 / 协议参考 / 关于 JackCom

## Rust 后端架构

### 模块结构

```
src-tauri/src/
├── main.rs                     # Tauri 入口 + AppState 注册
├── lib.rs                      # Tauri setup + 插件注册
├── state.rs                    # AppState 全局状态
├── error.rs                    # 统一错误类型（thiserror）
│
├── channel/                    # 解耦层：串口 I/O ↔ 前端推送
│   ├── mod.rs                  # channel 类型定义
│   ├── broker.rs               # 消息代理（发布/订阅，多消费者）
│   └── backpressure.rs         # 背压策略（降采样/丢帧/只存不推）
│
├── serial/                     # 串口核心
│   ├── mod.rs
│   ├── manager.rs              # 多端口任务管理 + 生命周期协调
│   ├── port.rs                 # 单端口读写封装（owned task）
│   ├── watcher.rs              # 端口热插拔监听（Windows: WM_DEVICECHANGE）
│   └── config.rs               # SerialConfig 类型定义
│
├── protocol/                   # 协议处理（Detector ⧧ Parser 分离）
│   ├── mod.rs                  # ProtocolDetector / ProtocolParser trait 定义
│   │                           # + ProtocolType / ParsedData / ParseError 类型
│   │                           # + Detection enum
│   ├── detector.rs             # AutoDetector 编排器
│   │                           # 职责：管理多个 ProtocolDetector 实例
│   │                           # 逐字节喂入，维护检测状态机
│   │                           # 一旦检测到协议，锁定并委托给对应 Parser
│   │                           # 支持 reset() 和手动指定协议
│   ├── frame.rs                # Frame 三层模型定义
│   │                           # RawFrame: 原始字节 + 时间戳 + 方向
│   │                           # ParsedFrame: RawFrame + 协议 + 解析结果
│   │                           # DisplayFrame: 前端展示最小子集（Serde 序列化）
│   │                           # Direction / ProtocolType enum
│   └── parsers/                # 各协议的具体实现
│       ├── mod.rs              # Parser 注册表：HashMap<ProtocolType, Box<dyn ProtocolParser>>
│       │                       # all_parsers() 工厂函数
│       ├── raw.rs              # 原始数据解析器：HEX 格式化 + ASCII 解码
│       │                       # RawDetector + RawParser
│       ├── modbus.rs           # Modbus RTU：帧检测(CRC校验) + 寄存器解析
│       │                       # ModbusDetector + ModbusParser
│       │                       # ModbusFunction / ModbusFrame 类型
│       ├── at_cmd.rs           # AT 命令：命令/响应识别 + 参数解析
│       │                       # ATDetector + ATParser
│       │                       # ATCommand / ATResponse 类型
│       └── json_frame.rs       # JSON 帧：花括号匹配 + 格式化
│                               # JSONDetector + JSONParser
│
├── storage/                    # 异步数据持久化
│   ├── mod.rs                  # 数据库操作（sqlx + SQLite）
│   └── migrations/
│       └── 001_init.sql
│
└── commands/                   # IPC API 层
    ├── mod.rs
    ├── serial.rs               # 枚举/打开/关闭/发送
    ├── data.rs                 # 历史查询/导出
    └── config.rs               # 用户偏好
```

### 核心数据流

```
tokio-serial(read) → Port Task(per port)
  → Detector(逐字节检测,带状态) → Parser(已知协议后完整解析)
  → Broker(发布/订阅)
    ├→ Storage(sqlx SQLite) — 全量写入，无限制
    └→ Tauri Event(emit) — 有界通道，50ms 批量发送
       → React 前端(listen)
```

### 关键类型

#### Frame 模型分层

```rust
/// 原始帧：串口读到的最小单位
struct RawFrame {
    port_id: String,
    timestamp: DateTime<Utc>,
    data: Bytes,           // bytes crate，零拷贝克隆
    direction: Direction,  // Tx / Rx
}

/// 解析帧：经 Parser 处理后的结构化数据
struct ParsedFrame {
    raw: RawFrame,
    protocol: ProtocolType,  // Raw / Modbus / AT / JSON
    parsed: ParsedData,      // enum，按协议类型分发
    formatted: String,       // 人类可读格式化结果
}

/// 前端展示帧：发给 React 的最小子集
struct DisplayFrame {
    id: i64,
    timestamp: DateTime<Utc>,
    direction: Direction,
    raw_hex: String,
    formatted: String,
    protocol: ProtocolType,
    summary: String,
}
```

#### Channel 模块

```rust
/// 端口事件：从 Port Task 发出的所有消息
/// 所有变体都携带 port_id，确保前端能按端口过滤
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
enum PortEvent {
    Data { port_id: String, frames: Vec<RawFrame> },
    Opened { port_id: String, config: SerialConfig },
    Closed { port_id: String, reason: CloseReason },
    Error { port_id: String, error: String },
    Change { arrived: Vec<String>, removed: Vec<String> },
    Stats { port_id: String, rx: u64, tx: u64, fps: u32 },
}

/// Broker：多消费者发布/订阅
struct Broker {
    sender: mpsc::Sender<PortEvent>,
    subscribers: Vec<mpsc::Sender<PortEvent>>,
    storage_tx: mpsc::Sender<RawFrame>,
}
```

#### Detector / Parser 分离

```rust
/// 检测器：只负责判断"这是什么协议"
trait ProtocolDetector: Send {
    fn feed(&mut self, byte: u8) -> Detection;
    fn reset(&mut self);
    fn protocol_name(&self) -> ProtocolType;
}

enum Detection {
    NeedMore,
    Matched(ProtocolType, usize),  // 协议类型 + 消费字节数
    Rejected,
}

/// 解析器：已知协议后，完整解析帧内容
trait ProtocolParser: Send {
    fn protocol(&self) -> ProtocolType;
    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError>;
    fn format(&self, parsed: &ParsedData) -> String;
}
```

#### CancellationToken + Manager

```rust
struct SerialManager {
    ports: DashMap<String, PortHandle>,
    broker: Broker,
    watcher: PortWatcher,
    cancel_tokens: DashMap<String, CancellationToken>,
    db: SqlitePool,
}

struct PortHandle {
    task: JoinHandle<()>,
    cancel: CancellationToken,
    config: SerialConfig,
}
```

#### 端口热插拔监听

```rust
struct PortWatcher {
    current_ports: HashSet<String>,
    change_tx: mpsc::Sender<PortChange>,
}

enum PortChange {
    Arrived(String),
    Removed(String),
}
```

#### Error 模块

```rust
#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("串口错误: {0}")]
    Serial(#[from] SerialError),
    #[error("协议解析错误: {0}")]
    Protocol(#[from] ParseError),
    #[error("数据库错误: {0}")]
    Database(#[from] sqlx::Error),
    #[error("端口不存在: {0}")]
    PortNotFound(String),
    #[error("端口已被占用: {0}")]
    PortInUse(String),
}
// impl Serialize for Tauri IPC 前端友好输出
```

### Cargo 核心依赖

见上方 Monorepo 集成章节中的完整 Cargo.toml。

## 前端架构

### 目录结构

```
packages/jackcom/
├── src-tauri/                  # Rust 后端
│
├── src/
│   ├── pages/                  # Astro 边界：纯壳，零逻辑
│   │   ├── main.astro              # <MainApp client:load />
│   │   ├── waveform.astro          # <WaveformApp client:load />
│   │   ├── decoder.astro           # <DecoderApp client:load />
│   │   └── history.astro           # <HistoryApp client:load />
│   │
│   ├── apps/                   # React 边界：每个窗口一个独立根组件
│   │   ├── MainApp.tsx             # 主窗口根
│   │   ├── WaveformApp.tsx         # 波形窗口根
│   │   ├── DecoderApp.tsx          # 解码窗口根
│   │   └── HistoryApp.tsx          # 历史窗口根
│   │
│   ├── components/
│   │   ├── layout/              # 菜单栏/工具栏/活动栏/侧边栏/状态栏/底部面板
│   │   ├── sidebar/             # ConnectionList/ConnectionCard/QuickSnippets
│   │   ├── terminal/            # TerminalView/TerminalLine/TableView/SendBar/SendOptions
│   │   ├── waveform/            # WaveformChart/WaveformLegend/WaveformToolbar
│   │   ├── decoder/             # FrameDetail/ModbusDetail/ATCmdDetail/JSONDetail
│   │   ├── palette/             # CommandPalette
│   │   ├── export/              # DataExport
│   │   └── common/              # BaudRateSelect/PortSelect/HexInput/Dialog
│   │
│   ├── hooks/
│   │   ├── useSerialPort.ts         # 串口连接生命周期
│   │   ├── useDataFeed.ts           # 订阅数据流（批处理）
│   │   ├── usePortWatcher.ts        # 热插拔监听
│   │   ├── useHistory.ts            # 历史查询
│   │   └── useConfig.ts             # 用户配置读写
│   │
│   ├── lib/
│   │   ├── tauri-events.ts          # Event 类型 + 类型安全 listen/emit 封装
│   │   ├── formatters.ts            # HEX/ASCII/时间戳格式化
│   │   └── store.ts                  # Zustand store
│   │
│   └── styles/
│       ├── globals.css              # 全局样式 + CSS 变量
│       └── vscode-theme.css         # VS Code 色板变量
│
├── components.json             # shadcn/ui 配置
├── astro.config.mjs
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

### Astro/React 边界规则

- `.astro` 文件只做一件事：`<Component client:load />`，不放任何逻辑
- React 组件通过 Zustand store + Tauri Event 通信，不用 Astro props
- 每个 `.astro` 页面是完全独立的 Webview，无共享 JS 上下文

### 多窗口独立状态管理

每个 WebviewWindow 有完全独立的 JS 上下文，不共享 Zustand store：

- **MainApp** → `useMainStore`: connections, activePortId, sidebarVisible, activePanel, openTabs
- **WaveformApp** → `useWaveformStore`: portId(从 URL query), channels, timeWindow, paused, scale
- **DecoderApp** → `useDecoderStore`: portId(从 URL query), protocol, pinnedFrame, autoScroll
- **HistoryApp** → `useHistoryStore`: sessions, filters, pagination

窗口间通信唯一通道：Tauri Event Bus（Rust Broker 中转）

### Tauri Event 类型

Rust 侧 PortEvent 通过 `#[serde(tag = "type")]` 序列化，前端 EventMap 必须与之对齐：

```typescript
// lib/tauri-events.ts
// 与 Rust PortEvent #[serde(tag="type")] 一一对应

interface PortDataPayload {
  port_id: string;
  frames: DisplayFrame[];
}

interface PortOpenedPayload {
  port_id: string;
  config: SerialConfig;
}

interface PortClosedPayload {
  port_id: string;
  reason: string;  // "disconnected" | "error" | "removed"
}

interface PortErrorPayload {
  port_id: string;
  error: string;
}

interface PortChangePayload {
  arrived: string[];
  removed: string[];
}

interface PortStatsPayload {
  port_id: string;
  rx: number;
  tx: number;
  fps: number;
}

// 事件名 → payload 映射
type EventMap = {
  'port:data':    PortDataPayload;
  'port:opened':  PortOpenedPayload;
  'port:closed':  PortClosedPayload;
  'port:error':   PortErrorPayload;
  'port:change':  PortChangePayload;
  'port:stats':   PortStatsPayload;
};

// 类型安全的 listen 封装
function on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void) {
  return listen<EventMap[K]>(event, (e) => handler(e.payload));
}
```

### 前端数据批处理

高频数据流下的三层防线：

1. **Rust Broker 背压**: 存储通道无限制全量写入 SQLite；前端通道有界，溢出时降采样
2. **Tauri Event 批量发送**: Rust 侧每 50ms 合并一批帧，emit("port:data", frames[])
3. **React 批处理渲染**: useDataFeed hook 每 100ms flush 一次 batch，只更新虚拟列表可见范围

### 虚拟列表实现

- `framesRef`（useRef）存储全量数据，不触发重渲染
- `batchRef` 累积 Tauri Event 推送的帧
- 每 100ms flush：写入 ref，只更新 `totalCount` 和可见切片
- 使用 `@tanstack/react-virtual` 渲染可见范围

### Canvas 双缓冲波形

- 离屏 `OffscreenCanvas` 绘制网格和曲线
- 数据存 `dataRef`，draw 循环用 `requestAnimationFrame` 自动读取最新数据
- 完成后 `drawImage` 一次性拷贝到主 Canvas
- 数据写入不触发 React 重渲染

### HexInput 性能优化

- 本地 state 跟踪用户输入，允许不完整输入
- 只在 blur 或 Enter 时验证并提交
- 验证失败回退到上一次合法值
- 输入中不阻塞，非法字符通过边框颜色提示

### 命令面板

- Ctrl+Shift+P 唤起，VS Code 式模糊搜索
- 使用 cmdk（shadcn Command 组件）
- 命令分类：Connection / View / Tools / Send / Data
- 命令包括快速连接、打开子窗口、清屏、导出、切换侧栏等

### 数据导出

- 支持格式：CSV / JSON / HEX 文本
- Rust 侧 query_frames 查询，前端格式化
- Tauri 文件对话框选择保存路径
- 可选导出范围：时间范围、方向（RX/TX/全部）、是否包含解析结果

### 前端依赖

```json
{
  "name": "@upgrade-component/jackcom",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "tauri": "tauri",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-log": "^2",
    "react": "^19",
    "react-dom": "^19",
    "zustand": "^5",
    "@tanstack/react-virtual": "^3",
    "cmdk": "^1",
    "lucide-react": "^0.460",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "tailwind-merge": "^2"
  },
  "devDependencies": {
    "@astrojs/react": "^4",
    "@tailwindcss/vite": "^4",
    "@tauri-apps/cli": "^2",
    "@testing-library/react": "^16",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "astro": "^5",
    "jsdom": "^26",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

### Astro 配置（参考 toolbox 模式）

```javascript
// astro.config.mjs
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
  output: 'static',
})
```

```json
// tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

## Monorepo 集成

### 包名

`@upgrade-component/jackcom`

### 根 package.json 新增脚本

```jsonc
{
  "dev:jackcom": "pnpm --filter @upgrade-component/jackcom dev",
  "build:jackcom": "pnpm --filter @upgrade-component/jackcom build",
  "test:jackcom": "pnpm --filter @upgrade-component/jackcom test",
  "test:jackcom:rust": "cd packages/jackcom/src-tauri && cargo test"
}
```

### Tauri v2 配置

#### tauri.conf.json

```jsonc
{
  "productName": "JackCom",
  "version": "1.0.0",
  "identifier": "com.jackcom.serial-debugger",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:4321",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "url": "/main",
        "title": "JackCom — Serial Debugger",
        "width": 1280,
        "height": 800,
        "center": true,
        "decorations": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico"
    ],
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    }
  },
  "plugins": {
    "log": {
      "level": "info"
    }
  }
}
```

#### capabilities/default.json

```jsonc
{
  "identifier": "default",
  "description": "Capability for all JackCom windows",
  "windows": ["main", "waveform-*", "decoder-*", "history"],
  "permissions": [
    "core:default",
    "core:window:allow-create",
    "core:window:allow-close",
    "core:window:allow-set-focus",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:event:default",
    "dialog:allow-save",
    "dialog:allow-open",
    "log:default"
  ]
}
```

#### Cargo.toml（参考 toolbox 的 crate-type 和 build-dependencies）

```toml
[package]
name = "upgrade-component-jackcom"
version = "1.0.0"
edition = "2021"

[lib]
name = "upgrade_component_jackcom_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-log = "2"
tokio = { version = "1", features = ["full"] }
tokio-serial = "5"
serialport = "4"
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio"] }
bytes = "1"
dashmap = "6"
thiserror = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4"] }
log = "0.4"
dirs = "5"

[dev-dependencies]
tokio = { version = "1", features = ["test-util", "macros"] }
```

## TDD 策略

### Rust 侧测试（cargo test）

| 优先级 | 模块 | 测试方式 |
|---|---|---|
| P0 | protocol/detector | 喂字节序列，断言 Detection 枚举 |
| P0 | protocol/parsers/* | 喂完整帧字节，断言 ParsedData |
| P1 | channel/broker | 发布 PortEvent，验证订阅者收到 |
| P1 | channel/backpressure | 模拟高频消息，验证降采样 |
| P1 | storage/ | SQLite :memory: 测试 CRUD + 分页 |
| P2 | serial/manager | mock SerialStream，测生命周期 |
| P2 | serial/watcher | mock 端口列表变化，验证事件 |
| P3 | commands/* | mock AppState，验证 IPC 响应 |

### React 侧测试（vitest）

| 优先级 | 目标 | 测试方式 |
|---|---|---|
| P0 | HexInput | 输入非法字符 → blur → 验证回退 |
| P0 | formatters | 字节数组 → 断言格式化输出 |
| P1 | useDataFeed | mock Event emit → 验证批处理 |
| P1 | CommandPalette | 模糊搜索 → 验证过滤 |
| P2 | 各 store | 操作 → 断言状态变更 |

### TDD 循环

Red（写失败测试）→ Green（最小实现让测试通过）→ Refactor → 下一模块

模块顺序: Detector → Parser → Broker → Backpressure → Storage → Manager → Watcher → Commands
