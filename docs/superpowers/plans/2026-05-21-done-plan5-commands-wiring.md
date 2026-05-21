# Plan 5: 命令层 + 应用组装 + 清理

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 12+ 个 Tauri 命令（保持前端零改动）、app.rs 初始化流程、lib.rs 重写、清理旧模块、更新 Cargo.toml。这是最终整合阶段。

**架构：** Commands 层只做 DTO 转换，零业务逻辑。app.rs 按依赖顺序初始化。lib.rs 从混合初始化变为简洁的模块声明 + Tauri Builder。

**技术栈：** tauri 2, serde, chrono

**基目录：** `packages/jackcom/src-tauri/`

**依赖关系：** 依赖 Plan 1-4 的所有组件

---

## 文件结构

| 操作 | 文件 | 职责 | 预估行数 |
|------|------|------|---------|
| 创建 | `src/app.rs` | 初始化流程：log → db → event_bus → services → state | ~60 |
| 重写 | `src/lib.rs` | 模块声明 + Tauri Builder | ~80 |
| 重写 | `src/commands/mod.rs` | 命令注册 | ~30 |
| 重写 | `src/commands/types.rs` | DTO 类型 | ~130 |
| 重写 | `src/commands/serial_cmd.rs` | 5 个串口命令 | ~100 |
| 重写 | `src/commands/data_cmd.rs` | 2 个数据命令 | ~80 |
| 重写 | `src/commands/config_cmd.rs` | 3 个配置命令 | ~40 |
| 重写 | `src/commands/log_cmd.rs` | 4 个日志命令 | ~40 |
| 修改 | `src/main.rs` | 无需改动（已是 5 行） | 0 |
| 修改 | `Cargo.toml` | 移除 thiserror, uuid, log, 可选移除 tokio-util | -4 |
| 删除 | `src/channel/` | 整个目录（被 event_bus 替代） | -256 |
| 删除 | `src/serial/` | 整个目录（被 core/serial + services/ 替代） | -339 |
| 删除 | `src/storage/` | 整个目录（被 infra/db 替代） | -787 |
| 删除 | `src/protocol/` | 整个目录（被 core/protocol 替代） | -668 |
| 删除 | `src/state.rs` | 被 serial_state + storage_state 替代 | - |
| 删除 | `src/error.rs` | 重写为 anyhow Result type | -24 |

---

### 任务 1：重写 commands/types.rs — DTO 类型

**文件：**
- 重写：`src/commands/types.rs`

> 字段名必须与当前前端 TypeScript 类型定义完全一致。

- [ ] **步骤 1：重写 DTO 类型**

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::core::protocol::types::ProtocolType;
use crate::core::serial::config::{DataBits, FlowControl, Parity, StopBits};
use crate::core::serial::types::Direction;

// ── 枚举端口 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub name: String,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
    pub port_type: String,
}

// ── 打开端口 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPortRequest {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub stop_bits: StopBits,
    pub parity: Parity,
    pub flow_control: FlowControl,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPortResponse {
    pub port_name: String,
    pub is_open: bool,
}

// ── 关闭端口 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosePortRequest {
    pub port_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosePortResponse {
    pub port_name: String,
    pub is_closed: bool,
}

// ── 关闭所有端口 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseAllResponse {
    pub closed_ports: Vec<String>,
}

// ── 发送数据 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendDataRequest {
    pub port_name: String,
    pub hex_data: String,
    pub protocol: ProtocolType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendDataResponse {
    pub port_name: String,
    pub bytes_sent: usize,
}

// ── 查询历史 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryRequest {
    pub session_id: Option<i64>,
    pub direction: Option<Direction>,
    pub protocol: Option<ProtocolType>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryResponse {
    pub frames: Vec<crate::core::event::display_frame::DisplayFrame>,
    pub total: i64,
}

// ── 导出数据 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDataRequest {
    pub session_id: Option<i64>,
    pub format: ExportFormat,
    pub file_path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
    Hex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDataResponse {
    pub file_path: String,
    pub rows_exported: usize,
}

// ── 配置 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetConfigResponse {
    pub config: crate::core::serial::config::SerialConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveConfigRequest {
    pub config: crate::core::serial::config::SerialConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveConfigResponse {
    pub saved: bool,
}

// ── 最近会话 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRecentSessionsRequest {
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: i64,
    pub port_name: String,
    pub baud_rate: u32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRecentSessionsResponse {
    pub sessions: Vec<SessionInfo>,
}
```

- [ ] **步骤 2：验证编译 + Commit**

运行：`cd packages/jackcom/src-tauri && cargo check`

```bash
git add packages/jackcom/src-tauri/src/commands/types.rs
git commit -m "feat(jackcom): 重写 commands/types.rs（新 DTO，前端兼容）"
```

---

### 任务 2：重写 commands/serial_cmd.rs

**文件：**
- 重写：`src/commands/serial_cmd.rs`

- [ ] **步骤 1：实现 5 个串口命令**

```rust
use tauri::State;

use crate::core::serial::config::SerialConfig;
use crate::core::serial::types::PortName;
use crate::services::serial_service::SerialService;
use crate::services::serial_state::SerialState;
use crate::services::storage_state::StorageState;
use crate::commands::types::*;

#[tauri::command]
pub fn enumerate_ports() -> Result<Vec<PortInfo>, String> {
    let ports = serialport::available_ports()
        .map_err(|e| format!("枚举端口失败: {e}"))?;
    Ok(ports.into_iter().map(|p| PortInfo {
        name: p.port_name,
        manufacturer: p.manufacturer,
        product: p.product,
        serial_number: p.serial_number,
        port_type: format!("{:?}", p.port_type),
    }).collect())
}

#[tauri::command]
pub async fn open_port(
    request: OpenPortRequest,
    serial_state: State<'_, SerialState>,
    storage_state: State<'_, StorageState>,
) -> Result<OpenPortResponse, String> {
    let config = SerialConfig {
        port_name: request.port_name.clone(),
        baud_rate: request.baud_rate,
        data_bits: request.data_bits,
        stop_bits: request.stop_bits,
        parity: request.parity,
        flow_control: request.flow_control,
    };
    SerialService::open(&serial_state, storage_state.pool(), &config)
        .await
        .map(|_| OpenPortResponse {
            port_name: request.port_name,
            is_open: true,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_port(
    request: ClosePortRequest,
    serial_state: State<'_, SerialState>,
    storage_state: State<'_, StorageState>,
) -> Result<ClosePortResponse, String> {
    let port_name = PortName::new(&request.port_name);
    SerialService::close(&serial_state, storage_state.pool(), &port_name)
        .await
        .map(|_| ClosePortResponse {
            port_name: request.port_name,
            is_closed: true,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn send_data(
    request: SendDataRequest,
    serial_state: State<'_, SerialState>,
) -> Result<SendDataResponse, String> {
    let port_name = PortName::new(&request.port_name);
    let data = hex_to_bytes(&request.hex_data)
        .map_err(|e| format!("十六进制解析失败: {e}"))?;
    let bytes_sent = SerialService::send(&serial_state, &port_name, data)
        .map_err(|e| e.to_string())?;
    Ok(SendDataResponse {
        port_name: request.port_name,
        bytes_sent,
    })
}

#[tauri::command]
pub async fn close_all(
    serial_state: State<'_, SerialState>,
    storage_state: State<'_, StorageState>,
) -> Result<CloseAllResponse, String> {
    let closed = SerialService::close_all(&serial_state, storage_state.pool()).await;
    Ok(CloseAllResponse {
        closed_ports: closed.into_iter().map(|p| p.to_string()).collect(),
    })
}

fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    hex.split_whitespace()
        .map(|s| u8::from_str_radix(s, 16).map_err(|e| format!("{s}: {e}")))
        .collect()
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/commands/serial_cmd.rs
git commit -m "feat(jackcom): 重写 serial_cmd（5 个串口命令）"
```

---

### 任务 3：重写 commands/data_cmd.rs + config_cmd.rs + log_cmd.rs

- [ ] **步骤 1：实现 data_cmd.rs**

```rust
use tauri::State;
use crate::services::storage_service;
use crate::services::storage_state::StorageState;
use crate::commands::types::*;

#[tauri::command]
pub async fn query_history(
    request: QueryHistoryRequest,
    storage_state: State<'_, StorageState>,
) -> Result<QueryHistoryResponse, String> {
    let (records, total) = storage_service::query_history(
        storage_state.pool(),
        request.session_id,
        request.direction,
        request.protocol.map(|p| p.to_string().to_lowercase()),
        request.limit.unwrap_or(100),
        request.offset.unwrap_or(0),
    )
    .await
    .map_err(|e| e.to_string())?;

    let frames = records.into_iter().map(|r| {
        crate::core::event::display_frame::DisplayFrame {
            id: r.id,
            timestamp: chrono::DateTime::parse_from_rfc3339(&r.timestamp)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now()),
            direction: match r.direction.as_str() {
                "tx" => crate::core::serial::types::Direction::Tx,
                _ => crate::core::serial::types::Direction::Rx,
            },
            raw_hex: r.raw_data.iter()
                .map(|b| format!("{:02X}", b))
                .collect::<Vec<_>>()
                .join(" "),
            formatted: r.formatted,
            protocol: match r.protocol.as_str() {
                "modbus" => crate::core::protocol::types::ProtocolType::Modbus,
                "at" => crate::core::protocol::types::ProtocolType::AT,
                "json" => crate::core::protocol::types::ProtocolType::Json,
                _ => crate::core::protocol::types::ProtocolType::Raw,
            },
            summary: r.summary,
        }
    }).collect();

    Ok(QueryHistoryResponse { frames, total })
}

#[tauri::command]
pub async fn export_data(
    request: ExportDataRequest,
    storage_state: State<'_, StorageState>,
) -> Result<ExportDataResponse, String> {
    let format_str = match request.format {
        ExportFormat::Csv => "csv",
        ExportFormat::Json => "json",
        ExportFormat::Hex => "hex",
    };
    let rows = storage_service::export_streaming(
        storage_state.pool(),
        request.session_id,
        format_str,
        &request.file_path,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(ExportDataResponse {
        file_path: request.file_path,
        rows_exported: rows,
    })
}
```

- [ ] **步骤 2：实现 config_cmd.rs**

```rust
use crate::core::serial::config::SerialConfig;
use crate::commands::types::*;

#[tauri::command]
pub fn get_config() -> Result<GetConfigResponse, String> {
    // 前端使用 localStorage，后端保持空壳
    Ok(GetConfigResponse {
        config: SerialConfig::default(),
    })
}

#[tauri::command]
pub fn save_config(request: SaveConfigRequest) -> Result<SaveConfigResponse, String> {
    // 前端使用 localStorage，后端保持空壳
    Ok(SaveConfigResponse { saved: true })
}

#[tauri::command]
pub async fn list_recent_sessions(
    request: ListRecentSessionsRequest,
    storage_state: tauri::State<'_, crate::services::storage_state::StorageState>,
) -> Result<ListRecentSessionsResponse, String> {
    let sessions = crate::services::storage_service::list_recent_sessions(
        storage_state.pool(),
        request.limit.unwrap_or(20),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(ListRecentSessionsResponse {
        sessions: sessions.into_iter().map(|s| SessionInfo {
            id: s.id,
            port_name: s.port_name,
            baud_rate: s.baud_rate,
            created_at: s.created_at,
        }).collect(),
    })
}
```

- [ ] **步骤 3：实现 log_cmd.rs**

```rust
use std::sync::Arc;

#[tauri::command]
pub fn log_debug(module: String, message: String) {
    tracing::debug!("[前端:{module}] {message}");
}

#[tauri::command]
pub fn log_info(module: String, message: String) {
    tracing::info!("[前端:{module}] {message}");
}

#[tauri::command]
pub fn log_warn(module: String, message: String) {
    tracing::warn!("[前端:{module}] {message}");
}

#[tauri::command]
pub fn log_error(module: String, message: String) {
    tracing::error!("[前端:{module}] {message}");
}
```

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/src/commands/
git commit -m "feat(jackcom): 重写所有 Tauri 命令（data/config/log）"
```

---

### 任务 4：重写 commands/mod.rs — 命令注册

- [ ] **步骤 1：更新命令注册**

```rust
pub mod types;
pub mod serial_cmd;
pub mod data_cmd;
pub mod config_cmd;
pub mod log_cmd;
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/commands/mod.rs
git commit -m "feat(jackcom): 更新命令模块声明"
```

---

### 任务 5：创建 app.rs — 初始化流程

**文件：**
- 创建：`src/app.rs`

- [ ] **步骤 1：实现 app 初始化**

```rust
use std::sync::Arc;
use std::time::Duration;

use crate::logging::{self, LogGuard};
use crate::services::event_bus::EventBus;
use crate::services::serial_state::SerialState;
use crate::services::storage_state::StorageState;
use crate::infra::db::pool;
use crate::infra::watcher::watcher::PortWatcher;

/// 构建 App — 按依赖顺序初始化
///
/// 返回 (LogGuard, SerialState, StorageState)
/// LogGuard 必须注册为 Tauri managed state 保持存活
pub async fn build_app(app_handle: tauri::AppHandle) -> anyhow::Result<(LogGuard, SerialState, StorageState)> {
    // 1. 日志（guard 必须在 main 作用域存活）
    let log_guard = logging::init_logging("jackcom");

    // 2. DB（失败 → 应用启动失败）
    let db_pool = pool::init_db().await?;
    let storage_state = StorageState::new(db_pool);

    // 3. 共享 session 映射（SerialState 和 db_writer 都需要）
    let sessions = Arc::new(dashmap::DashMap::new());

    // 4. EventBus — 核心枢纽
    let event_bus = Arc::new(EventBus::new(256));

    // 5. 启动独立消费者
    crate::services::tauri_bridge::spawn(
        event_bus.subscribe(),
        app_handle,
        Duration::from_millis(10),
    );
    crate::services::db_writer::spawn(
        event_bus.subscribe(),
        storage_state.pool().clone(),
        100,
        Duration::from_millis(500),
        sessions.clone(),
    );

    // 6. 启动端口热插拔检测
    spawn_watcher(event_bus.emitter());

    // 7. SerialState
    let serial_state = SerialState::new(event_bus.emitter(), sessions);

    Ok((log_guard, serial_state, storage_state))
}

fn spawn_watcher(emitter: crate::services::emitter::EventEmitter) {
    tokio::spawn(async move {
        let mut watcher = PortWatcher::new(Duration::from_secs(2));
        watcher.initialize();
        loop {
            tokio::time::sleep(Duration::from_secs(2)).await;
            let change = watcher.scan_once();
            if !change.arrived.is_empty() || !change.removed.is_empty() {
                emitter.emit_change(change.arrived, change.removed);
            }
        }
    });
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/app.rs
git commit -m "feat(jackcom): 创建 app.rs（初始化流程 + watcher 启动）"
```

---

### 任务 6：重写 lib.rs — 最终组装

**文件：**
- 重写：`src/lib.rs`

- [ ] **步骤 1：重写 lib.rs**

```rust
mod app;
mod commands;
mod core;
mod error;
mod infra;
mod logging;
mod services;

use commands::{serial_cmd, data_cmd, config_cmd, log_cmd};

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

pub async fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async {
                let (log_guard, serial_state, storage_state) =
                    app::build_app(app_handle).await
                    .expect("应用初始化失败");

                app.manage(log_guard);
                app.manage(serial_state);
                app.manage(storage_state);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            // 串口命令
            serial_cmd::enumerate_ports,
            serial_cmd::open_port,
            serial_cmd::close_port,
            serial_cmd::send_data,
            serial_cmd::close_all,
            // 数据命令
            data_cmd::query_history,
            data_cmd::export_data,
            // 配置命令
            config_cmd::get_config,
            config_cmd::save_config,
            config_cmd::list_recent_sessions,
            // 日志命令
            log_cmd::log_debug,
            log_cmd::log_info,
            log_cmd::log_warn,
            log_cmd::log_error,
        ])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用失败");
}
```

- [ ] **步骤 2：重写 error.rs**

```rust
pub type Result<T> = anyhow::Result<T>;
```

- [ ] **步骤 3：验证编译**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：此时可能有旧模块冲突，需要在下一步清理。

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/src/lib.rs packages/jackcom/src-tauri/src/error.rs
git commit -m "feat(jackcom): 重写 lib.rs（新模块声明 + Tauri Builder）"
```

---

### 任务 7：清理旧模块

**文件：**
- 删除：`src/channel/`
- 删除：`src/serial/`
- 删除：`src/storage/`
- 删除：`src/protocol/`
- 删除：`src/state.rs`

- [ ] **步骤 1：删除旧模块**

```bash
cd packages/jackcom/src-tauri/src
rm -rf channel/ serial/ storage/ protocol/ state.rs
```

- [ ] **步骤 2：验证编译**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：PASS（无旧代码残留引用）

- [ ] **步骤 3：Commit**

```bash
git add -A packages/jackcom/src-tauri/src/
git commit -m "refactor(jackcom): 删除旧模块（channel/serial/storage/protocol/state）"
```

---

### 任务 8：更新 Cargo.toml — 移除无用依赖

- [ ] **步骤 1：移除依赖**

在 `packages/jackcom/src-tauri/Cargo.toml` 的 `[dependencies]` 中移除：

| 移除 | 原因 |
|------|------|
| `thiserror = "2"` | 统一使用 anyhow |
| `uuid = "1"` | Rust 代码未使用 |
| `log = "0.4"` | 统一使用 tracing |

保留 `tokio-util`（CancellationToken 仍在使用）。

- [ ] **步骤 2：更新旧集成测试**

旧的 `tests/channel_broker_integration.rs` 引用已删除的模块。需要删除或替换：

```bash
rm packages/jackcom/src-tauri/tests/channel_broker_integration.rs
```

- [ ] **步骤 3：验证编译 + 测试**

运行：`cd packages/jackcom/src-tauri && cargo check && cargo test`
预期：编译通过，测试通过

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/Cargo.toml packages/jackcom/src-tauri/tests/
git commit -m "refactor(jackcom): 清理依赖（移除 thiserror/uuid/log）+ 删除旧测试"
```

---

### 任务 9：最终验证

- [ ] **步骤 1：cargo build**

运行：`cd packages/jackcom/src-tauri && cargo build`
预期：成功编译

- [ ] **步骤 2：cargo test**

运行：`cd packages/jackcom/src-tauri && cargo test`
预期：所有测试通过

- [ ] **步骤 3：cargo clippy**

运行：`cd packages/jackcom/src-tauri && cargo clippy -- -D warnings`
预期：无 warning（如有，修复后重新 commit）

- [ ] **步骤 4：验证前端兼容性**

确认以下内容未改变：
1. 12 个 invoke 命令名不变
2. 请求参数字段名不变（对比 `commands/types.rs` 与旧版）
3. 5 个事件名不变（`port:data`, `port:opened`, `port:closed`, `port:error`, `port:change`）
4. DisplayFrame 字段名不变（`raw_hex` 而非 `raw_data`）
5. Serde 序列化格式不变（tagged union, lowercase enum）

- [ ] **步骤 5：最终 Commit**

```bash
git add -A packages/jackcom/src-tauri/
git commit -m "refactor(jackcom): 后端重构完成 — 全部清理"
```

---

## 自检

**1. 规格覆盖度（逐条检查）：**

| 规格章节 | 是否覆盖 |
|----------|---------|
| §1 背景与动机 | ✅ 所有旧问题已解决 |
| §2 总体架构 | ✅ 四层架构：Commands → Services → Core → Infra |
| §3.1 SerialState | ✅ 任务 3 (Plan 4) |
| §3.2 Serde 契约 | ✅ Plan 1 + Plan 5 验证 |
| §3.3 EventEmitter | ✅ Plan 4 任务 2 |
| §3.4 EventBus | ✅ Plan 4 任务 2 |
| §3.5 零拷贝 | ✅ BytesMut::freeze + Arc + OnceLock |
| §3.6 通道策略 | ✅ Plan 3 IO + Plan 4 services |
| §3.7 写数据管道 | ✅ SerialService.send → PortTask.send → IoThread.send |
| §3.8 错误处理 | ✅ anyhow 统一 |
| §3.9 控制流扁平化 | ✅ tauri_bridge/on_event/flush 最大 1 层 |
| §4.1 读数据流程 | ✅ IoThread → PortProcessor → EventBus → Bridge/DB |
| §4.2 tauri_bridge | ✅ 双路径序列化 + 10ms batch |
| §4.3 db_writer | ✅ session_lookup + 攒批 + 事务 |
| §5.1 置信度回退 | ✅ Plan 2 任务 7 |
| §5.2 检测算法 | ✅ best match + CRC 优先 |
| §5.3 Modbus 拆分 | ✅ Plan 2 任务 2 |
| §5.4 懒计算 | ✅ OnceLock in ParsedFrame |
| §6.1 Enum dispatch | ✅ AnyParser + AnyDetector |
| §6.2 Newtype | ✅ PortName + SessionId |
| §6.3 SerialConfig | ✅ 保留自定义枚举（前端兼容） |
| §7 初始化流程 | ✅ app.rs |
| §8.1 12 个命令 | ✅ 任务 2-4 |
| §8.2 5 个事件 | ✅ tauri_bridge |
| §8.3 DisplayFrame | ✅ raw_hex 字段名 |
| §9 Session 生命周期 | ✅ open→create, close→end |
| §10 数据导出 | ✅ 流式导出 + null session_id |
| §11 端口热插拔 | ✅ PortWatcher 正式启用 |
| §12 DB 基础设施 | ✅ pool + migration + path migration + PRAGMA |
| §13 清理内容 | ✅ 任务 7-8 |

**2. 占位符扫描：** 无 TODO/待定

**3. 类型一致性：**
- `PortName` 贯穿 commands → services → core
- `SessionId` 在 SerialState.sessions + db_writer.session_lookup 一致
- `Direction` 在 ParsedFrame/PortEvent/DisplayFrame/FrameRow 一致
- `DisplayFrame.raw_hex` 与前端一致
- `ProtocolType` serde 格式（lowercase）贯穿
- `ParsedData` serde 格式（tag="type", content="data"）贯穿
