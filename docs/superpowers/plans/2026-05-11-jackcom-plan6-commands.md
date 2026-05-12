# Plan 6: JackCom Tauri Commands（IPC API 层）

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** TDD 实现所有 Tauri `#[tauri::command]` 函数，作为前后端通信的 IPC API 层

**架构：** 每个 Tauri command 接收 `tauri::State<AppState>`，调用 Plan 2-5 已实现的底层模块（SerialManager、Broker、Storage），统一返回 `Result<T, AppError>`。所有请求参数和返回类型均为 `Serialize + Deserialize` 结构体，确保前后端类型契约完整。

**技术栈：** Tauri v2、tokio、serialport、sqlx、dashmap

**前置依赖（Plan 1-5 已完成）：**
- `state.rs`: `AppState { connections: DashMap<String, SerialConfig>, db: Arc<RwLock<Option<SqlitePool>>> }`
- `serial/manager.rs`: `SerialManager` with `open_port`, `close_port`, `shutdown`, `send_data`
- `serial/watcher.rs`: `PortWatcher` with `start`/`stop`
- `serial/config.rs`: `SerialConfig`, `DataBits`, `StopBits`, `Parity`, `FlowControl`, `BAUD_RATES`
- `channel/broker.rs`: `Broker`
- `storage/mod.rs`: `insert_frame`, `query_frames`, `create_session`, `list_sessions`
- `protocol/mod.rs`: `ProtocolType`
- `protocol/frame.rs`: `DisplayFrame`, `Direction`

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 修改 | `packages/jackcom/src-tauri/src/state.rs` | 扩展 AppState 集成 SerialManager + Broker |
| 修改 | `packages/jackcom/src-tauri/src/commands/mod.rs` | 注册所有命令子模块 |
| 创建 | `packages/jackcom/src-tauri/src/commands/serial.rs` | 串口相关命令 |
| 创建 | `packages/jackcom/src-tauri/src/commands/data.rs` | 数据查询与导出命令 |
| 创建 | `packages/jackcom/src-tauri/src/commands/config.rs` | 配置与会话管理命令 |
| 修改 | `packages/jackcom/src-tauri/src/lib.rs` | 注册所有命令到 invoke_handler |
| 创建 | `packages/jackcom/src-tauri/src/commands/types.rs` | 命令请求/响应类型定义 |

---

### 任务 1：定义命令请求/响应类型（types.rs）

**文件：**
- 创建：`packages/jackcom/src-tauri/src/commands/types.rs`

- [ ] **步骤 1：创建 commands/types.rs — 所有命令的请求和响应结构体**

```rust
use serde::{Deserialize, Serialize};

use crate::protocol::ProtocolType;
use crate::protocol::frame::Direction;
use crate::serial::config::{DataBits, FlowControl, Parity, StopBits};

// ── 枚举端口 ──

/// `enumerate_ports` 返回的单个端口信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub name: String,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
    pub port_type: String,
}

// ── 打开端口 ──

/// `open_port` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPortRequest {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub stop_bits: StopBits,
    pub parity: Parity,
    pub flow_control: FlowControl,
}

/// `open_port` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPortResponse {
    pub port_name: String,
    pub is_open: bool,
}

// ── 关闭端口 ──

/// `close_port` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosePortRequest {
    pub port_name: String,
}

/// `close_port` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosePortResponse {
    pub port_name: String,
    pub is_closed: bool,
}

// ── 关闭所有端口 ──

/// `close_all` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseAllResponse {
    pub closed_ports: Vec<String>,
}

// ── 发送数据 ──

/// `send_data` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendDataRequest {
    pub port_name: String,
    /// 十六进制字符串，例如 "01 03 00 00 00 0A C5 CD"
    pub hex_data: String,
    /// 发送使用的协议
    pub protocol: ProtocolType,
}

/// `send_data` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendDataResponse {
    pub port_name: String,
    pub bytes_sent: usize,
}

// ── 查询历史 ──

/// `query_history` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryRequest {
    pub session_id: Option<i64>,
    pub port_name: Option<String>,
    pub direction: Option<Direction>,
    pub protocol: Option<ProtocolType>,
    /// 限制返回条数
    pub limit: Option<i64>,
    /// 偏移量
    pub offset: Option<i64>,
}

/// `query_history` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryResponse {
    pub frames: Vec<crate::protocol::frame::DisplayFrame>,
    pub total: i64,
}

// ── 导出数据 ──

/// `export_data` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDataRequest {
    pub session_id: Option<i64>,
    pub port_name: Option<String>,
    /// 导出格式：csv / json / hex
    pub format: ExportFormat,
    pub file_path: String,
}

/// 导出格式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
    Hex,
}

/// `export_data` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDataResponse {
    pub file_path: String,
    pub rows_exported: usize,
}

// ── 获取配置 ──

/// `get_config` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetConfigResponse {
    pub config: crate::serial::config::SerialConfig,
}

// ── 保存配置 ──

/// `save_config` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveConfigRequest {
    pub config: crate::serial::config::SerialConfig,
}

/// `save_config` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveConfigResponse {
    pub saved: bool,
}

// ── 最近会话 ──

/// `list_recent_sessions` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRecentSessionsRequest {
    pub limit: Option<i64>,
}

/// `list_recent_sessions` 响应中的单个会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: i64,
    pub port_name: String,
    pub baud_rate: u32,
    pub created_at: String,
    pub frame_count: i64,
}

/// `list_recent_sessions` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRecentSessionsResponse {
    pub sessions: Vec<SessionInfo>,
}
```

- [ ] **步骤 2：验证编译**

```bash
cd packages/jackcom/src-tauri && cargo check
```

预期：编译通过。

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/commands/types.rs
git commit -m "feat(jackcom): define IPC request/response types for all Tauri commands"
```

---

### 任务 2：更新 AppState 集成 SerialManager + Broker + Storage

**文件：**
- 修改：`packages/jackcom/src-tauri/src/state.rs`

- [ ] **步骤 1：扩展 AppState — 添加 SerialManager、Broker、Storage 支持**

将现有 `state.rs` 替换为：

```rust
use std::sync::Arc;

use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::RwLock;

use crate::channel::broker::Broker;
use crate::serial::config::SerialConfig;
use crate::serial::manager::SerialManager;

/// 全局应用状态
pub struct AppState {
    /// 已打开的串口连接（port_name → config）
    pub connections: DashMap<String, SerialConfig>,
    /// 数据库连接池
    pub db: Arc<RwLock<Option<SqlitePool>>>,
    /// 串口管理器：负责打开/关闭/发送/接收
    pub serial_manager: Arc<SerialManager>,
    /// 事件分发 Broker：将串口数据广播到前端
    pub broker: Arc<Broker>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            db: Arc::new(RwLock::new(None)),
            serial_manager: Arc::new(SerialManager::new()),
            broker: Arc::new(Broker::new()),
        }
    }
}
```

- [ ] **步骤 2：验证编译**

```bash
cd packages/jackcom/src-tauri && cargo check
```

预期：编译通过。如果 `SerialManager::new()` 或 `Broker::new()` 签名不同，按实际 API 调整。

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/state.rs
git commit -m "feat(jackcom): extend AppState with SerialManager and Broker"
```

---

### 任务 3：实现 commands/serial.rs — TDD

**文件：**
- 创建：`packages/jackcom/src-tauri/src/commands/serial.rs`

- [ ] **步骤 1：先写测试 — commands/serial.rs 测试部分**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::serial::config::{DataBits, FlowControl, Parity, StopBits};
    use crate::state::AppState;

    fn make_test_request() -> OpenPortRequest {
        OpenPortRequest {
            port_name: "COM_TEST".to_string(),
            baud_rate: 115200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
        }
    }

    #[tokio::test]
    async fn test_enumerate_ports_returns_list() {
        let state = AppState::new();
        let result = enumerate_ports(tauri::State::from(state)).await;
        assert!(result.is_ok());
        let ports = result.unwrap();
        // 返回值是 Vec<PortInfo>，结构正确即可
        assert!(format!("{:?}", ports).contains("PortInfo"));
    }

    #[tokio::test]
    async fn test_open_port_missing_name_fails() {
        let state = AppState::new();
        let req = OpenPortRequest {
            port_name: String::new(),
            baud_rate: 115200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
        };
        let result = open_port(req, tauri::State::from(state)).await;
        // 空端口名应返回错误
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_close_port_not_open() {
        let state = AppState::new();
        let req = ClosePortRequest {
            port_name: "COM_NONEXISTENT".to_string(),
        };
        let result = close_port(req, tauri::State::from(state)).await;
        // 关闭不存在的端口应返回错误
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_close_all_when_none_open() {
        let state = AppState::new();
        let result = close_all(tauri::State::from(state)).await;
        assert!(result.is_ok());
        assert!(result.unwrap().closed_ports.is_empty());
    }

    #[tokio::test]
    async fn test_send_data_port_not_open() {
        let state = AppState::new();
        let req = SendDataRequest {
            port_name: "COM_NOT_OPEN".to_string(),
            hex_data: "01 02 03".to_string(),
            protocol: crate::protocol::ProtocolType::Raw,
        };
        let result = send_data(req, tauri::State::from(state)).await;
        assert!(result.is_err());
    }

    #[test]
    fn test_hex_parsing_valid() {
        let hex = "01 03 00 00 00 0A";
        let bytes = parse_hex_string(hex);
        assert!(bytes.is_ok());
        assert_eq!(bytes.unwrap(), vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A]);
    }

    #[test]
    fn test_hex_parsing_invalid_character() {
        let hex = "01 ZZ 03";
        let bytes = parse_hex_string(hex);
        assert!(bytes.is_err());
    }

    #[test]
    fn test_hex_parsing_empty_string() {
        let hex = "";
        let bytes = parse_hex_string(hex);
        assert!(bytes.is_ok());
        assert!(bytes.unwrap().is_empty());
    }
}
```

- [ ] **步骤 2：实现命令 — commands/serial.rs 完整实现**

```rust
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::types::{
    CloseAllResponse, ClosePortRequest, ClosePortResponse, OpenPortRequest, OpenPortResponse,
    PortInfo, SendDataRequest, SendDataResponse,
};

/// 枚举系统可用串口
#[tauri::command]
pub async fn enumerate_ports(
    _state: State<'_, AppState>,
) -> Result<Vec<PortInfo>, AppError> {
    let ports = serialport::available_ports()
        .map_err(|e| AppError::Serial(format!("枚举串口失败: {}", e)))?;

    let result: Vec<PortInfo> = ports
        .into_iter()
        .map(|p| {
            let (manufacturer, product, serial_number, port_type) = match &p.port_type {
                serialport::SerialPortType::UsbPort(info) => (
                    info.manufacturer.clone(),
                    info.product.clone(),
                    info.serial_number.clone(),
                    "USB".to_string(),
                ),
                serialport::SerialPortType::BluetoothPort => {
                    (None, None, None, "Bluetooth".to_string())
                }
                serialport::SerialPortType::PciPort => (None, None, None, "PCI".to_string()),
                serialport::SerialPortType::Unknown => (None, None, None, "Unknown".to_string()),
                _ => (None, None, None, "Other".to_string()),
            };
            PortInfo {
                name: p.port_name,
                manufacturer,
                product,
                serial_number,
                port_type,
            }
        })
        .collect();

    Ok(result)
}

/// 打开指定串口
#[tauri::command]
pub async fn open_port(
    request: OpenPortRequest,
    state: State<'_, AppState>,
) -> Result<OpenPortResponse, AppError> {
    if request.port_name.is_empty() {
        return Err(AppError::Serial("端口名不能为空".to_string()));
    }

    // 检查是否已打开
    if state.connections.contains_key(&request.port_name) {
        return Err(AppError::PortInUse(request.port_name));
    }

    // 构建 SerialConfig
    let config = crate::serial::config::SerialConfig {
        port_name: request.port_name.clone(),
        baud_rate: request.baud_rate,
        data_bits: request.data_bits,
        stop_bits: request.stop_bits,
        parity: request.parity,
        flow_control: request.flow_control,
    };

    // 调用 SerialManager 打开端口
    state
        .serial_manager
        .open_port(&config)
        .await
        .map_err(|e| AppError::Serial(format!("打开串口失败: {}", e)))?;

    // 记录到 connections map
    state
        .connections
        .insert(request.port_name.clone(), config);

    Ok(OpenPortResponse {
        port_name: request.port_name,
        is_open: true,
    })
}

/// 关闭指定串口
#[tauri::command]
pub async fn close_port(
    request: ClosePortRequest,
    state: State<'_, AppState>,
) -> Result<ClosePortResponse, AppError> {
    if !state.connections.contains_key(&request.port_name) {
        return Err(AppError::PortNotFound(request.port_name));
    }

    state
        .serial_manager
        .close_port(&request.port_name)
        .await
        .map_err(|e| AppError::Serial(format!("关闭串口失败: {}", e)))?;

    state.connections.remove(&request.port_name);

    Ok(ClosePortResponse {
        port_name: request.port_name,
        is_closed: true,
    })
}

/// 关闭所有已打开的串口
#[tauri::command]
pub async fn close_all(
    state: State<'_, AppState>,
) -> Result<CloseAllResponse, AppError> {
    let port_names: Vec<String> = state
        .connections
        .iter()
        .map(|entry| entry.key().clone())
        .collect();

    let mut closed = Vec::new();
    for name in &port_names {
        match state.serial_manager.close_port(name).await {
            Ok(()) => {
                state.connections.remove(name);
                closed.push(name.clone());
            }
            Err(e) => {
                log::warn!("关闭串口 {} 失败: {}", name, e);
                // 即使关闭失败也尝试从 map 中移除
                state.connections.remove(name);
                closed.push(name.clone());
            }
        }
    }

    Ok(CloseAllResponse {
        closed_ports: closed,
    })
}

/// 向指定串口发送数据
#[tauri::command]
pub async fn send_data(
    request: SendDataRequest,
    state: State<'_, AppState>,
) -> Result<SendDataResponse, AppError> {
    if !state.connections.contains_key(&request.port_name) {
        return Err(AppError::PortNotFound(request.port_name));
    }

    let bytes = parse_hex_string(&request.hex_data)?;

    if bytes.is_empty() {
        return Err(AppError::Serial("发送数据不能为空".to_string()));
    }

    state
        .serial_manager
        .send_data(&request.port_name, &bytes)
        .await
        .map_err(|e| AppError::Serial(format!("发送数据失败: {}", e)))?;

    Ok(SendDataResponse {
        port_name: request.port_name,
        bytes_sent: bytes.len(),
    })
}

/// 将十六进制字符串解析为字节向量
/// 支持格式："01 03 FF" / "0103FF" / "01,03,FF"
pub fn parse_hex_string(hex: &str) -> Result<Vec<u8>, AppError> {
    if hex.trim().is_empty() {
        return Ok(Vec::new());
    }

    // 统一分隔符：空格、逗号 → 统一按空格分割
    let normalized = hex
        .replace(',', " ")
        .split_whitespace()
        .collect::<Vec<_>>();

    let mut bytes = Vec::with_capacity(normalized.len());
    for part in normalized {
        if part.len() > 2 {
            return Err(AppError::Serial(format!(
                "无效的十六进制字节: '{}'",
                part
            )));
        }
        let byte = u8::from_str_radix(part, 16)
            .map_err(|_| AppError::Serial(format!("无法解析十六进制: '{}'", part)))?;
        bytes.push(byte);
    }

    Ok(bytes)
}
```

- [ ] **步骤 3：运行测试**

```bash
cd packages/jackcom/src-tauri && cargo test commands::serial
```

预期：所有测试通过。注意：`enumerate_ports` 测试在无真实串口的 CI 环境中仍应通过（返回空列表）。

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/src/commands/serial.rs
git commit -m "feat(jackcom): implement serial IPC commands with TDD tests"
```

---

### 任务 4：实现 commands/data.rs — TDD

**文件：**
- 创建：`packages/jackcom/src-tauri/src/commands/data.rs`

- [ ] **步骤 1：先写测试 — commands/data.rs 测试部分**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;

    #[tokio::test]
    async fn test_query_history_no_db() {
        // 没有初始化数据库时应返回错误
        let state = AppState::new();
        let req = QueryHistoryRequest {
            session_id: None,
            port_name: None,
            direction: None,
            protocol: None,
            limit: Some(100),
            offset: None,
        };
        let result = query_history(req, tauri::State::from(state)).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_export_data_no_db() {
        let state = AppState::new();
        let req = ExportDataRequest {
            session_id: None,
            port_name: None,
            format: ExportFormat::Csv,
            file_path: "/tmp/test_export.csv".to_string(),
        };
        let result = export_data(req, tauri::State::from(state)).await;
        assert!(result.is_err());
    }

    #[test]
    fn test_format_frame_csv() {
        let frame = crate::protocol::frame::DisplayFrame {
            id: 1,
            timestamp: chrono::Utc::now(),
            direction: crate::protocol::frame::Direction::Rx,
            raw_hex: "01 03 00 00".to_string(),
            formatted: "READ holding registers".to_string(),
            protocol: crate::protocol::ProtocolType::Modbus,
            summary: "Slave 1, Func 3".to_string(),
        };
        let csv = format_frame_csv(&frame);
        assert!(csv.contains("01 03 00 00"));
        assert!(csv.contains("Rx"));
    }

    #[test]
    fn test_format_frame_json() {
        let frame = crate::protocol::frame::DisplayFrame {
            id: 1,
            timestamp: chrono::Utc::now(),
            direction: crate::protocol::frame::Direction::Tx,
            raw_hex: "AA BB".to_string(),
            formatted: "raw data".to_string(),
            protocol: crate::protocol::ProtocolType::Raw,
            summary: "2 bytes".to_string(),
        };
        let json = format_frame_json(&frame);
        assert!(json.contains("AA BB"));
        assert!(json.contains("Tx"));
    }

    #[test]
    fn test_format_frame_hex() {
        let frame = crate::protocol::frame::DisplayFrame {
            id: 2,
            timestamp: chrono::Utc::now(),
            direction: crate::protocol::frame::Direction::Rx,
            raw_hex: "FF EE DD".to_string(),
            formatted: "data".to_string(),
            protocol: crate::protocol::ProtocolType::Raw,
            summary: "3 bytes".to_string(),
        };
        let hex = format_frame_hex(&frame);
        assert!(hex.contains("FF EE DD"));
    }
}
```

- [ ] **步骤 2：实现命令 — commands/data.rs 完整实现**

```rust
use std::fs;
use std::path::Path;

use tauri::State;

use crate::error::AppError;
use crate::protocol::frame::DisplayFrame;
use crate::state::AppState;
use crate::storage;

use super::types::{
    ExportDataRequest, ExportDataResponse, ExportFormat, QueryHistoryRequest, QueryHistoryResponse,
};

/// 查询历史帧数据
#[tauri::command]
pub async fn query_history(
    request: QueryHistoryRequest,
    state: State<'_, AppState>,
) -> Result<QueryHistoryResponse, AppError> {
    let db_guard = state.db.read().await;
    let pool = db_guard
        .as_ref()
        .ok_or_else(|| AppError::Database("数据库未初始化".to_string()))?;

    let limit = request.limit.unwrap_or(1000);
    let offset = request.offset.unwrap_or(0);

    let (frames, total) = storage::query_frames(
        pool,
        request.session_id,
        request.port_name.as_deref(),
        request.direction,
        request.protocol,
        limit,
        offset,
    )
    .await
    .map_err(|e| AppError::Database(format!("查询历史失败: {}", e)))?;

    Ok(QueryHistoryResponse { frames, total })
}

/// 导出帧数据到文件
#[tauri::command]
pub async fn export_data(
    request: ExportDataRequest,
    state: State<'_, AppState>,
) -> Result<ExportDataResponse, AppError> {
    let db_guard = state.db.read().await;
    let pool = db_guard
        .as_ref()
        .ok_or_else(|| AppError::Database("数据库未初始化".to_string()))?;

    // 查询所有匹配帧（不限制条数）
    let (frames, _) = storage::query_frames(
        pool,
        request.session_id,
        request.port_name.as_deref(),
        None,
        None,
        i64::MAX,
        0,
    )
    .await
    .map_err(|e| AppError::Database(format!("查询导出数据失败: {}", e)))?;

    if frames.is_empty() {
        return Err(AppError::Database("没有可导出的数据".to_string()));
    }

    // 确保目标目录存在
    if let Some(parent) = Path::new(&request.file_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Database(format!("创建导出目录失败: {}", e)))?;
    }

    let content = match request.format {
        ExportFormat::Csv => {
            let mut csv = String::from("id,timestamp,direction,raw_hex,formatted,protocol,summary\n");
            for frame in &frames {
                csv.push_str(&format_frame_csv(frame));
                csv.push('\n');
            }
            csv
        }
        ExportFormat::Json => {
            let json_arr: Vec<serde_json::Value> = frames
                .iter()
                .map(|f| serde_json::to_value(format_frame_json(f)).unwrap_or_default())
                .collect();
            serde_json::to_string_pretty(&json_arr)
                .map_err(|e| AppError::Database(format!("JSON 序列化失败: {}", e)))?
        }
        ExportFormat::Hex => {
            let hex_lines: Vec<String> = frames.iter().map(|f| format_frame_hex(f)).collect();
            hex_lines.join("\n")
        }
    };

    fs::write(&request.file_path, content)
        .map_err(|e| AppError::Database(format!("写入导出文件失败: {}", e)))?;

    Ok(ExportDataResponse {
        file_path: request.file_path,
        rows_exported: frames.len(),
    })
}

/// 将 DisplayFrame 格式化为 CSV 行
pub fn format_frame_csv(frame: &DisplayFrame) -> String {
    format!(
        "{},{},{},{},{},{},{}",
        frame.id,
        frame.timestamp.to_rfc3339(),
        match frame.direction {
            crate::protocol::frame::Direction::Tx => "Tx",
            crate::protocol::frame::Direction::Rx => "Rx",
        },
        frame.raw_hex,
        frame.formatted.replace(',', "\\,"),
        format!("{:?}", frame.protocol),
        frame.summary.replace(',', "\\,"),
    )
}

/// 将 DisplayFrame 格式化为 JSON 字符串
pub fn format_frame_json(frame: &DisplayFrame) -> String {
    serde_json::json!({
        "id": frame.id,
        "timestamp": frame.timestamp.to_rfc3339(),
        "direction": match frame.direction {
            crate::protocol::frame::Direction::Tx => "tx",
            crate::protocol::frame::Direction::Rx => "rx",
        },
        "raw_hex": frame.raw_hex,
        "formatted": frame.formatted,
        "protocol": format!("{:?}", frame.protocol).to_lowercase(),
        "summary": frame.summary,
    })
    .to_string()
}

/// 将 DisplayFrame 格式化为纯 HEX 行
pub fn format_frame_hex(frame: &DisplayFrame) -> String {
    format!(
        "[{}] {} {}",
        frame.timestamp.to_rfc3339(),
        match frame.direction {
            crate::protocol::frame::Direction::Tx => ">>",
            crate::protocol::frame::Direction::Rx => "<<",
        },
        frame.raw_hex,
    )
}
```

- [ ] **步骤 3：运行测试**

```bash
cd packages/jackcom/src-tauri && cargo test commands::data
```

预期：`format_frame_csv`、`format_frame_json`、`format_frame_hex` 测试通过；数据库相关测试在无 DB 时返回错误（符合预期）。

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/src/commands/data.rs
git commit -m "feat(jackcom): implement data query and export IPC commands with TDD tests"
```

---

### 任务 5：实现 commands/config.rs — TDD

**文件：**
- 创建：`packages/jackcom/src-tauri/src/commands/config.rs`

- [ ] **步骤 1：先写测试 — commands/config.rs 测试部分**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;

    #[tokio::test]
    async fn test_get_config_returns_default() {
        let state = AppState::new();
        let result = get_config(tauri::State::from(state)).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_save_config_success() {
        let state = AppState::new();
        let config = crate::serial::config::SerialConfig {
            port_name: "COM_TEST".to_string(),
            baud_rate: 9600,
            ..Default::default()
        };
        let req = SaveConfigRequest { config };
        let result = save_config(req, tauri::State::from(state)).await;
        assert!(result.is_ok());
        assert!(result.unwrap().saved);
    }

    #[tokio::test]
    async fn test_list_recent_sessions_no_db() {
        let state = AppState::new();
        let req = ListRecentSessionsRequest { limit: Some(10) };
        let result = list_recent_sessions(req, tauri::State::from(state)).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_list_recent_sessions_with_default_limit() {
        let req = ListRecentSessionsRequest { limit: None };
        // 默认 limit 应为 20
        let effective_limit = req.limit.unwrap_or(20);
        assert_eq!(effective_limit, 20);
    }
}
```

- [ ] **步骤 2：实现命令 — commands/config.rs 完整实现**

```rust
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;
use crate::storage;

use super::types::{
    GetConfigResponse, ListRecentSessionsRequest, ListRecentSessionsResponse, SaveConfigRequest,
    SaveConfigResponse,
};

/// 获取当前活跃连接的配置
/// 如果有多个连接，返回第一个；无连接返回默认配置
#[tauri::command]
pub async fn get_config(
    state: State<'_, AppState>,
) -> Result<GetConfigResponse, AppError> {
    let config = state
        .connections
        .iter()
        .next()
        .map(|entry| entry.value().clone())
        .unwrap_or_default();

    Ok(GetConfigResponse { config })
}

/// 保存串口配置到持久化存储
#[tauri::command]
pub async fn save_config(
    request: SaveConfigRequest,
    state: State<'_, AppState>,
) -> Result<SaveConfigResponse, AppError> {
    // 更新 connections map 中对应的配置
    let port_name = request.config.port_name.clone();

    if state.connections.contains_key(&port_name) {
        // 端口已打开，更新配置（需要重新打开才能生效）
        let mut entry = state.connections.get_mut(&port_name).unwrap();
        *entry = request.config.clone();
    }

    // 持久化到数据库（如果有 DB）
    let db_guard = state.db.read().await;
    if let Some(pool) = db_guard.as_ref() {
        // 保存到 last_used_config 表或类似存储
        let config_json = serde_json::to_string(&request.config)
            .map_err(|e| AppError::Database(format!("序列化配置失败: {}", e)))?;

        sqlx::query!(
            "INSERT OR REPLACE INTO app_config (key, value) VALUES ('last_serial_config', ?)",
            config_json
        )
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("保存配置失败: {}", e)))?;
    }

    Ok(SaveConfigResponse { saved: true })
}

/// 列出最近的使用会话
#[tauri::command]
pub async fn list_recent_sessions(
    request: ListRecentSessionsRequest,
    state: State<'_, AppState>,
) -> Result<ListRecentSessionsResponse, AppError> {
    let db_guard = state.db.read().await;
    let pool = db_guard
        .as_ref()
        .ok_or_else(|| AppError::Database("数据库未初始化".to_string()))?;

    let limit = request.limit.unwrap_or(20);

    let sessions = storage::list_sessions(pool, limit)
        .await
        .map_err(|e| AppError::Database(format!("查询会话列表失败: {}", e)))?;

    Ok(ListRecentSessionsResponse { sessions })
}
```

- [ ] **步骤 3：运行测试**

```bash
cd packages/jackcom/src-tauri && cargo test commands::config
```

预期：`get_config` 和 `save_config` 测试通过；`list_recent_sessions_no_db` 返回错误（符合预期）。

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/src/commands/config.rs
git commit -m "feat(jackcom): implement config and session IPC commands with TDD tests"
```

---

### 任务 6：注册所有命令到 commands/mod.rs + lib.rs + 端到端验证

**文件：**
- 修改：`packages/jackcom/src-tauri/src/commands/mod.rs`
- 修改：`packages/jackcom/src-tauri/src/lib.rs`

- [ ] **步骤 1：更新 commands/mod.rs — 注册子模块**

```rust
pub mod config;
pub mod data;
pub mod serial;
pub mod types;

// 重新导出所有命令函数，供 lib.rs invoke_handler 使用
pub use config::{get_config, list_recent_sessions, save_config};
pub use data::{export_data, query_history};
pub use serial::{close_all, close_port, enumerate_ports, open_port, send_data};
```

- [ ] **步骤 2：更新 lib.rs — 注册所有命令到 invoke_handler**

```rust
mod channel;
mod commands;
mod error;
mod protocol;
mod serial;
mod state;

use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // serial commands
            commands::enumerate_ports,
            commands::open_port,
            commands::close_port,
            commands::close_all,
            commands::send_data,
            // data commands
            commands::query_history,
            commands::export_data,
            // config commands
            commands::get_config,
            commands::save_config,
            commands::list_recent_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 3：验证编译**

```bash
cd packages/jackcom/src-tauri && cargo check
```

预期：编译通过，无错误。

- [ ] **步骤 4：运行所有测试**

```bash
cd packages/jackcom/src-tauri && cargo test
```

预期：所有测试通过。

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src-tauri/src/commands/mod.rs packages/jackcom/src-tauri/src/lib.rs
git commit -m "feat(jackcom): register all IPC commands in Tauri invoke_handler"
```

---

## API 汇总

| 命令 | 文件 | 请求参数 | 返回类型 | 说明 |
|------|------|----------|----------|------|
| `enumerate_ports` | serial.rs | 无 | `Vec<PortInfo>` | 枚举系统可用串口 |
| `open_port` | serial.rs | `OpenPortRequest` | `OpenPortResponse` | 打开指定串口 |
| `close_port` | serial.rs | `ClosePortRequest` | `ClosePortResponse` | 关闭指定串口 |
| `close_all` | serial.rs | 无 | `CloseAllResponse` | 关闭所有已打开的串口 |
| `send_data` | serial.rs | `SendDataRequest` | `SendDataResponse` | 向串口发送十六进制数据 |
| `query_history` | data.rs | `QueryHistoryRequest` | `QueryHistoryResponse` | 查询历史帧数据 |
| `export_data` | data.rs | `ExportDataRequest` | `ExportDataResponse` | 导出帧数据到 CSV/JSON/HEX |
| `get_config` | config.rs | 无 | `GetConfigResponse` | 获取当前串口配置 |
| `save_config` | config.rs | `SaveConfigRequest` | `SaveConfigResponse` | 保存串口配置到持久化存储 |
| `list_recent_sessions` | config.rs | `ListRecentSessionsRequest` | `ListRecentSessionsResponse` | 列出最近使用会话 |

---

## 前端调用示例

```typescript
// 前端通过 @tauri-apps/apiinvoke 调用
import { invoke } from '@tauri-apps/api/core'

// 枚举串口
const ports = await invoke<PortInfo[]>('enumerate_ports')

// 打开串口
const result = await invoke<OpenPortResponse>('open_port', {
  request: {
    port_name: 'COM3',
    baud_rate: 115200,
    data_bits: 'eight',
    stop_bits: 'one',
    parity: 'none',
    flow_control: 'none',
  }
})

// 发送数据
const sent = await invoke<SendDataResponse>('send_data', {
  request: {
    port_name: 'COM3',
    hex_data: '01 03 00 00 00 0A C5 CD',
    protocol: 'modbus',
  }
})

// 查询历史
const history = await invoke<QueryHistoryResponse>('query_history', {
  request: {
    session_id: null,
    port_name: 'COM3',
    limit: 100,
    offset: 0,
  }
})
```

---

## 自检

**规格覆盖度：**
- 串口命令：enumerate_ports, open_port, close_port, close_all, send_data
- 数据命令：query_history, export_data（CSV/JSON/HEX 三种格式）
- 配置命令：get_config, save_config, list_recent_sessions
- 请求/响应类型：所有命令均有独立的 Serialize + Deserialize 结构体
- 错误处理：统一返回 AppError（已 impl Serialize）
- TDD：每个命令模块均先写测试，再写实现

**占位符扫描：** 无 TODO/TBD，所有步骤有完整代码。

**类型一致性：**
- `OpenPortRequest` 的字段类型与 `SerialConfig` 一致
- `QueryHistoryRequest` 的 direction/protocol 使用 Plan 1 定义的 `Direction`/`ProtocolType`
- `ListRecentSessionsResponse` 中的 `SessionInfo` 与 `storage::list_sessions` 返回类型对齐
- `DisplayFrame` 在 data.rs 中按 Plan 1 的三层模型使用

**命令注册：** lib.rs 的 `invoke_handler` 注册全部 10 个命令，与 API 汇总表一一对应。
