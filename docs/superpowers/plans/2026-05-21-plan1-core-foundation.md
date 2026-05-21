# Plan 1: 核心类型与协议基础

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 建立 JackCom 后端的所有基础类型定义——newtype、枚举、trait、事件类型。这些是后续所有层（协议、基础设施、服务、命令）的依赖基础。

**架构：** 在 `src/core/` 下创建三层子模块：`serial/`（串口类型）、`protocol/`（协议类型 + trait + 帧 + 格式化）、`event/`（事件 + 显示帧）。所有代码为纯逻辑，零 I/O、零 async，可独立编译测试。

**技术栈：** Rust 2021 edition, serde (derive), bytes, chrono, anyhow

**基目录：** `packages/jackcom/src-tauri/`

**依赖关系：** 此计划无外部依赖，是整个重构的基础。

---

## 文件结构

| 操作 | 文件 | 职责 | 预估行数 |
|------|------|------|---------|
| 修改 | `Cargo.toml` | 添加 anyhow 依赖 | +1 |
| 修改 | `src/lib.rs` | 添加 `mod core;` 声明 | +1 |
| 创建 | `src/core/mod.rs` | 模块声明 | ~5 |
| 创建 | `src/core/serial/mod.rs` | 模块声明 | ~3 |
| 创建 | `src/core/serial/types.rs` | PortName, SessionId, Direction | ~70 |
| 创建 | `src/core/serial/config.rs` | SerialConfig + 枚举 + CloseReason | ~80 |
| 创建 | `src/core/protocol/mod.rs` | 模块声明 + re-exports | ~15 |
| 创建 | `src/core/protocol/types.rs` | ProtocolType, Detection | ~40 |
| 创建 | `src/core/protocol/error.rs` | ParseError, DetectError | ~30 |
| 创建 | `src/core/protocol/traits.rs` | ProtocolParser, ProtocolDetector traits | ~25 |
| 创建 | `src/core/protocol/frame.rs` | ParsedFrame, ParsedData, 懒计算 | ~120 |
| 创建 | `src/core/protocol/format.rs` | bytes_to_hex, bytes_to_ascii | ~30 |
| 创建 | `src/core/event/mod.rs` | 模块声明 | ~3 |
| 创建 | `src/core/event/port_event.rs` | PortEvent 枚举（5 变体） | ~50 |
| 创建 | `src/core/event/display_frame.rs` | DisplayFrame（前端契约） | ~30 |

---

### 任务 1：创建模块骨架 + Cargo.toml

**文件：**
- 修改：`Cargo.toml`
- 修改：`src/lib.rs`
- 创建：`src/core/mod.rs`
- 创建：`src/core/serial/mod.rs`
- 创建：`src/core/protocol/mod.rs`
- 创建：`src/core/protocol/parsers/mod.rs`
- 创建：`src/core/event/mod.rs`

- [ ] **步骤 1：添加 anyhow 到 Cargo.toml**

在 `packages/jackcom/src-tauri/Cargo.toml` 的 `[dependencies]` 中，添加 `anyhow = "1"` ，保留现有 `thiserror = "2"`（旧代码仍需要，Plan 5 清理）。

- [ ] **步骤 2：创建 core 模块目录结构**

```bash
mkdir -p src/core/serial src/core/protocol/parsers src/core/event
```

创建 `src/core/mod.rs`：
```rust
pub mod serial;
pub mod protocol;
pub mod event;
```

创建 `src/core/serial/mod.rs`：
```rust
pub mod config;
pub mod types;
```

创建 `src/core/protocol/mod.rs`：
```rust
pub mod error;
pub mod format;
pub mod frame;
pub mod traits;
pub mod types;
pub mod parsers;
pub mod detector;

pub use types::{ProtocolType, Detection, ModbusData, ATData};
pub use error::ParseError;
pub use frame::{ParsedFrame, ParsedData};
```

创建 `src/core/protocol/parsers/mod.rs`（暂时空）：
```rust
// 协议解析器 — Plan 2 实现
```

创建 `src/core/event/mod.rs`：
```rust
pub mod port_event;
pub mod display_frame;

pub use port_event::PortEvent;
pub use display_frame::DisplayFrame;
```

- [ ] **步骤 3：创建占位文件确保编译**

创建空实现文件（每个只有注释），确保模块能编译：

- `src/core/serial/types.rs` → `// Plan 1 Task 2`
- `src/core/serial/config.rs` → `// Plan 1 Task 3`
- `src/core/protocol/types.rs` → `// Plan 1 Task 4`
- `src/core/protocol/error.rs` → `// Plan 1 Task 4`
- `src/core/protocol/traits.rs` → `// Plan 1 Task 5`
- `src/core/protocol/frame.rs` → `// Plan 1 Task 6`
- `src/core/protocol/format.rs` → `// Plan 1 Task 6`
- `src/core/event/port_event.rs` → `// Plan 1 Task 7`
- `src/core/event/display_frame.rs` → `// Plan 1 Task 7`

- [ ] **步骤 4：在 lib.rs 中添加 `mod core;`**

在 `src/lib.rs` 的模块声明区域添加：
```rust
mod core;
```

放在现有模块声明之后。旧模块保持不变。

- [ ] **步骤 5：验证编译**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：编译通过（可能有 unused warnings，可忽略）

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src-tauri/Cargo.toml packages/jackcom/src-tauri/src/core/ packages/jackcom/src-tauri/src/lib.rs
git commit -m "feat(jackcom): 创建 core 模块骨架 + 添加 anyhow 依赖"
```

---

### 任务 2：Serial 基础类型 — PortName, SessionId, Direction

**文件：**
- 修改：`src/core/serial/types.rs`
- 测试：内联 `#[cfg(test)] mod tests`

- [ ] **步骤 1：编写失败的测试**

在 `src/core/serial/types.rs` 中写入：

```rust
use serde::{Deserialize, Serialize};

/// 端口名 (newtype — 防止与其他 String 混淆)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PortName(pub String);

impl PortName {
    pub fn new(name: impl Into<String>) -> Self {
        Self(name.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for PortName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for PortName {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&str> for PortName {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl AsRef<str> for PortName {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

/// 会话 ID (newtype)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SessionId(pub i64);

impl SessionId {
    pub fn new(id: i64) -> Self {
        Self(id)
    }

    pub fn value(&self) -> i64 {
        self.0
    }
}

impl From<i64> for SessionId {
    fn from(id: i64) -> Self {
        Self(id)
    }
}

/// 数据方向
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Tx,
    Rx,
}

impl std::fmt::Display for Direction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Direction::Tx => write!(f, "tx"),
            Direction::Rx => write!(f, "rx"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_name_newtype() {
        let name = PortName::new("COM3");
        assert_eq!(name.as_str(), "COM3");
        assert_eq!(format!("{name}"), "COM3");
        let from_str: PortName = "COM5".into();
        assert_eq!(from_str, PortName::new("COM5"));
    }

    #[test]
    fn port_name_serde_roundtrip() {
        let name = PortName::new("COM3");
        let json = serde_json::to_string(&name).unwrap();
        assert_eq!(json, "\"COM3\"");
        let back: PortName = serde_json::from_str(&json).unwrap();
        assert_eq!(back, name);
    }

    #[test]
    fn session_id_newtype() {
        let id = SessionId::new(42);
        assert_eq!(id.value(), 42);
        let from_i64: SessionId = 42i64.into();
        assert_eq!(from_i64, id);
    }

    #[test]
    fn direction_serde_lowercase() {
        let json = serde_json::to_string(&Direction::Tx).unwrap();
        assert_eq!(json, "\"tx\"");
        let json = serde_json::to_string(&Direction::Rx).unwrap();
        assert_eq!(json, "\"rx\"");
        // roundtrip
        let back: Direction = serde_json::from_str("\"tx\"").unwrap();
        assert_eq!(back, Direction::Tx);
    }

    #[test]
    fn direction_display() {
        assert_eq!(format!("{}", Direction::Tx), "tx");
        assert_eq!(format!("{}", Direction::Rx), "rx");
    }
}
```

- [ ] **步骤 2：运行测试验证通过**

运行：`cd packages/jackcom/src-tauri && cargo test --lib core::serial::types`
预期：5 个测试全部 PASS

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/core/serial/types.rs
git commit -m "feat(jackcom): 添加 PortName, SessionId, Direction 基础类型"
```

---

### 任务 3：Serial 配置类型

**文件：**
- 修改：`src/core/serial/config.rs`

> 注：设计说"直接 re-export serialport 类型"，但 serialport 的枚举不一定带 serde derive。为安全起见，保持与现有代码完全一致的自定义枚举 + serde 属性，确保前端 JSON 格式不变。

- [ ] **步骤 1：实现配置类型**

将 `src/core/serial/config.rs` 内容写为（与现有 `serial/config.rs` 相同的 serde 格式）：

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serial_config_default() {
        let config = SerialConfig::default();
        assert_eq!(config.baud_rate, 115200);
        assert_eq!(config.data_bits, DataBits::Eight);
    }

    #[test]
    fn data_bits_serde_lowercase() {
        let json = serde_json::to_string(&DataBits::Eight).unwrap();
        assert_eq!(json, "\"eight\"");
        let back: DataBits = serde_json::from_str("\"eight\"").unwrap();
        assert_eq!(back, DataBits::Eight);
    }

    #[test]
    fn close_reason_serde() {
        let json = serde_json::to_string(&CloseReason::Disconnected).unwrap();
        assert_eq!(json, "\"disconnected\"");
    }
}
```

- [ ] **步骤 2：运行测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib core::serial::config`
预期：3 个测试全部 PASS

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/core/serial/config.rs
git commit -m "feat(jackcom): 添加 SerialConfig 及相关枚举类型"
```

---

### 任务 4：协议类型 + 错误类型

**文件：**
- 修改：`src/core/protocol/types.rs`
- 修改：`src/core/protocol/error.rs`

- [ ] **步骤 1：实现协议类型和错误类型**

`src/core/protocol/types.rs`：
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
    Matched(ProtocolType, usize), // (协议, 匹配长度)
    Rejected,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protocol_type_serde_lowercase() {
        assert_eq!(serde_json::to_string(&ProtocolType::Raw).unwrap(), "\"raw\"");
        assert_eq!(serde_json::to_string(&ProtocolType::Modbus).unwrap(), "\"modbus\"");
        assert_eq!(serde_json::to_string(&ProtocolType::AT).unwrap(), "\"at\"");
        assert_eq!(serde_json::to_string(&ProtocolType::Json).unwrap(), "\"json\"");
        // roundtrip
        let back: ProtocolType = serde_json::from_str("\"modbus\"").unwrap();
        assert_eq!(back, ProtocolType::Modbus);
    }
}
```

`src/core/protocol/error.rs`：
```rust
/// 协议解析错误
#[derive(Debug, Clone)]
pub enum ParseError {
    CrcMismatch,
    InsufficientLength { expected: usize, actual: usize },
    InvalidFunctionCode(u8),
    JsonError(String),
    UnknownProtocol,
    InvalidFrame(String),
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::CrcMismatch => write!(f, "CRC 校验失败"),
            ParseError::InsufficientLength { expected, actual } => {
                write!(f, "帧长度不足: 期望 {expected}, 实际 {actual}")
            }
            ParseError::InvalidFunctionCode(code) => {
                write!(f, "无效的功能码: 0x{code:02X}")
            }
            ParseError::JsonError(msg) => write!(f, "JSON 解析失败: {msg}"),
            ParseError::UnknownProtocol => write!(f, "未知协议"),
            ParseError::InvalidFrame(msg) => write!(f, "无效帧: {msg}"),
        }
    }
}

impl std::error::Error for ParseError {}

/// 协议检测错误
#[derive(Debug, Clone)]
pub enum DetectError {
    NoMatch,
    Ambiguous(Vec<String>),
}

impl std::fmt::Display for DetectError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DetectError::NoMatch => write!(f, "无协议匹配"),
            DetectError::Ambiguous(protocols) => {
                write!(f, "多个协议匹配: {}", protocols.join(", "))
            }
        }
    }
}

impl std::error::Error for DetectError {}
```

- [ ] **步骤 2：运行测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib core::protocol::types`
预期：1 个测试 PASS

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/core/protocol/types.rs packages/jackcom/src-tauri/src/core/protocol/error.rs
git commit -m "feat(jackcom): 添加 ProtocolType, Detection, ParseError, DetectError"
```

---

### 任务 5：协议 Trait 定义

**文件：**
- 修改：`src/core/protocol/traits.rs`

- [ ] **步骤 1：定义 trait**

```rust
use super::error::ParseError;
use super::types::ProtocolType;
use super::frame::ParsedData;

/// 协议解析器 trait
pub trait ProtocolParser: Send + Sync {
    fn protocol(&self) -> ProtocolType;
    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError>;
}

/// 协议检测器 trait（逐字节状态机）
pub trait ProtocolDetector: Send {
    fn feed(&mut self, byte: u8) -> super::types::Detection;
    fn reset(&mut self);
    fn protocol_name(&self) -> ProtocolType;
}
```

- [ ] **步骤 2：验证编译**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/core/protocol/traits.rs
git commit -m "feat(jackcom): 定义 ProtocolParser 和 ProtocolDetector trait"
```

---

### 任务 6：ParsedFrame + ParsedData + 格式化函数

**文件：**
- 修改：`src/core/protocol/frame.rs`
- 修改：`src/core/protocol/format.rs`

**关键 serde 属性：**
- `ParsedData` 使用 `#[serde(tag = "type", content = "data")]` — 这是前端格式契约

- [ ] **步骤 1：实现格式化函数**

`src/core/protocol/format.rs`：
```rust
/// 将字节数组格式化为 HEX 字符串（大写、空格分隔）
pub fn bytes_to_hex(data: &[u8]) -> String {
    data.iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ")
}

/// 将字节数组格式化为 ASCII（不可见字符用 . 替代）
pub fn bytes_to_ascii(data: &[u8]) -> String {
    data.iter()
        .map(|&b| {
            if b >= 0x20 && b < 0x7F {
                b as char
            } else {
                '.'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_format() {
        assert_eq!(bytes_to_hex(&[0x01, 0x03, 0xFF]), "01 03 FF");
        assert_eq!(bytes_to_hex(&[]), "");
    }

    #[test]
    fn ascii_format() {
        assert_eq!(bytes_to_ascii(&[b'H', 0x00, b'i']), "H.i");
        assert_eq!(bytes_to_ascii(&[0x20, 0x7E]), " ~");
    }
}
```

- [ ] **步骤 2：实现 ParsedFrame 和 ParsedData**

`src/core/protocol/frame.rs`：
```rust
use std::sync::OnceLock;

use bytes::Bytes;
use serde::{Deserialize, Serialize};

use super::types::{ATData, ModbusData, ProtocolType};
use super::format::{bytes_to_hex, bytes_to_ascii};

/// 解析后的数据（按协议分发）
///
/// **Serde 契约**（前端依赖此格式，不可更改）：
/// - `{"type":"raw","data":{"hex":"01 03 FF","ascii":"..."}}`
/// - `{"type":"modbus","data":{"slave":1,"function":"...",...}}`
/// - `{"type":"at","data":{"command":"AT","is_response":false,...}}`
/// - `{"type":"json","data":{...}}`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ParsedData {
    Raw { hex: String, ascii: String },
    Modbus(ModbusData),
    AT(ATData),
    Json(serde_json::Value),
}

/// 解析帧：经 Parser 处理后的结构化数据
#[derive(Debug, Clone)]
pub struct ParsedFrame {
    pub raw: Bytes,
    pub protocol: ProtocolType,
    pub parsed: ParsedData,
    formatted: OnceLock<String>,
}

impl ParsedFrame {
    pub fn new(raw: Bytes, protocol: ProtocolType, parsed: ParsedData) -> Self {
        Self {
            raw,
            protocol,
            parsed,
            formatted: OnceLock::new(),
        }
    }

    /// 获取格式化文本（懒计算，只触发一次）
    pub fn formatted(&self) -> &str {
        self.formatted.get_or_init(|| self.compute_format())
    }

    fn compute_format(&self) -> String {
        match &self.parsed {
            ParsedData::Raw { hex, ascii } => {
                format!("HEX: {hex}\nASCII: {ascii}")
            }
            ParsedData::Modbus(data) => {
                format!(
                    "Modbus RTU | 从站: {} | 功能: {} | 寄存器: {}-{} | 值: {:?}",
                    data.slave, data.function, data.start_reg,
                    data.start_reg + data.count - 1, data.values
                )
            }
            ParsedData::AT(data) => {
                let prefix = if data.is_response { "←" } else { "→" };
                format!("{prefix} AT{}", data.command)
            }
            ParsedData::Json(val) => {
                serde_json::to_string_pretty(val).unwrap_or_default()
            }
        }
    }

    /// 获取摘要文本
    pub fn summary(&self) -> String {
        match &self.parsed {
            ParsedData::Raw { .. } => {
                format!("Raw {} bytes", self.raw.len())
            }
            ParsedData::Modbus(data) => {
                format!("Modbus {} slave={}", data.function, data.slave)
            }
            ParsedData::AT(data) => {
                let kind = if data.is_response { "响应" } else { "命令" };
                format!("AT {} {}", kind, data.command)
            }
            ParsedData::Json(_) => "JSON".to_string(),
        }
    }

    /// 获取 hex 字符串（用于 DB 存储 / 前端 raw_hex 字段）
    pub fn raw_hex(&self) -> String {
        bytes_to_hex(&self.raw)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parsed_data_raw_serde() {
        let data = ParsedData::Raw {
            hex: "01 03 FF".to_string(),
            ascii: "...".to_string(),
        };
        let json = serde_json::to_string(&data).unwrap();
        // 验证 tagged union 格式
        assert!(json.contains(r#""type":"raw""#));
        assert!(json.contains(r#""data""#));
        assert!(json.contains(r#""hex":"01 03 FF""#));
        // roundtrip
        let back: ParsedData = serde_json::from_str(&json).unwrap();
        if let ParsedData::Raw { hex, ascii } = back {
            assert_eq!(hex, "01 03 FF");
            assert_eq!(ascii, "...");
        } else {
            panic!("Expected Raw variant");
        }
    }

    #[test]
    fn parsed_data_modbus_serde() {
        let data = ParsedData::Modbus(ModbusData {
            slave: 1,
            function: "Read Holding Registers".to_string(),
            start_reg: 0,
            count: 10,
            values: vec![100, 200],
            crc_valid: true,
        });
        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains(r#""type":"modbus""#));
        let back: ParsedData = serde_json::from_str(&json).unwrap();
        assert!(matches!(back, ParsedData::Modbus(_)));
    }

    #[test]
    fn parsed_data_json_serde() {
        let inner = serde_json::json!({"key": "value"});
        let data = ParsedData::Json(inner.clone());
        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains(r#""type":"json""#));
        let back: ParsedData = serde_json::from_str(&json).unwrap();
        assert!(matches!(back, ParsedData::Json(_)));
    }

    #[test]
    fn parsed_frame_lazy_format() {
        let frame = ParsedFrame::new(
            Bytes::from_static(&[0x01, 0x03]),
            ProtocolType::Raw,
            ParsedData::Raw {
                hex: "01 03".to_string(),
                ascii: "..".to_string(),
            },
        );
        // 首次调用触发计算
        let fmt = frame.formatted();
        assert!(fmt.contains("HEX: 01 03"));
        // 再次调用不重新计算（OnceLock 保证）
        let fmt2 = frame.formatted();
        assert!(std::ptr::eq(fmt, fmt2));
    }

    #[test]
    fn parsed_frame_summary() {
        let frame = ParsedFrame::new(
            Bytes::from_static(&[0x01, 0x03]),
            ProtocolType::Raw,
            ParsedData::Raw {
                hex: "01 03".to_string(),
                ascii: "..".to_string(),
            },
        );
        assert_eq!(frame.summary(), "Raw 2 bytes");
    }
}
```

- [ ] **步骤 3：更新 protocol/mod.rs 的 re-exports**

确保 `src/core/protocol/mod.rs` 导出了正确的类型：
```rust
pub mod error;
pub mod format;
pub mod frame;
pub mod traits;
pub mod types;
pub mod parsers;
pub mod detector;

pub use types::{ProtocolType, Detection, ModbusData, ATData};
pub use error::ParseError;
pub use frame::{ParsedFrame, ParsedData};
```

- [ ] **步骤 4：运行测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib core::protocol`
预期：所有测试 PASS（format 2 个 + frame 5 个）

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src-tauri/src/core/protocol/
git commit -m "feat(jackcom): 添加 ParsedFrame, ParsedData, 格式化函数"
```

---

### 任务 7：PortEvent 枚举 + DisplayFrame

**文件：**
- 修改：`src/core/event/port_event.rs`
- 修改：`src/core/event/display_frame.rs`

**关键 serde 属性：**
- `PortEvent` 使用 `#[serde(tag = "type", rename_all = "lowercase")]`

- [ ] **步骤 1：实现 PortEvent**

`src/core/event/port_event.rs`：
```rust
use std::sync::Arc;

use serde::Serialize;

use crate::core::protocol::frame::ParsedFrame;
use crate::core::serial::config::{CloseReason, SerialConfig};
use crate::core::serial::types::{Direction, PortName};

/// 端口事件（内部事件总线 + 前端通知共用）
///
/// **Serde 契约**（前端依赖此格式）：
/// - `{"type":"data","port_id":"COM3","frames":[...],"direction":"rx"}`
/// - `{"type":"opened","port_id":"COM3","config":{...}}`
/// - `{"type":"closed","port_id":"COM3","reason":"disconnected"}`
/// - `{"type":"error","port_id":"COM3","error":"..."}`
/// - `{"type":"change","arrived":[...],"removed":[...]}`
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum PortEvent {
    Data {
        port_id: PortName,
        frames: Vec<ParsedFrame>,
        direction: Direction,
    },
    Opened {
        port_id: PortName,
        config: SerialConfig,
    },
    Closed {
        port_id: PortName,
        reason: CloseReason,
    },
    Error {
        port_id: PortName,
        error: String,
    },
    Change {
        arrived: Vec<PortName>,
        removed: Vec<PortName>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_event_data_serde() {
        let event = PortEvent::Data {
            port_id: PortName::new("COM3"),
            frames: vec![],
            direction: Direction::Rx,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"data""#));
        assert!(json.contains(r#""port_id":"COM3""#));
        assert!(json.contains(r#""direction":"rx""#));
    }

    #[test]
    fn port_event_opened_serde() {
        let event = PortEvent::Opened {
            port_id: PortName::new("COM3"),
            config: SerialConfig::default(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"opened""#));
    }

    #[test]
    fn port_event_change_serde() {
        let event = PortEvent::Change {
            arrived: vec![PortName::new("COM4")],
            removed: vec![PortName::new("COM3")],
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"change""#));
        assert!(json.contains(r#""arrived""#));
        assert!(json.contains(r#""removed""#));
    }
}
```

- [ ] **步骤 2：实现 DisplayFrame**

`src/core/event/display_frame.rs`：
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::core::protocol::types::ProtocolType;
use crate::core::serial::types::Direction;

/// 前端展示帧 — 字段名必须与前端 TypeScript 类型定义完全一致
///
/// **注意**：`raw_hex` 字段名（不是 `raw_data`）与当前前端一致
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_frame_serde_field_names() {
        let frame = DisplayFrame {
            id: 1,
            timestamp: DateTime::UNIX_EPOCH,
            direction: Direction::Rx,
            raw_hex: "01 03".to_string(),
            formatted: "HEX: 01 03".to_string(),
            protocol: ProtocolType::Raw,
            summary: "Raw 2 bytes".to_string(),
        };
        let json = serde_json::to_value(&frame).unwrap();
        // 验证字段名与前端一致
        assert!(json.get("id").is_some());
        assert!(json.get("timestamp").is_some());
        assert!(json.get("direction").is_some());
        assert!(json.get("raw_hex").is_some(), "字段名必须是 raw_hex");
        assert!(json.get("formatted").is_some());
        assert!(json.get("protocol").is_some());
        assert!(json.get("summary").is_some());
        // 不应该有 raw_data 字段
        assert!(json.get("raw_data").is_none());
    }
}
```

- [ ] **步骤 3：运行测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib core::event`
预期：4 个测试 PASS

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/src/core/event/
git commit -m "feat(jackcom): 添加 PortEvent 枚举和 DisplayFrame"
```

---

### 任务 8：全量编译验证 + 清理

- [ ] **步骤 1：运行全量编译检查**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：通过（可能有些 unused warnings 因为 detector.rs 和 parsers/ 还没实现）

- [ ] **步骤 2：运行所有 core 模块测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib core`
预期：所有 ~15 个测试通过

- [ ] **步骤 3：确认旧代码未被破坏**

运行：`cd packages/jackcom/src-tauri && cargo test`
预期：所有测试通过（包括旧的 `channel_broker_integration` 测试）

---

## 自检

**1. 规格覆盖度：**
- §3.1 SerialState → Plan 4
- §3.2 Serde 契约 → ✅ 任务 4, 6, 7 覆盖
- §3.3 EventEmitter → Plan 4
- §3.4 EventBus → Plan 4
- §3.5 零拷贝 → ParsedFrame.raw: Bytes ✅, OnceCell ✅
- §3.8 错误处理 → ParseError ✅（anyhow 在 Plan 5 统一）
- §5.4 懒计算 → ParsedFrame.formatted: OnceLock ✅
- §6.1 Enum dispatch → Plan 2
- §6.2 Newtype → PortName, SessionId ✅
- §8.3 DisplayFrame → ✅

**2. 占位符扫描：** 无 TODO/待定

**3. 类型一致性：**
- `PortName` 在所有文件中一致
- `Direction` 在 ParsedFrame/PortEvent/DisplayFrame 中使用同一类型
- `ParsedData` serde 属性 `tag="type", content="data"` 在 frame.rs 和 tests 中一致
- `ProtocolType` serde 属性 `rename_all="lowercase"` 在 types.rs 和 DisplayFrame 中一致
- DisplayFrame 字段名 `raw_hex` 与当前前端一致（非设计文档中的 `raw_data`）
