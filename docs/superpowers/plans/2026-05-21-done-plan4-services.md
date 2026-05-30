# Plan 4: 服务层

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现所有业务服务——EventBus（broadcast 替代手写 broker）、EventEmitter（类型安全发布）、SerialState/SerialService（端口管理）、PortTask/PortProcessor（单端口编排）、tauri_bridge（前端桥接）、db_writer（异步 DB 写入）、StorageService（查询/导出）。

**架构：** `services/` 模块是业务核心层。EventBus 是中心枢纽，通过 `broadcast` 实现一对多分发。每个消费者（tauri_bridge、db_writer）独立订阅、独立运行、互不阻塞。SerialService 管理端口生命周期，通过 PortTask 编排 IO 线程 + 协议处理。

**技术栈：** tokio (broadcast, mpsc, select!), dashmap, chrono, sqlx

**基目录：** `packages/jackcom/src-tauri/`

**依赖关系：** 依赖 Plan 1（core 类型）+ Plan 2（协议解析器）+ Plan 3（IO 线程、DB）

---

## 文件结构

| 操作 | 文件 | 职责 | 预估行数 |
|------|------|------|---------|
| 修改 | `src/lib.rs` | 添加 `mod services;` | +1 |
| 创建 | `src/services/mod.rs` | 模块声明 | ~15 |
| 创建 | `src/services/event_bus.rs` | broadcast 封装 | ~40 |
| 创建 | `src/services/emitter.rs` | EventEmitter 类型安全发布 | ~60 |
| 创建 | `src/services/serial_state.rs` | SerialState + PortEntry | ~80 |
| 创建 | `src/services/serial_service.rs` | 端口生命周期管理 | ~150 |
| 创建 | `src/services/port_task.rs` | 单端口编排 | ~120 |
| 创建 | `src/services/port_processor.rs` | Bytes → 检测 → 发事件 | ~100 |
| 创建 | `src/services/tauri_bridge.rs` | subscribe → batch → emit | ~120 |
| 创建 | `src/services/db_writer.rs` | subscribe → 攒批 → INSERT | ~100 |
| 创建 | `src/services/storage_service.rs` | 查询 + 流式导出 | ~150 |
| 创建 | `src/services/storage_state.rs` | StorageState wrapper | ~40 |

---

### 任务 1：创建 services 模块骨架

- [ ] **步骤 1：创建目录和 mod.rs**

```bash
mkdir -p src/services
```

`src/services/mod.rs`：
```rust
pub mod event_bus;
pub mod emitter;
pub mod serial_state;
pub mod serial_service;
pub mod port_task;
pub mod port_processor;
pub mod tauri_bridge;
pub mod db_writer;
pub mod storage_service;
pub mod storage_state;
```

每个子文件先写入 `// 占位` 确保编译。

- [ ] **步骤 2：添加模块声明到 lib.rs**

在 `src/lib.rs` 添加：`mod services;`

- [ ] **步骤 3：验证编译 + Commit**

运行：`cd packages/jackcom/src-tauri && cargo check`

```bash
git add packages/jackcom/src-tauri/src/services/ packages/jackcom/src-tauri/src/lib.rs
git commit -m "feat(jackcom): 创建 services 模块骨架"
```

---

### 任务 2：EventBus + EventEmitter

**文件：**
- 修改：`src/services/event_bus.rs`
- 修改：`src/services/emitter.rs`

- [ ] **步骤 1：实现 EventBus**

`src/services/event_bus.rs`：
```rust
use std::sync::Arc;

use tokio::sync::broadcast;

use crate::core::event::port_event::PortEvent;

/// 事件总线 — tokio::broadcast 封装
///
/// 替代原来 256 行的手写 broker。60 行解决。
pub struct EventBus {
    tx: broadcast::Sender<Arc<PortEvent>>,
}

impl EventBus {
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self { tx }
    }

    pub fn emitter(&self) -> crate::services::emitter::EventEmitter {
        crate::services::emitter::EventEmitter::new(self.tx.clone())
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Arc<PortEvent>> {
        self.tx.subscribe()
    }
}
```

- [ ] **步骤 2：实现 EventEmitter**

`src/services/emitter.rs`：
```rust
use std::sync::Arc;

use tokio::sync::broadcast;

use crate::core::event::port_event::PortEvent;
use crate::core::protocol::frame::ParsedFrame;
use crate::core::serial::config::{CloseReason, SerialConfig};
use crate::core::serial::types::{Direction, PortName};

/// 类型安全的事件发布器
///
/// Clone-friendly：每个需要发布事件的组件持有一个 clone
#[derive(Clone)]
pub struct EventEmitter {
    tx: broadcast::Sender<Arc<PortEvent>>,
}

impl EventEmitter {
    pub fn new(tx: broadcast::Sender<Arc<PortEvent>>) -> Self {
        Self { tx }
    }

    pub fn emit(&self, event: PortEvent) {
        let _ = self.tx.send(Arc::new(event));
    }

    pub fn emit_data(&self, port: PortName, frames: Vec<ParsedFrame>, direction: Direction) {
        self.emit(PortEvent::Data {
            port_id: port,
            frames,
            direction,
        });
    }

    pub fn emit_opened(&self, port: PortName, config: SerialConfig) {
        self.emit(PortEvent::Opened { port_id: port, config });
    }

    pub fn emit_closed(&self, port: PortName, reason: CloseReason) {
        self.emit(PortEvent::Closed { port_id: port, reason });
    }

    pub fn emit_error(&self, port: PortName, error: String) {
        self.emit(PortEvent::Error { port_id: port, error });
    }

    pub fn emit_change(&self, arrived: Vec<PortName>, removed: Vec<PortName>) {
        self.emit(PortEvent::Change { arrived, removed });
    }
}
```

- [ ] **步骤 3：运行测试 + Commit**

运行：`cd packages/jackcom/src-tauri && cargo test --lib services`

```bash
git add packages/jackcom/src-tauri/src/services/event_bus.rs packages/jackcom/src-tauri/src/services/emitter.rs
git commit -m "feat(jackcom): 实现 EventBus + EventEmitter"
```

---

### 任务 3：SerialState + PortEntry

**文件：**
- 修改：`src/services/serial_state.rs`

- [ ] **步骤 1：实现 SerialState**

```rust
use std::sync::Arc;

use dashmap::DashMap;

use crate::core::serial::types::{PortName, SessionId};
use crate::services::emitter::EventEmitter;

/// 活跃端口条目
pub struct PortEntry {
    pub port_name: PortName,
    pub task: crate::services::port_task::PortTask,
    pub session_id: SessionId,
}

/// 串口状态管理 — 域分离（不再 God Object）
pub struct SerialState {
    pub ports: DashMap<PortName, PortEntry>,
    pub sessions: Arc<DashMap<PortName, SessionId>>,
    pub emitter: EventEmitter,
}

impl SerialState {
    pub fn new(emitter: EventEmitter, sessions: Arc<DashMap<PortName, SessionId>>) -> Self {
        Self {
            ports: DashMap::new(),
            sessions,
            emitter,
        }
    }

    pub fn is_port_open(&self, port_name: &PortName) -> bool {
        self.ports.contains_key(port_name)
    }

    pub fn open_port_names(&self) -> Vec<PortName> {
        self.ports.iter().map(|r| r.key().clone()).collect()
    }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/services/serial_state.rs
git commit -m "feat(jackcom): 实现 SerialState + PortEntry"
```

---

### 任务 4：PortProcessor — 字节流处理

**文件：**
- 修改：`src/services/port_processor.rs`

- [ ] **步骤 1：实现 PortProcessor**

```rust
use bytes::Bytes;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::core::protocol::detector::AutoDetector;
use crate::core::serial::types::{Direction, PortName};
use crate::services::emitter::EventEmitter;

/// 端口处理器：Bytes → AutoDetector → ParsedFrame → EventEmitter
pub struct PortProcessor;

impl PortProcessor {
    /// 启动处理任务
    pub fn spawn(
        port_name: PortName,
        mut data_rx: mpsc::Receiver<Bytes>,
        emitter: EventEmitter,
        cancel: CancellationToken,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut detector = AutoDetector::new();

            loop {
                tokio::select! {
                    data = data_rx.recv() => {
                        let Some(data) = data else { break };
                        let frames = detector.process(&data);
                        if !frames.is_empty() {
                            emitter.emit_data(port_name.clone(), frames, Direction::Rx);
                        }
                    }
                    _ = cancel.cancelled() => break,
                }
            }
            tracing::debug!("PortProcessor 退出: {}", port_name);
        })
    }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/services/port_processor.rs
git commit -m "feat(jackcom): 实现 PortProcessor（字节流→协议检测→事件发布）"
```

---

### 任务 5：PortTask — 单端口编排

**文件：**
- 修改：`src/services/port_task.rs`

- [ ] **步骤 1：实现 PortTask**

```rust
use bytes::Bytes;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::core::serial::types::PortName;
use crate::infra::port_io::io_thread::{IoThread, IoThreadConfig};
use crate::services::emitter::EventEmitter;
use crate::services::port_processor::PortProcessor;

/// 单端口任务编排：IoThread + PortProcessor
pub struct PortTask {
    io: IoThread,
    processor: tokio::task::JoinHandle<()>,
    cancel: CancellationToken,
}

impl PortTask {
    /// 创建并启动端口任务
    ///
    /// 1. 创建 tokio mpsc 通道
    /// 2. 启动 IoThread（OS 线程）
    /// 3. 启动 PortProcessor（tokio task）
    pub fn start(
        port: Box<dyn serialport::SerialPort>,
        port_name: PortName,
        emitter: EventEmitter,
    ) -> anyhow::Result<Self> {
        let cancel = CancellationToken::new();
        let (data_tx, data_rx) = mpsc::channel::<Bytes>(4096);

        // 启动 IO 线程
        let io = IoThread::spawn(
            port,
            data_tx,
            cancel.clone(),
            IoThreadConfig::default(),
        )?;

        // 启动 PortProcessor
        let processor = PortProcessor::spawn(
            port_name,
            data_rx,
            emitter,
            cancel.clone(),
        );

        Ok(Self { io, processor, cancel })
    }

    /// 发送数据
    pub fn send(&self, data: Vec<u8>) -> anyhow::Result<()> {
        self.io.send(data)
            .map_err(|e| anyhow::anyhow!("发送失败: {e}"))
    }

    /// 停止端口任务
    pub async fn stop(self) {
        self.cancel.cancel();
        let _ = self.processor.await;
        // IoThread 在 drop 时自动 join
    }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/services/port_task.rs
git commit -m "feat(jackcom): 实现 PortTask（IoThread + PortProcessor 编排）"
```

---

### 任务 6：SerialService — 端口生命周期管理

**文件：**
- 修改：`src/services/serial_service.rs`

- [ ] **步骤 1：实现 SerialService**

```rust
use std::sync::Arc;

use sqlx::SqlitePool;

use crate::core::serial::config::SerialConfig;
use crate::core::serial::types::{PortName, SessionId};
use crate::infra::db::session_repo;
use crate::services::serial_state::{PortEntry, SerialState};
use crate::services::port_task::PortTask;

/// 串口服务 — 端口生命周期管理
pub struct SerialService;

impl SerialService {
    /// 打开端口
    pub async fn open(
        state: &SerialState,
        pool: &SqlitePool,
        config: &SerialConfig,
    ) -> anyhow::Result<PortName> {
        let port_name = PortName::new(&config.port_name);

        if state.is_port_open(&port_name) {
            anyhow::bail!("端口已被占用: {}", port_name);
        }

        // 打开串口
        let port = serialport::new(&config.port_name, config.baud_rate)
            .data_bits(map_data_bits(config.data_bits))
            .stop_bits(map_stop_bits(config.stop_bits))
            .parity(map_parity(config.parity))
            .flow_control(map_flow_control(config.flow_control))
            .open()
            .map_err(|e| anyhow::anyhow!("打开串口失败: {e}"))?;

        // 创建 session
        let session_id = session_repo::create_session(pool, &port_name, config.baud_rate).await?;
        state.sessions.insert(port_name.clone(), session_id);

        // 启动 PortTask
        let task = PortTask::start(
            port,
            port_name.clone(),
            state.emitter.clone(),
        )?;

        // 发布 Opened 事件
        state.emitter.emit_opened(port_name.clone(), config.clone());

        // 存入状态
        state.ports.insert(port_name.clone(), PortEntry {
            port_name: port_name.clone(),
            task,
            session_id,
        });

        Ok(port_name)
    }

    /// 关闭端口
    pub async fn close(
        state: &SerialState,
        pool: &SqlitePool,
        port_name: &PortName,
    ) -> anyhow::Result<()> {
        let Some((_, entry)) = state.ports.remove(port_name) else {
            anyhow::bail!("端口不存在: {}", port_name);
        };

        // 结束 session
        session_repo::end_session(pool, entry.session_id).await?;
        state.sessions.remove(port_name);

        // 停止任务
        entry.task.stop().await;

        // 发布 Closed 事件
        state.emitter.emit_closed(
            port_name.clone(),
            crate::core::serial::config::CloseReason::Disconnected,
        );

        Ok(())
    }

    /// 关闭所有端口
    pub async fn close_all(state: &SerialState, pool: &SqlitePool) -> Vec<PortName> {
        let port_names: Vec<PortName> = state.ports.iter().map(|r| r.key().clone()).collect();
        for name in &port_names {
            let _ = Self::close(state, pool, name).await;
        }
        port_names
    }

    /// 发送数据
    pub fn send(state: &SerialState, port_name: &PortName, data: Vec<u8>) -> anyhow::Result<usize> {
        let Some(entry) = state.ports.get(port_name) else {
            anyhow::bail!("端口不存在: {}", port_name);
        };
        let len = data.len();
        entry.task.send(data)?;
        // 发布 TX 事件
        state.emitter.emit_data(
            port_name.clone(),
            vec![],
            crate::core::serial::types::Direction::Tx,
        );
        Ok(len)
    }
}

// ── 类型映射 ──

fn map_data_bits(v: crate::core::serial::config::DataBits) -> serialport::DataBits {
    match v {
        crate::core::serial::config::DataBits::Five => serialport::DataBits::Five,
        crate::core::serial::config::DataBits::Six => serialport::DataBits::Six,
        crate::core::serial::config::DataBits::Seven => serialport::DataBits::Seven,
        crate::core::serial::config::DataBits::Eight => serialport::DataBits::Eight,
    }
}

fn map_stop_bits(v: crate::core::serial::config::StopBits) -> serialport::StopBits {
    match v {
        crate::core::serial::config::StopBits::One => serialport::StopBits::One,
        crate::core::serial::config::StopBits::Two => serialport::StopBits::Two,
    }
}

fn map_parity(v: crate::core::serial::config::Parity) -> serialport::Parity {
    match v {
        crate::core::serial::config::Parity::None => serialport::Parity::None,
        crate::core::serial::config::Parity::Odd => serialport::Parity::Odd,
        crate::core::serial::config::Parity::Even => serialport::Parity::Even,
    }
}

fn map_flow_control(v: crate::core::serial::config::FlowControl) -> serialport::FlowControl {
    match v {
        crate::core::serial::config::FlowControl::None => serialport::FlowControl::None,
        crate::core::serial::config::FlowControl::Hardware => serialport::FlowControl::Hardware,
        crate::core::serial::config::FlowControl::Software => serialport::FlowControl::Software,
    }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/services/serial_service.rs
git commit -m "feat(jackcom): 实现 SerialService（端口生命周期管理）"
```

---

### 任务 7：tauri_bridge — 前端事件桥接

**文件：**
- 修改：`src/services/tauri_bridge.rs`

**设计要点：**
- 双路径序列化：port:data 转换为 DisplayFrame 后 emit，其他事件直接序列化 PortEvent
- 10ms 批量聚合
- AtomicI64 用于 frame_id

- [ ] **步骤 1：实现 tauri_bridge**

```rust
use std::collections::HashMap;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use tokio::sync::broadcast;

use crate::core::event::display_frame::DisplayFrame;
use crate::core::event::port_event::PortEvent;
use crate::core::protocol::frame::ParsedFrame;
use crate::core::serial::types::PortName;

/// 启动 Tauri 桥接任务
///
/// subscribe → 10ms batch → emit 前端事件
pub fn spawn(
    mut rx: broadcast::Receiver<Arc<PortEvent>>,
    app_handle: tauri::AppHandle,
    batch_interval: Duration,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut pending: HashMap<PortName, Vec<Arc<PortEvent>>> = HashMap::new();
        let mut interval = tokio::time::interval(batch_interval);
        let frame_id = AtomicI64::new(0);

        loop {
            tokio::select! {
                result = rx.recv() => {
                    if !on_event(result, &mut pending, &app_handle) {
                        break;
                    }
                }
                _ = interval.tick() => {
                    flush(&mut pending, &app_handle, &frame_id).await;
                }
            }
        }
    })
}

fn on_event(
    result: Result<Arc<PortEvent>, broadcast::error::RecvError>,
    pending: &mut HashMap<PortName, Vec<Arc<PortEvent>>>,
    app: &tauri::AppHandle,
) -> bool {
    let event = match result {
        Ok(e) => e,
        Err(broadcast::error::RecvError::Lagged(n)) => {
            tracing::warn!("Bridge: 跳过 {n} 个事件");
            return true;
        }
        Err(_) => return false, // channel closed
    };

    // 非数据事件：直接序列化 PortEvent 并 emit
    let Some(PortEvent::Data { port_id, .. }) = event.as_ref() else {
        let _ = app.emit(
            event_name(event.as_ref()),
            serde_json::to_value(event.as_ref()).unwrap_or_default(),
        );
        return true;
    };

    // 数据事件：缓冲等待批量刷新
    pending.entry(port_id.clone()).or_default().push(event);
    true
}

async fn flush(
    pending: &mut HashMap<PortName, Vec<Arc<PortEvent>>>,
    app: &tauri::AppHandle,
    frame_id: &AtomicI64,
) {
    if pending.is_empty() {
        return;
    }
    for (port_id, events) in pending.drain() {
        let display_frames: Vec<DisplayFrame> = events
            .iter()
            .filter_map(|ev| {
                if let PortEvent::Data { frames, direction, .. } = ev.as_ref() {
                    Some(frames.iter().map(|f| to_display_frame(f, direction.clone(), frame_id)))
                } else {
                    None
                }
            })
            .flatten()
            .collect();

        if !display_frames.is_empty() {
            let _ = app.emit(
                "port:data",
                serde_json::json!({
                    "type": "data",
                    "port_id": port_id.as_str(),
                    "frames": display_frames,
                    "direction": "rx",
                }),
            );
        }
    }
}

fn to_display_frame(
    frame: &ParsedFrame,
    direction: crate::core::serial::types::Direction,
    frame_id: &AtomicI64,
) -> DisplayFrame {
    DisplayFrame {
        id: frame_id.fetch_add(1, Ordering::Relaxed),
        timestamp: Utc::now(),
        direction,
        raw_hex: frame.raw_hex(),
        formatted: frame.formatted().to_string(),
        protocol: frame.protocol,
        summary: frame.summary(),
    }
}

fn event_name(event: &PortEvent) -> &str {
    match event {
        PortEvent::Opened(..) => "port:opened",
        PortEvent::Closed(..) => "port:closed",
        PortEvent::Error(..) => "port:error",
        PortEvent::Change(..) => "port:change",
        PortEvent::Data(..) => "port:data",
    }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/services/tauri_bridge.rs
git commit -m "feat(jackcom): 实现 tauri_bridge（双路径序列化 + 批量聚合）"
```

---

### 任务 8：db_writer — 异步 DB 写入

**文件：**
- 修改：`src/services/db_writer.rs`

- [ ] **步骤 1：实现 db_writer**

```rust
use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::broadcast;

use crate::core::event::port_event::PortEvent;
use crate::core::serial::types::{Direction, PortName, SessionId};
use crate::infra::db::frame_repo::{self, FrameRow};

/// 启动 DB 写入任务
///
/// subscribe → 攒批 → 事务 batch INSERT
pub fn spawn(
    mut rx: broadcast::Receiver<Arc<PortEvent>>,
    pool: SqlitePool,
    batch_size: usize,
    flush_interval: Duration,
    session_lookup: Arc<DashMap<PortName, SessionId>>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut buffer: Vec<FrameRow> = Vec::with_capacity(batch_size);
        let mut interval = tokio::time::interval(flush_interval);

        loop {
            tokio::select! {
                result = rx.recv() => {
                    if let Ok(arc) = result {
                        if let PortEvent::Data { port_id, frames, direction, .. } = arc.as_ref() {
                            let session_id = session_lookup.get(port_id)
                                .map(|s| *s.value());
                            for f in frames {
                                buffer.push(FrameRow::new(
                                    session_id.map(SessionId::new),
                                    &f.protocol.to_string().to_lowercase(),
                                    &f.raw_hex(),
                                    *direction,
                                    f.formatted(),
                                    &f.summary(),
                                ));
                            }
                            if buffer.len() >= batch_size {
                                flush_to_db(&pool, &buffer).await;
                                buffer.clear();
                            }
                        }
                    }
                }
                _ = interval.tick() => {
                    if !buffer.is_empty() {
                        flush_to_db(&pool, &buffer).await;
                        buffer.clear();
                    }
                }
            }
        }
    })
}

async fn flush_to_db(pool: &SqlitePool, rows: &[FrameRow]) {
    if let Err(e) = frame_repo::insert_frames_batch(pool, rows).await {
        tracing::error!("DB 写入失败 ({} 条): {e}", rows.len());
    }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/services/db_writer.rs
git commit -m "feat(jackcom): 实现 db_writer（异步攒批 DB 写入）"
```

---

### 任务 9：StorageState + StorageService

**文件：**
- 修改：`src/services/storage_state.rs`
- 修改：`src/services/storage_service.rs`

- [ ] **步骤 1：实现 StorageState**

`src/services/storage_state.rs`：
```rust
use sqlx::SqlitePool;
use std::sync::Arc;

/// 存储状态 — DB 连接池包装
pub struct StorageState {
    pool: Arc<SqlitePool>,
}

impl StorageState {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool: Arc::new(pool) }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub fn pool_arc(&self) -> Arc<SqlitePool> {
        self.pool.clone()
    }
}
```

- [ ] **步骤 2：实现 StorageService**

`src/services/storage_service.rs`：
```rust
use std::path::Path;

use anyhow::{Context, Result};
use sqlx::SqlitePool;

use crate::core::serial::types::Direction;
use crate::infra::db::frame_repo::{self, FrameQuery, FrameRecord};
use crate::infra::db::session_repo;

/// 查询历史帧
pub async fn query_history(
    pool: &SqlitePool,
    session_id: Option<i64>,
    direction: Option<Direction>,
    protocol: Option<String>,
    limit: i64,
    offset: i64,
) -> Result<(Vec<FrameRecord>, i64)> {
    let query = FrameQuery {
        session_id,
        direction: direction.map(|d| d.to_string()),
        protocol,
        limit,
        offset,
    };
    frame_repo::query_frames(pool, &query).await
}

/// 流式导出
pub async fn export_streaming(
    pool: &SqlitePool,
    session_id: Option<i64>,
    format: &str,
    file_path: &str,
) -> Result<usize> {
    use tokio::io::AsyncWriteExt;

    let mut file = tokio::fs::File::create(file_path).await
        .context("创建导出文件失败")?;
    let mut offset = 0i64;
    let page_size = 1000i64;
    let mut total = 0usize;

    loop {
        let rows = frame_repo::query_frames_paginated(pool, session_id, page_size, offset).await?;
        if rows.is_empty() { break; }
        for row in &rows {
            let line = format_row(row, format);
            file.write_all(line.as_bytes()).await?;
            file.write_all(b"\n").await?;
            total += 1;
        }
        offset += page_size;
    }
    file.flush().await?;
    Ok(total)
}

fn format_row(row: &FrameRecord, format: &str) -> String {
    let hex: String = row.raw_data.iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ");

    match format {
        "csv" => format!("{},{},{},{},{}", row.timestamp, row.direction, row.protocol, hex, row.summary),
        "json" => serde_json::json!({
            "timestamp": row.timestamp,
            "direction": row.direction,
            "protocol": row.protocol,
            "raw_data": hex,
            "summary": row.summary,
        }).to_string(),
        "hex" => hex,
        _ => hex,
    }
}

/// 查询最近会话
pub async fn list_recent_sessions(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<session_repo::SessionInfo>> {
    session_repo::list_recent_sessions(pool, limit).await
}
```

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/services/storage_state.rs packages/jackcom/src-tauri/src/services/storage_service.rs
git commit -m "feat(jackcom): 实现 StorageState + StorageService（查询/导出）"
```

---

### 任务 10：全量编译验证

- [ ] **步骤 1：cargo check**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：PASS（可能需要修复一些导入路径）

- [ ] **步骤 2：运行所有 services 测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib services`

- [ ] **步骤 3：运行全量测试**

运行：`cd packages/jackcom/src-tauri && cargo test`

---

## 自检

**1. 规格覆盖度：**
- §3.1 SerialState → ✅ 任务 3
- §3.3 EventEmitter → ✅ 任务 2
- §3.4 EventBus → ✅ 任务 2
- §4.1 读数据流程 → ✅ PortProcessor + PortTask
- §4.2 tauri_bridge → ✅ 任务 7（双路径序列化 + 10ms batch）
- §4.3 db_writer → ✅ 任务 8（session_lookup + 攒批）
- §7 初始化流程 → Plan 5（此处提供组件）
- §10 数据导出 → ✅ StorageService.export_streaming
- §9 Session 生命周期 → ✅ SerialService.open/close

**2. 占位符扫描：** 无 TODO

**3. 类型一致性：**
- `EventEmitter` 在 serial_state, port_processor, serial_service, watcher 中 clone 使用
- `SessionId` 在 serial_state.sessions 和 db_writer.session_lookup 中使用同一 DashMap
- `DisplayFrame.raw_hex` 与 Plan 1 中的定义一致
- `frame_id: AtomicI64` 在 tauri_bridge 中使用，线程安全
