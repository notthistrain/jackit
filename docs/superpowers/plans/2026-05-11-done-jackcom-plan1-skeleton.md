# Plan 1: JackCom 项目骨架 + 基础类型

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 搭建 packages/jackcom 完整项目骨架，Rust 侧可编译，前端 Astro+React 可运行，基础类型定义到位

**架构：** 参考 toolbox 的 monorepo 集成模式，创建 Tauri v2 + Astro 5 + React 19 项目骨架。Rust 侧定义 error/types 模块（纯类型，无逻辑），前端搭建 Astro 页面壳 + React 根组件。

**技术栈：** Tauri v2、Astro 5 + React 19、TailwindCSS v4、pnpm workspaces

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 创建 | `packages/jackcom/package.json` | 前端依赖 + 脚本 |
| 创建 | `packages/jackcom/astro.config.mjs` | Astro + React + TailwindCSS 配置 |
| 创建 | `packages/jackcom/tsconfig.json` | TypeScript 配置 |
| 创建 | `packages/jackcom/vitest.config.ts` | Vitest 测试配置 |
| 创建 | `packages/jackcom/src/env.d.ts` | Tauri 类型声明 |
| 创建 | `packages/jackcom/src/styles/globals.css` | TailwindCSS 入口 |
| 创建 | `packages/jackcom/src/pages/main.astro` | 主窗口页面壳 |
| 创建 | `packages/jackcom/src/pages/waveform.astro` | 波形窗口页面壳 |
| 创建 | `packages/jackcom/src/pages/decoder.astro` | 解码窗口页面壳 |
| 创建 | `packages/jackcom/src/pages/history.astro` | 历史窗口页面壳 |
| 创建 | `packages/jackcom/src/apps/MainApp.tsx` | 主窗口 React 根 |
| 创建 | `packages/jackcom/src/apps/WaveformApp.tsx` | 波形窗口 React 根 |
| 创建 | `packages/jackcom/src/apps/DecoderApp.tsx` | 解码窗口 React 根 |
| 创建 | `packages/jackcom/src/apps/HistoryApp.tsx` | 历史窗口 React 根 |
| 创建 | `packages/jackcom/src-tauri/Cargo.toml` | Rust 依赖 |
| 创建 | `packages/jackcom/src-tauri/build.rs` | Tauri 构建脚本 |
| 创建 | `packages/jackcom/src-tauri/tauri.conf.json` | Tauri 应用配置 |
| 创建 | `packages/jackcom/src-tauri/capabilities/default.json` | Tauri 权限 |
| 创建 | `packages/jackcom/src-tauri/src/main.rs` | Rust 入口 |
| 创建 | `packages/jackcom/src-tauri/src/lib.rs` | Tauri setup + command 注册 |
| 创建 | `packages/jackcom/src-tauri/src/error.rs` | 统一错误类型 |
| 创建 | `packages/jackcom/src-tauri/src/state.rs` | AppState 定义 |
| 创建 | `packages/jackcom/src-tauri/src/protocol/mod.rs` | trait + 枚举类型定义 |
| 创建 | `packages/jackcom/src-tauri/src/protocol/frame.rs` | Frame 三层模型 |
| 创建 | `packages/jackcom/src-tauri/src/serial/config.rs` | SerialConfig 类型 |
| 修改 | `package.json` | 根脚本追加 jackcom |

---

### 任务 1：创建前端项目骨架

**文件：**
- 创建：`packages/jackcom/package.json`
- 创建：`packages/jackcom/astro.config.mjs`
- 创建：`packages/jackcom/tsconfig.json`
- 创建：`packages/jackcom/vitest.config.ts`
- 创建：`packages/jackcom/src/env.d.ts`
- 创建：`packages/jackcom/src/styles/globals.css`

- [ ] **步骤 1：创建 package.json**

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

- [ ] **步骤 2：创建 astro.config.mjs**

```javascript
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

- [ ] **步骤 3：创建 tsconfig.json**

```json
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

- [ ] **步骤 4：创建 vitest.config.ts**

```typescript
import { getViteConfig } from 'astro/config'

export default getViteConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **步骤 5：创建 src/env.d.ts**

```typescript
/// <reference types="astro/client" />
```

- [ ] **步骤 6：创建 src/styles/globals.css**

```css
@import "tailwindcss";
```

- [ ] **步骤 7：安装依赖**

```bash
cd packages/jackcom && pnpm install
```

预期：依赖安装成功，无报错。

- [ ] **步骤 8：Commit**

```bash
git add packages/jackcom/package.json packages/jackcom/astro.config.mjs packages/jackcom/tsconfig.json packages/jackcom/vitest.config.ts packages/jackcom/src/env.d.ts packages/jackcom/src/styles/globals.css
git commit -m "feat(jackcom): init frontend skeleton with Astro 5 + React 19"
```

---

### 任务 2：创建 Astro 页面壳 + React 根组件

**文件：**
- 创建：`packages/jackcom/src/pages/main.astro`
- 创建：`packages/jackcom/src/pages/waveform.astro`
- 创建：`packages/jackcom/src/pages/decoder.astro`
- 创建：`packages/jackcom/src/pages/history.astro`
- 创建：`packages/jackcom/src/apps/MainApp.tsx`
- 创建：`packages/jackcom/src/apps/WaveformApp.tsx`
- 创建：`packages/jackcom/src/apps/DecoderApp.tsx`
- 创建：`packages/jackcom/src/apps/HistoryApp.tsx`

- [ ] **步骤 1：创建主窗口页面壳 main.astro**

```astro
---
import '../styles/globals.css'
import MainApp from '../apps/MainApp'
---
<MainApp client:load />
```

- [ ] **步骤 2：创建波形窗口页面壳 waveform.astro**

```astro
---
import '../styles/globals.css'
import WaveformApp from '../apps/WaveformApp'
---
<WaveformApp client:load />
```

- [ ] **步骤 3：创建解码窗口页面壳 decoder.astro**

```astro
---
import '../styles/globals.css'
import DecoderApp from '../apps/DecoderApp'
---
<DecoderApp client:load />
```

- [ ] **步骤 4：创建历史窗口页面壳 history.astro**

```astro
---
import '../styles/globals.css'
import HistoryApp from '../apps/HistoryApp'
---
<HistoryApp client:load />
```

- [ ] **步骤 5：创建主窗口 React 根 MainApp.tsx**

```tsx
export default function MainApp() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ padding: '8px 16px', background: '#323233', color: '#007acc', fontWeight: 700 }}>
        JackCom — Serial Debugger
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#858585' }}>
        Main Window Skeleton
      </div>
    </div>
  )
}
```

- [ ] **步骤 6：创建波形窗口 React 根 WaveformApp.tsx**

```tsx
export default function WaveformApp() {
  return (
    <div style={{
      height: '100vh',
      background: '#1e1e1e',
      color: '#d4d4d4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      Waveform Window Skeleton
    </div>
  )
}
```

- [ ] **步骤 7：创建解码窗口 React 根 DecoderApp.tsx**

```tsx
export default function DecoderApp() {
  return (
    <div style={{
      height: '100vh',
      background: '#1e1e1e',
      color: '#d4d4d4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      Decoder Window Skeleton
    </div>
  )
}
```

- [ ] **步骤 8：创建历史窗口 React 根 HistoryApp.tsx**

```tsx
export default function HistoryApp() {
  return (
    <div style={{
      height: '100vh',
      background: '#1e1e1e',
      color: '#d4d4d4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      History Window Skeleton
    </div>
  )
}
```

- [ ] **步骤 9：验证 Astro 构建**

```bash
cd packages/jackcom && pnpm build
```

预期：`dist/` 目录生成，包含 main/index.html 等页面。

- [ ] **步骤 10：Commit**

```bash
git add packages/jackcom/src/
git commit -m "feat(jackcom): add Astro page shells and React root components"
```

---

### 任务 3：创建 Rust 后端骨架

**文件：**
- 创建：`packages/jackcom/src-tauri/Cargo.toml`
- 创建：`packages/jackcom/src-tauri/build.rs`
- 创建：`packages/jackcom/src-tauri/tauri.conf.json`
- 创建：`packages/jackcom/src-tauri/capabilities/default.json`
- 创建：`packages/jackcom/src-tauri/src/main.rs`
- 创建：`packages/jackcom/src-tauri/src/lib.rs`

- [ ] **步骤 1：创建 Cargo.toml**

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

- [ ] **步骤 2：创建 build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **步骤 3：创建 tauri.conf.json**

```json
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

- [ ] **步骤 4：创建 capabilities/default.json**

```json
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

- [ ] **步骤 5：创建 src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    upgrade_component_jackcom_lib::run()
}
```

- [ ] **步骤 6：创建 src/lib.rs — 占位，只注册一个 ping 命令**

```rust
mod error;

use error::AppError;

#[tauri::command]
fn ping() -> Result<&'static str, AppError> {
    Ok("pong")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 7：创建 src/error.rs — 统一错误类型骨架**

```rust
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("串口错误: {0}")]
    Serial(String),
    #[error("协议解析错误: {0}")]
    Protocol(String),
    #[error("数据库错误: {0}")]
    Database(String),
    #[error("端口不存在: {0}")]
    PortNotFound(String),
    #[error("端口已被占用: {0}")]
    PortInUse(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
```

- [ ] **步骤 8：生成 Tauri 图标占位**

```bash
cd packages/jackcom && pnpm tauri icon
```

如果报错找不到图标源文件，手动创建 `src-tauri/icons/` 目录并放入任意 PNG 图片再运行。或者跳过此步骤，`cargo build` 会警告但不阻塞。

- [ ] **步骤 9：验证 Rust 编译**

```bash
cd packages/jackcom/src-tauri && cargo check
```

预期：编译通过，无错误。

- [ ] **步骤 10：Commit**

```bash
git add packages/jackcom/src-tauri/
git commit -m "feat(jackcom): init Rust backend skeleton with Tauri v2"
```

---

### 任务 4：定义 Rust 基础类型（protocol + serial config）

**文件：**
- 创建：`packages/jackcom/src-tauri/src/protocol/mod.rs`
- 创建：`packages/jackcom/src-tauri/src/protocol/frame.rs`
- 创建：`packages/jackcom/src-tauri/src/serial/config.rs`
- 创建：`packages/jackcom/src-tauri/src/serial/mod.rs`

- [ ] **步骤 1：创建 protocol/mod.rs — trait + 枚举定义**

```rust
use serde::{Deserialize, Serialize};

/// 支持的协议类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProtocolType {
    Raw,
    Modbus,
    AT,
    Json,
}

/// 检测结果
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Detection {
    NeedMore,
    Matched(ProtocolType, usize),
    Rejected,
}

/// 协议检测器 trait
pub trait ProtocolDetector: Send {
    fn feed(&mut self, byte: u8) -> Detection;
    fn reset(&mut self);
    fn protocol_name(&self) -> ProtocolType;
}

/// 解析后的数据（按协议分发）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ParsedData {
    Raw { hex: String, ascii: String },
    Modbus(ModbusData),
    AT(ATData),
    Json(serde_json::Value),
}

/// Modbus 解析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusData {
    pub slave: u8,
    pub function: String,
    pub start_reg: u16,
    pub count: u16,
    pub values: Vec<u16>,
    pub crc_valid: bool,
}

/// AT 命令解析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ATData {
    pub command: String,
    pub is_response: bool,
    pub params: Option<String>,
}

/// 解析错误
#[derive(Debug, Clone, thiserror::Error)]
pub enum ParseError {
    #[error("CRC 校验失败")]
    CrcMismatch,
    #[error("帧长度不足: 期望 {expected}, 实际 {actual}")]
    InsufficientLength { expected: usize, actual: usize },
    #[error("无效的功能码: 0x{0:02X}")]
    InvalidFunctionCode(u8),
    #[error("JSON 解析失败: {0}")]
    JsonError(String),
    #[error("未知协议")]
    UnknownProtocol,
}

/// 协议解析器 trait
pub trait ProtocolParser: Send {
    fn protocol(&self) -> ProtocolType;
    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError>;
    fn format(&self, parsed: &ParsedData) -> String;
}
```

- [ ] **步骤 2：创建 protocol/frame.rs — Frame 三层模型**

```rust
use bytes::Bytes;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::ProtocolType;

/// 数据方向
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Tx,
    Rx,
}

/// 原始帧：串口读到的最小单位
#[derive(Debug, Clone)]
pub struct RawFrame {
    pub port_id: String,
    pub timestamp: DateTime<Utc>,
    pub data: Bytes,
    pub direction: Direction,
}

/// 解析帧：经 Parser 处理后的结构化数据
#[derive(Debug, Clone)]
pub struct ParsedFrame {
    pub raw: RawFrame,
    pub protocol: ProtocolType,
    pub formatted: String,
}

/// 前端展示帧：发给 React 的最小子集
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayFrame {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub direction: Direction,
    pub raw_hex: String,
    pub formatted: String,
    pub protocol: ProtocolType,
    pub summary: String,
}

/// 将字节数组格式化为 HEX 字符串
pub fn bytes_to_hex(data: &[u8]) -> String {
    data.iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ")
}

/// 将字节数组格式化为 ASCII（不可见字符用 . 替代）
pub fn bytes_to_ascii(data: &[u8]) -> String {
    data.iter()
        .map(|&b| if b >= 0x20 && b < 0x7F { b as char } else { '.' })
        .collect()
}
```

- [ ] **步骤 3：创建 serial/config.rs — 串口配置类型**

```rust
use serde::{Deserialize, Serialize};

/// 串口配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialConfig {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub stop_bits: StopBits,
    pub parity: Parity,
    pub flow_control: FlowControl,
}

/// 常用波特率预设
pub const BAUD_RATES: &[u32] = &[
    1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
];

impl Default for SerialConfig {
    fn default() -> Self {
        Self {
            port_name: String::new(),
            baud_rate: 115200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DataBits {
    Five,
    Six,
    Seven,
    Eight,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StopBits {
    One,
    Two,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Parity {
    None,
    Odd,
    Even,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlowControl {
    None,
    Hardware,
    Software,
}

/// 连接关闭原因
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseReason {
    Disconnected,
    Error,
    Removed,
}
```

- [ ] **步骤 4：创建 serial/mod.rs**

```rust
pub mod config;

pub use config::SerialConfig;
```

- [ ] **步骤 5：在 lib.rs 中注册模块**

在 `lib.rs` 顶部追加模块声明：

```rust
mod error;
mod protocol;
mod serial;
```

删除原有的 `mod error;` 行（不重复声明）。

- [ ] **步骤 6：验证编译**

```bash
cd packages/jackcom/src-tauri && cargo check
```

预期：编译通过。

- [ ] **步骤 7：Commit**

```bash
git add packages/jackcom/src-tauri/src/
git commit -m "feat(jackcom): define protocol traits, frame types, and serial config"
```

---

### 任务 5：定义 Rust state 模块

**文件：**
- 创建：`packages/jackcom/src-tauri/src/state.rs`
- 创建：`packages/jackcom/src-tauri/src/channel/mod.rs`
- 创建：`packages/jackcom/src-tauri/src/commands/mod.rs`
- 修改：`packages/jackcom/src-tauri/src/lib.rs`

- [ ] **步骤 1：创建 state.rs**

```rust
use std::sync::Arc;

use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::RwLock;

use crate::serial::SerialConfig;

/// 全局应用状态
pub struct AppState {
    /// 已打开的串口连接（port_name → config）
    pub connections: DashMap<String, SerialConfig>,
    /// 数据库连接池
    pub db: Arc<RwLock<Option<SqlitePool>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            db: Arc::new(RwLock::new(None)),
        }
    }
}
```

- [ ] **步骤 2：创建 channel/mod.rs 占位**

```rust
// channel 模块：解耦串口 I/O 和前端推送
// 将在后续计划中实现 broker + backpressure
```

- [ ] **步骤 3：创建 commands/mod.rs 占位**

```rust
// commands 模块：Tauri IPC 命令层
// 将在后续计划中实现
```

- [ ] **步骤 4：更新 lib.rs — 注册 state + 所有模块**

```rust
mod channel;
mod commands;
mod error;
mod protocol;
mod serial;
mod state;

use state::AppState;

#[tauri::command]
fn ping() -> Result<&'static str, error::AppError> {
    Ok("pong")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 5：验证编译**

```bash
cd packages/jackcom/src-tauri && cargo check
```

预期：编译通过。

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src-tauri/src/
git commit -m "feat(jackcom): add AppState, channel and commands module stubs"
```

---

### 任务 6：更新根 package.json + 端到端验证

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：在根 package.json 追加 jackcom 脚本**

在根 `package.json` 的 `scripts` 中追加：

```json
"dev:jackcom": "pnpm --filter @upgrade-component/jackcom dev",
"build:jackcom": "pnpm --filter @upgrade-component/jackcom build",
"test:jackcom": "pnpm --filter @upgrade-component/jackcom test",
"test:jackcom:rust": "cd packages/jackcom/src-tauri && cargo test"
```

- [ ] **步骤 2：安装 monorepo 依赖**

```bash
cd D:/Project/upgrade-component && pnpm install
```

预期：所有 workspace 依赖解析成功。

- [ ] **步骤 3：验证前端构建**

```bash
cd D:/Project/upgrade-component && pnpm build:jackcom
```

预期：`packages/jackcom/dist/` 生成。

- [ ] **步骤 4：验证 Rust 编译**

```bash
cd D:/Project/upgrade-component && pnpm test:jackcom:rust
```

预期：`ping` 测试通过（如果 lib.rs 中有 `#[cfg(test)]` 的测试），或者 `cargo test` 成功运行（0 tests 也是正常的）。

- [ ] **步骤 5：验证 `pnpm tauri dev` 可启动（手动）**

```bash
cd packages/jackcom && pnpm tauri dev
```

预期：窗口启动，显示 "JackCom — Serial Debugger" 标题和骨架页面。验证后关闭。

- [ ] **步骤 6：Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(jackcom): add jackcom scripts to root package.json"
```

---

## 自检

**规格覆盖度：**
- ✅ 项目骨架（Astro + React + Tauri v2）
- ✅ 基础类型（ProtocolType, Direction, RawFrame, ParsedFrame, DisplayFrame, SerialConfig）
- ✅ trait 定义（ProtocolDetector, ProtocolParser）
- ✅ 错误类型（AppError, ParseError）
- ✅ AppState 骨架
- ✅ Astro 页面壳（4 个窗口）
- ✅ Monorepo 集成（根脚本）
- 后续计划覆盖：protocol 实现、channel/broker、storage、serial manager、commands、前端 UI 组件

**占位符扫描：** 无 TODO/TBD，所有步骤有完整代码。

**类型一致性：** `ProtocolType`、`Direction`、`ParseError` 等在 protocol/mod.rs 定义，frame.rs 和 serial/config.rs 引用一致。后续计划将基于这些类型扩展。
