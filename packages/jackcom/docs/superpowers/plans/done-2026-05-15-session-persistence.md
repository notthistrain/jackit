# 串口数据持久化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 打开串口时自动创建 session 记录，数据帧实时写入 DB，关闭串口时结束 session，使历史窗口能展示真实的会话和帧数据。

**架构：** 在 AppState 中新增 `sessions: DashMap<String, i64>` 追踪 port_name → session_id 映射。open_port 命令创建 session 并记录 ID；Tauri 事件桥接（`run_tauri_bridge`）在转发 Data 事件时同步将帧写入 DB；close_port / close_all 命令结束 session 并清理映射。

**技术栈：** Rust / Tauri / SQLx SQLite / DashMap

---

### 任务 1：AppState 添加 session 映射

**文件：**
- 修改：`packages/jackcom/src-tauri/src/state.rs`

- [ ] **步骤 1：在 AppState 中添加 sessions 字段**

在 `state.rs` 的 `AppState` 结构体中添加 `sessions: DashMap<String, i64>`，以及对应的测试构造函数初始化。

```rust
// state.rs 完整内容：
use std::sync::Arc;

use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::RwLock;

use crate::channel::BrokerHandle;
use crate::serial::config::SerialConfig;
use crate::serial::manager::SerialManager;

/// 全局应用状态
pub struct AppState {
    /// 已打开的串口连接配置（port_name → config）
    pub connections: DashMap<String, SerialConfig>,
    /// 活跃会话映射（port_name → session_id）
    pub sessions: DashMap<String, i64>,
    /// 数据库连接池
    pub db: Arc<RwLock<Option<SqlitePool>>>,
    /// 串口管理器：负责打开/关闭/发送/接收
    pub serial_manager: Arc<SerialManager>,
    /// Broker 句柄：用于发布事件
    pub broker_handle: BrokerHandle,
}

impl AppState {
    pub fn new(serial_manager: Arc<SerialManager>, broker_handle: BrokerHandle) -> Self {
        Self {
            connections: DashMap::new(),
            sessions: DashMap::new(),
            db: Arc::new(RwLock::new(None)),
            serial_manager,
            broker_handle,
        }
    }

    #[cfg(test)]
    pub fn new_test() -> Self {
        let broker_handle = BrokerHandle::new_test();
        let serial_manager = Arc::new(SerialManager::new(broker_handle.clone()));
        Self {
            connections: DashMap::new(),
            sessions: DashMap::new(),
            db: Arc::new(RwLock::new(None)),
            serial_manager,
            broker_handle,
        }
    }
}
```

- [ ] **步骤 2：运行现有测试确认无回归**

运行：`cd packages/jackcom/src-tauri && cargo test state --lib`
预期：所有现有测试通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/state.rs
git commit -m "feat(state): 添加 sessions 映射追踪活跃会话"
```

---

### 任务 2：serial 命令接入 session 生命周期

**文件：**
- 修改：`packages/jackcom/src-tauri/src/commands/serial.rs`

- [ ] **步骤 1：修改 open_port — 创建 session**

在 `open_port` 中，端口成功打开后，尝试从 DB 创建 session 并存入 `state.sessions`。DB 操作失败只记录日志，不阻断端口打开流程。

在 `serial.rs` 顶部添加 import：

```rust
use crate::storage;
```

在 `open_port` 函数中，`state.connections.insert(...)` 之后添加：

```rust
    // 创建数据库 session 记录（失败不影响端口使用）
    {
        let db_guard = state.db.read().await;
        if let Some(pool) = db_guard.as_ref() {
            let config_json = serde_json::to_string(&config).unwrap_or_default();
            match storage::create_session(pool, &request.port_name, request.baud_rate, &config_json).await {
                Ok(session_id) => {
                    log::info!("Session {} created for {}", session_id, request.port_name);
                    state.sessions.insert(request.port_name.clone(), session_id);
                }
                Err(e) => {
                    log::warn!("Failed to create session for {}: {}", request.port_name, e);
                }
            }
        }
    }
```

- [ ] **步骤 2：修改 close_port — 结束 session**

在 `close_port` 函数中，`state.connections.remove(...)` 之前添加：

```rust
    // 结束数据库 session 记录
    if let Some((_, session_id)) = state.sessions.remove(&request.port_name) {
        let db_guard = state.db.read().await;
        if let Some(pool) = db_guard.as_ref() {
            if let Err(e) = storage::end_session(pool, session_id).await {
                log::warn!("Failed to end session {} for {}: {}", session_id, request.port_name, e);
            }
        }
    }
```

- [ ] **步骤 3：修改 close_all — 结束所有 session**

在 `close_all` 函数中，`for name in &port_names` 循环内部，`state.connections.remove(name)` 之前添加：

```rust
            // 结束 session
            if let Some((_, session_id)) = state.sessions.remove(name) {
                let db_guard = state.db.read().await;
                if let Some(pool) = db_guard.as_ref() {
                    if let Err(e) = storage::end_session(pool, session_id).await {
                        log::warn!("Failed to end session {}: {}", session_id, e);
                    }
                }
            }
```

- [ ] **步骤 4：运行测试**

运行：`cd packages/jackcom/src-tauri && cargo test serial --lib`
预期：所有现有测试通过

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src-tauri/src/commands/serial.rs
git commit -m "feat(serial): open_port 创建 session，close_port 结束 session"
```

---

### 任务 3：Tauri 桥接层存储帧数据

**文件：**
- 修改：`packages/jackcom/src-tauri/src/lib.rs`

- [ ] **步骤 1：修改 run_tauri_bridge — 存储 Data 事件帧**

在 `run_tauri_bridge` 函数中，`PortEvent::Data` 分支内，在转换为 `BridgeEvent` 之后、`app_handle.emit` 之前，添加帧存储逻辑。

需要从 `app_handle.state::<AppState>()` 获取 DB 和 session 映射。

首先在文件顶部确认已有 import（无需修改）：
```rust
use state::AppState;
```

在 `run_tauri_bridge` 的 `PortEvent::Data` 分支中，替换原来的 match arm：

```rust
            PortEvent::Data { port_id, frames } => {
                let display_frames: Vec<DisplayFrame> = frames
                    .iter()
                    .map(|f| {
                        frame_id = frame_id.wrapping_add(1);
                        parsed_to_display(f, frame_id)
                    })
                    .collect();

                // 存储帧到数据库（异步、失败仅记录日志）
                let app_state = app_handle.state::<AppState>();
                if let Some(session_id) = app_state.sessions.get(port_id).map(|g| *g) {
                    let db_guard = app_state.db.read().await;
                    if let Some(pool) = db_guard.as_ref() {
                        for f in frames {
                            if let Err(e) = storage::insert_frame(
                                pool,
                                session_id,
                                &f.raw.timestamp,
                                f.raw.direction,
                                &f.raw.data,
                                f.protocol,
                                &f.formatted,
                                &format_parsed_summary(&f.parsed),
                            ).await {
                                log::warn!("Failed to store frame for session {}: {}", session_id, e);
                            }
                        }
                    }
                }

                ("port:data", serde_json::to_value(&BridgeEvent::Data {
                    port_id: port_id.clone(),
                    frames: display_frames,
                }).ok())
            }
```

- [ ] **步骤 2：运行编译检查**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：编译通过，无错误

- [ ] **步骤 3：运行全部测试**

运行：`cd packages/jackcom/src-tauri && cargo test`
预期：所有测试通过

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/src/lib.rs
git commit -m "feat(bridge): Data 事件帧数据实时写入数据库"
```
