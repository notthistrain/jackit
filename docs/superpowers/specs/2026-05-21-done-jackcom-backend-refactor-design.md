# JackCom 后端重构设计文档

> 日期：2026-05-21
> 范围：全面重写 jackcom Tauri 后端（Rust 层）
> 约束：前端零改动，所有 12 个 invoke 调用 + 5 个事件格式完全保持

---

## 1. 背景与动机

当前后端由初级 Rust 工程师编写，存在以下问题：

- **职责纠缠**：`port.rs`(339行) 混合 5 个职责，`broker.rs`(456行) 混合 3 个职责
- **God Object**：`AppState` 把所有状态塞进一个结构体
- **反模式**：`Arc<RwLock<Option<SqlitePool>>>`、公开字段、String 错误
- **嵌套地狱**：`run_tauri_bridge()` 5 层嵌套、`process_with_detection()` 4 层嵌套
- **已知 Bug**：BufferLatest 背压永远失败、AT 解析器 trim 剥夺命令名、ModbusDetector 双重缓冲
- **架构问题**：手写 broker 可用 broadcast 替代、无零拷贝、无懒计算

目标：用 Rust 零成本抽象 + Tokio async 最佳实践重写，达到生产级质量。

---

## 2. 总体架构

### 2.1 四层架构

```
Commands (Tauri 桥接层)     ← DTO 转换，零业务逻辑
   ↓
Services (业务服务层)        ← 持有 State，编排业务流程
   ↓
Core (纯逻辑层)             ← 零 I/O、零 async，可独立测试
   ↓
Infra (基础设施层)           ← I/O、外部依赖、OS 线程
```

### 2.2 目标文件结构

```
src/
  main.rs                    # 入口 (6 行)
  lib.rs                     # 模块声明 + Tauri Builder (~60 行)
  app.rs                     # 顺序初始化：log → db → event_bus → serial → 注册 state
  error.rs                   # type Result<T> = anyhow::Result<T>
  logging.rs                 # tracing init + log rotation + WorkerGuard

  commands/                  # Tauri 桥接层
    mod.rs
    serial_cmd.rs            # enumerate_ports, open_port, close_port, send_data, close_all
    data_cmd.rs              # query_history, export_data
    config_cmd.rs            # get_config, save_config, list_recent_sessions
    log_cmd.rs               # log_debug/info/warn/error
    types.rs                 # 所有 Request/Response DTO + DisplayFrame

  services/                  # 业务服务层
    mod.rs
    serial_service.rs        # (~150 行) 端口生命周期：open → 创建 PortTask, close → cancel + join
    serial_state.rs          # (~80 行) SerialState { ports, sessions } + PortEntry
    port_task.rs             # (~180 行) 单端口编排：io_thread + processor + detector
    port_processor.rs        # (~120 行) Bytes → AutoDetector → ParsedFrame → EventEmitter
    event_bus.rs             # (~60 行) tokio::broadcast 封装 + EventEmitter 工厂
    emitter.rs               # (~50 行) EventEmitter：类型安全的事件发布
    tauri_bridge.rs          # (~100 行) subscribe → 10ms batch → emit 前端事件
    db_writer.rs             # (~120 行) subscribe → 攒批 → 事务 batch INSERT
    storage_service.rs       # (~150 行) 查询 + 流式导出 + session 管理
    storage_state.rs         # (~40 行) StorageState { pool: OnceCell<SqlitePool> }
    protocol_service.rs      # (~120 行) 协议检测编排 + 置信度回退

  core/                      # 纯逻辑层
    protocol/
      mod.rs
      traits.rs              # ProtocolParser, ProtocolDetector trait
      types.rs               # ProtocolType, Detection, DetectionResult 枚举
      frame.rs               # ParsedFrame, ParsedData, OnceCell 懒计算
      detector.rs            # AutoDetector：并行检测 + best-match + 置信度回退
      error.rs               # ParseError, DetectError
      format.rs              # 格式化函数：hex, ascii, modbus, at, json
      parsers/
        mod.rs
        raw.rs               # (~60 行) Raw 帧解析
        modbus.rs            # (~200 行) Modbus RTU 解析（拆分为 decode_xxx 子函数）
        at_cmd.rs            # (~150 行) AT 命令解析（修复 trim bug）
        json.rs              # (~100 行) JSON 帧 + Array 支持
    serial/
      mod.rs
      config.rs              # SerialConfig（直接 re-export serialport 类型）
      types.rs               # PortName(newtype), SessionId(newtype), Direction
    event/
      mod.rs
      port_event.rs          # PortEvent 枚举（5 个变体，去掉 Stats）
      display_frame.rs       # DisplayFrame（字段名与前端完全一致）

  infra/                     # 基础设施层
    port_io/
      mod.rs
      io_thread.rs           # (~100 行) OS 线程：阻塞读 + 同步写通道
      bridge.rs              # (~30 行) sync→async 桥接辅助
    db/
      mod.rs
      pool.rs                # (~40 行) init_db: SQLite 连接池创建 + migration
      session_repo.rs        # (~60 行) session CRUD
      frame_repo.rs          # (~80 行) frame CRUD + 分页查询
      migration.rs           # (~20 行) migration 入口
      migrations/
        001_init.sql          # 现有 schema 保持不变
    watcher/
      mod.rs
      watcher.rs             # (~80 行) 端口热插拔检测：2s 轮询 + EventEmitter
```

---

## 3. 核心设计决策

### 3.1 状态管理：域分离

**两个 Tauri managed state**（去掉 BrokerState）：

```rust
// services/serial_state.rs
pub struct SerialState {
    ports: DashMap<PortName, PortEntry>,      // 活跃端口
    sessions: Arc<DashMap<PortName, SessionId>>,  // 端口→session 映射（与 db_writer 共享）
    emitter: EventEmitter,                     // 事件发布
}

// services/storage_state.rs
pub struct StorageState {
    pool: OnceCell<SqlitePool>,               // 初始化后不可变
}
```

**EventBus 不注册为 Tauri state**，通过 `Arc<EventBus>` 在 app.rs 中 clone 分发给各组件。

### 3.2 Serde 序列化格式契约

前端解析依赖以下 serde 属性，**必须精确保持**：

```rust
// core/event/port_event.rs
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum PortEvent {
    Data { port_id, frames, direction },  // → {"type":"data","port_id":"COM3",...}
    Opened { port_id, config },           // → {"type":"opened","port_id":"COM3",...}
    Closed { port_id, reason },           // → {"type":"closed",...}
    Error { port_id, error },             // → {"type":"error",...}
    Change { arrived, removed },          // → {"type":"change",...}
}

// core/protocol/types.rs
#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProtocolType { Raw, Modbus, AT, Json }
// → "raw", "modbus", "at", "json"

// core/protocol/frame.rs
#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
pub enum ParsedData {
    Raw { hex, ascii },              // → {"type":"raw","data":{"hex":"...","ascii":"..."}}
    Modbus(ModbusData),              // → {"type":"modbus","data":{...}}
    AT(ATData),                      // → {"type":"at","data":{...}}
    Json(serde_json::Value),         // → {"type":"json","data":{...}}
}
```

**多窗口路由**：Tauri 2 的 `app_handle.emit()` 默认发送到所有窗口（main、waveform、decoder、history）。子窗口通过各自的 `listen()` 接收事件，无需特殊处理。

### 3.3 EventEmitter：统一事件发布

```rust
// services/emitter.rs
#[derive(Clone)]
pub struct EventEmitter {
    tx: broadcast::Sender<Arc<PortEvent>>,
}

impl EventEmitter {
    pub fn emit(&self, event: PortEvent) {
        let _ = self.tx.send(Arc::new(event));
    }
    pub fn emit_data(&self, port: PortName, frames: Vec<ParsedFrame>, dir: Direction) { ... }
    pub fn emit_opened(&self, port: PortName, config: SerialConfig) { ... }
    pub fn emit_closed(&self, port: PortName, reason: CloseReason) { ... }
    pub fn emit_error(&self, port: PortName, error: String) { ... }
    pub fn emit_change(&self, arrived: Vec<PortName>, removed: Vec<PortName>) { ... }
}
```

所有需要通知前端/其他组件的组件持有 `EventEmitter` clone：
- `PortProcessor` → `emit_data()`
- `SerialService` → `emit_opened()` / `emit_closed()`
- `PortWatcher` → `emit_change()`
- `PortTask` → `emit_error()`

### 3.4 EventBus：broadcast 替代手写 broker

```rust
// services/event_bus.rs
pub struct EventBus {
    tx: broadcast::Sender<Arc<PortEvent>>,
}

impl EventBus {
    pub fn new(capacity: usize) -> Self { ... }
    pub fn emitter(&self) -> EventEmitter { ... }
    pub fn subscribe(&self) -> broadcast::Receiver<Arc<PortEvent>> { ... }
}
```

替代原来 256 行的 broker.rs。没有手动 dispatch、没有背压逻辑、没有 HashMap 遍历。

### 3.5 零拷贝数据管道

```
OS 线程 read(buf) → copy_from_slice → BytesMut → freeze() → Bytes
  → mpsc(4096) → PortProcessor → AutoDetector → ParsedFrame
  → Arc<PortEvent> → broadcast(Arc::clone) → N 个订阅者
```

关键：
- 只有一次内存拷贝（从 stack buffer 到 BytesMut）
- `Arc<PortEvent>` 分发是原子引用计数，不拷贝数据
- `ParsedFrame.raw: Bytes` 是 Arc 引用，clone 零成本
- `ParsedFrame.formatted: OnceCell<String>` 懒计算，只在序列化时触发一次

### 3.6 通道策略（混合）

| 通道 | 类型 | 原因 |
|------|------|------|
| OS线程读 → PortProcessor | `tokio::sync::mpsc(4096)<Bytes>` | bounded，防止生产者压垮消费者 |
| 写命令 → OS线程 | `std::sync::mpsc(16)<Vec<u8>>` | OS 线程是同步的，不能用 async channel |
| EventBus | `broadcast(256)<Arc<PortEvent>>` | 一对多分发，自带 lagged 处理 |
| db_writer | 从 EventBus subscribe | 不需要额外通道 |

### 3.7 写数据管道

```
前端 send_data
  → commands/serial_cmd.rs: hex 解析 → Vec<u8>
  → services/serial_service.rs: lookup PortTask → send(data)
  → services/port_task.rs: delegate → IoThread.send(data)
  → infra/port_io/io_thread.rs: write_tx.send(data)
  → OS 线程: write_rx.try_recv() → port.write_all()
```

写完成后由 `serial_service` 通过 EventEmitter 发布 TX `PortEvent::Data { direction: Tx }`。

### 3.8 错误处理

```rust
// error.rs
pub type Result<T> = anyhow::Result<T>;
```

- 全部使用 anyhow，不用 thiserror
- Tauri command 层做 `map_err(|e| e.to_string())` 转换
- 内部用 `anyhow::Context` 添加上下文

**当前代码的 AppError**：有 5 个变体（Serial/Protocol/Database/PortNotFound/PortInUse）并带自定义 `Serialize` impl。重构后统一为 anyhow string，前端不需要结构化错误类型（所有 `invoke` catch 的 error 都是 string）。

### 3.9 控制流扁平化

三个技法消除嵌套：

1. **let-else 早返回**：替代 `match Some(x) => { ... }` 嵌套
2. **select! 分支提取**：select! 体只调函数，逻辑在独立函数里
3. **迭代器链**：替代 `for { if { } else { } }`

最大嵌套深度目标：**1 层**。

---

## 4. 数据管道详细设计

### 4.1 读数据流程

```
IoThread (OS 线程)
  → 阻塞 read(buf) + 10ms timeout
  → BytesMut::copy_from_slice → freeze() → Bytes
  → data_tx.send(bytes)

PortProcessor (tokio task)
  → data_rx.recv()
  → AutoDetector::process(bytes)
  → Vec<ParsedFrame>
  → emitter.emit_data(port, frames, Rx)

tauri_bridge (tokio task)
  → event_bus.subscribe()
  → 10ms batch interval
  → 合并同端口帧
  → app_handle.emit("port:data", DisplayFrame[])
  → 前端

db_writer (tokio task)
  → event_bus.subscribe()
  → accumulate FrameRow
  → batch >= 100 或 500ms interval
  → 事务 INSERT
```

### 4.2 tauri_bridge.rs 重写

**关键：双路径序列化。** `port:data` 需要先转 `DisplayFrame` 再 emit，其他事件直接序列化 `PortEvent`。

```rust
pub fn spawn(rx, app_handle, batch_interval) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut pending: HashMap<PortName, Vec<Arc<PortEvent>>> = HashMap::new();
        let mut interval = tokio::time::interval(batch_interval);
        let mut frame_id: AtomicI64 = AtomicI64::new(0);  // 替代 wrapping_add
        loop {
            tokio::select! {
                event = rx.recv() => {
                    if !on_event(event, &mut pending, &app_handle) { break }
                }
                _ = interval.tick() => flush(&mut pending, &app_handle, &frame_id).await,
            }
        }
    })
}

fn on_event(result, pending, app) -> bool {
    let event = match result {
        Ok(e) => e,
        Err(RecvError::Lagged(n)) => { tracing::warn!("跳过 {n} 个事件"); return true; }
        Err(_) => return false,
    };
    let Some(PortEvent::Data { port_id, .. }) = event.as_ref() else {
        // 非数据事件：直接序列化 PortEvent（tagged union 格式）
        let _ = app.emit(event_name(event.as_ref()), serde_json::to_value(event.as_ref()));
        return true;
    };
    pending.entry(port_id.clone()).or_default().push(event);
    true
}

async fn flush(pending, app, frame_id) {
    if pending.is_empty() { return }
    for (_, events) in pending.drain() {
        // port:data 特殊路径：ParsedFrame → DisplayFrame 再 emit
        let display_frames: Vec<DisplayFrame> = merge_data_events(events)
            .into_iter()
            .flat_map(|ev| to_display_frames(ev, frame_id))
            .collect();
        let _ = app.emit("port:data", serde_json::json!({
            "port_id": port_id,
            "frames": display_frames,
            "direction": "rx",
        }));
    }
}

// 事件名映射：PortEvent::Opened → "port:opened" 等
fn event_name(event: &PortEvent) -> &str {
    match event {
        PortEvent::Opened(..) => "port:opened",
        PortEvent::Closed(..) => "port:closed",
        PortEvent::Error(..)  => "port:error",
        PortEvent::Change(..) => "port:change",
        PortEvent::Data(..)   => "port:data",
    }
}
```

嵌套深度：最大 1 层。每个函数 < 25 行。
`frame_id` 使用 `AtomicI64` 替代当前 `wrapping_add`，线程安全。

### 4.3 db_writer.rs

```rust
pub fn spawn(rx, pool, batch_size, flush_interval, session_lookup) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut buffer: Vec<FrameRow> = Vec::with_capacity(batch_size);
        let mut interval = tokio::time::interval(flush_interval);
        loop {
            tokio::select! {
                event = rx.recv() => {
                    if let Ok(arc) = event {
                        if let PortEvent::Data { port_id, frames, direction, .. } = arc.as_ref() {
                            let session_id = session_lookup.get(port_id);
                            buffer.extend(frames.iter().map(|f| FrameRow::new(f, session_id, direction)));
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
```

**session_id 查找**：db_writer 需要通过 `SerialState.sessions` 查找当前端口的 session_id。由于 db_writer 是独立 task，通过 `Arc<DashMap<PortName, SessionId>>` 共享引用获取（DashMap 并发安全，无需额外锁）。

错误恢复：事务失败 → `tracing::error` + 丢弃当前批次。buffer 上限 10000 条，超过后丢弃新数据并 warn。

---

## 5. 协议系统设计

### 5.1 置信度回退

```rust
struct AutoDetector {
    protocol: Option<ProtocolLock>,
    parsers: AnyParsers,           // enum dispatch
    detectors: Vec<AnyDetector>,   // 枚举变体
    buffer: BytesMut,
}

struct ProtocolLock {
    protocol: ProtocolType,
    confidence: u32,               // 成功解析次数
    fail_streak: u32,              // 连续失败次数
}
```

- 未锁定：所有检测器并行运行，**best match wins**（不再 first match wins）
- 已锁定：用锁定协议解析，成功则 `confidence++`，失败则 `fail_streak++`
- `fail_streak >= 5`：重置检测状态，用当前数据重新检测
- 端口关闭再打开：AutoDetector 重新创建，从头检测

### 5.2 检测算法改进

**问题 1：双重缓冲** — ModbusDetector 不再自维护 buffer，改为偏移量检查，消除重复拷贝。

**问题 2：检测顺序误判** — 不再 "first match wins"，改为：
1. 所有活跃检测器继续检测（不提前 break）
2. 收集所有 Matched 结果
3. 如果多个匹配 → 用 CRC/语法正确性评分，选最高分
4. 如果只有一个匹配 → 锁定
5. 全部 NeedMore → 缓冲等待

### 5.3 Modbus 解析拆分

```rust
fn parse(&self, data: &[u8]) -> Result<ParsedData> {       // ~30 行
    let (addr, func, payload) = self.validate_frame(data)?;
    if func >= 0x80 { return self.decode_exception(...) }
    match func {
        0x01..=0x04 => self.decode_read(...),
        0x05        => self.decode_single_coil(...),
        0x06        => self.decode_single_register(...),
        0x0F        => self.decode_write_coils(...),
        0x10        => self.decode_write_registers(...),
        _           => Err(ParseError::InvalidFunctionCode(func)),
    }
}
```

每个子函数可独立测试，添加新功能码只需加一行 match + 一个函数。

### 5.4 懒计算格式化

```rust
pub struct ParsedFrame {
    pub raw: Bytes,
    pub protocol: ProtocolType,
    pub parsed: ParsedData,
    formatted: OnceCell<String>,
}

impl ParsedFrame {
    pub fn formatted(&self) -> &str {
        self.formatted.get_or_init(|| self.compute_format())
    }
}
```

Raw 帧不再预分配 hex + ascii 两个 String。只在序列化时触发一次计算。

---

## 6. Rust 零成本抽象运用

### 6.1 Enum dispatch（替代 Box<dyn Trait>）

```rust
pub enum AnyDetector {
    Json(JsonDetector),
    At(AtDetector),
    Modbus(ModbusDetector),
}

impl AnyDetector {
    pub fn feed(&mut self, byte: u8) -> Detection {
        match self {
            Self::Json(d) => d.feed(byte),
            Self::At(d) => d.feed(byte),
            Self::Modbus(d) => d.feed(byte),
        }
    }
}
```

编译器将 match 优化为跳转表，零运行时开销。

### 6.2 Newtype（编译时类型安全）

```rust
pub struct PortName(String);    // 端口名
pub struct SessionId(i64);      // 会话 ID
```

防止把 port_name 传给 session_id 参数。

### 6.3 SerialConfig（直接 re-export）

不再自定义 DataBits/StopBits/Parity 枚举再映射，直接 re-export serialport 类型。

### 6.4 Generics（测试注入）

```rust
pub trait SessionStore: Send + Sync {
    async fn create_session(&self, port: &str, baud: u32) -> Result<SessionId>;
    async fn end_session(&self, id: SessionId) -> Result<()>;
}
```

生产用 `SqliteSessionStore`（static dispatch），测试用 mock（dyn dispatch）。

---

## 7. 初始化流程

```rust
// app.rs
fn build_app(app_handle: AppHandle) -> Result<(LogGuard, SerialState, StorageState)> {
    // 1. 日志初始化（guard 必须注册为 Tauri managed state 保持存活）
    let log_guard = init_logging("jackcom");

    // 2. DB 初始化（失败直接 ?，应用启动失败）
    let pool = init_db().await?;
    let storage_state = StorageState::new(pool);

    // 3. 共享 session 映射（db_writer 需要查找 session_id）
    let sessions: Arc<DashMap<PortName, SessionId>> = Arc::new(DashMap::new());

    // 4. EventBus 创建
    let event_bus = Arc::new(EventBus::new(256));

    // 5. 启动独立消费者
    spawn_tauri_bridge(event_bus.subscribe(), app_handle, Duration::from_millis(10));
    spawn_db_writer(event_bus.subscribe(), storage_state.pool(), sessions.clone(), 100, Duration::from_millis(500));
    spawn_watcher(event_bus.emitter());

    // 6. 创建 SerialState（持有 sessions Arc）
    let serial_state = SerialState::new(event_bus.emitter(), sessions);

    Ok((log_guard, serial_state, storage_state))
}

// lib.rs 注册时：
// app.manage(log_guard);
// app.manage(serial_state);
// app.manage(storage_state);
```

初始化顺序 = 依赖顺序。不用 type-state ZST，简单直接。
**日志统一**：全部使用 `tracing` 宏（`tracing::info!` / `tracing::warn!` 等），删除 `log` crate 依赖。
**session 共享**：`DashMap<PortName, SessionId>` 通过 `Arc` 共享给 db_writer，由 SerialService 在 open/close 时更新。

---

## 8. 前端兼容性保证

### 8.1 Tauri 命令（12 个 invoke 保持不变）

| 命令 | 请求参数 | 返回类型 |
|------|---------|---------|
| `enumerate_ports` | 无 | `Vec<PortInfo>` |
| `open_port` | `{ port_name, baud_rate, data_bits, stop_bits, parity, flow_control }` | `OpenPortResponse` |
| `close_port` | `{ port_name }` | `ClosePortResponse` |
| `send_data` | `{ port_name, hex_data, protocol }` | `SendDataResponse` |
| `close_all` | 无 | `CloseAllResponse` |
| `list_recent_sessions` | `{ limit }` | `ListRecentSessionsResponse` |
| `query_history` | `{ session_id, direction, protocol, limit, offset }` | `QueryHistoryResponse` |
| `export_data` | `{ session_id, format, file_path }` | `ExportDataResponse` |
| `log_debug` | `{ module, message }` | `()` (无返回值) |
| `log_info` | `{ module, message }` | `()` |
| `log_warn` | `{ module, message }` | `()` |
| `log_error` | `{ module, message }` | `()` |

另保留 `ping` 和 `get_config`/`save_config`（已注册但前端未调用）：
- `ping` → 健康检查，返回 `"pong"`
- `get_config`/`save_config` → 前端用 `localStorage`，后端保持空壳实现

**注意**：`send_data` 前端硬编码 `protocol: 'raw'`，后端保持接口但实际只有 raw 路径。

### 8.2 Tauri 事件（5 个事件保持不变）

| 事件名 | Payload | 序列化方式 |
|--------|---------|-----------|
| `port:data` | `{ port_id, frames: DisplayFrame[], direction }` | **特殊路径**：ParsedFrame → DisplayFrame 转换后 emit |
| `port:opened` | `{"type":"opened","port_id":"COM3","config":{...}}` | PortEvent tagged union 直接序列化 |
| `port:closed` | `{"type":"closed","port_id":"COM3","reason":"..."}` | PortEvent tagged union 直接序列化 |
| `port:error` | `{"type":"error","port_id":"COM3","error":"..."}` | PortEvent tagged union 直接序列化 |
| `port:change` | `{"type":"change","arrived":[...],"removed":[...]}` | PortEvent tagged union 直接序列化 |

**注意**：`port:opened`/`port:closed`/`port:error` 当前无前端 listener，但保持 emit 以备未来使用。

### 8.3 DisplayFrame 字段（完全保持）

```rust
pub struct DisplayFrame {
    pub id: i64,
    pub timestamp: DateTime<Utc>,  // ISO 8601 字符串
    pub direction: Direction,       // "tx" | "rx"
    pub protocol: ProtocolType,     // "raw" | "modbus" | "at" | "json"
    pub raw_data: String,           // hex 字符串
    pub formatted: String,          // 格式化显示文本
    pub summary: String,            // 摘要文本
}
```

字段名必须与前端 TypeScript 类型定义完全一致。

---

## 9. Session 生命周期

1. `open_port` 命令 → `serial_service` 调用 `DB::create_session()` → 返回 `SessionId`
2. `SessionId` 存入 `SerialState.sessions[PortName]`
3. 每帧数据通过 `db_writer` 写入时携带 `session_id`
4. `close_port` 命令 → `serial_service` 调用 `DB::end_session()`
5. `SerialState` 保证 port 和 session 的生命周期一致

**字段映射**：DB 中 `sessions.started_at` 在 `list_recent_sessions` 响应中映射为 `created_at`（前端期望的字段名）。`session_repo` 的 `to_session_info()` 负责此转换。

---

## 10. 数据导出（流式）

替代当前 `i64::MAX` 一次性加载：

```rust
pub async fn export_streaming(pool: &SqlitePool, query: &ExportQuery) -> Result<PathBuf> {
    let mut file = File::create(&query.file_path).await?;
    let mut offset = 0i64;
    let page_size = 1000i64;
    loop {
        // session_id = None 时导出所有会话的帧
        let rows = query_frames_paginated(pool, query.session_id, page_size, offset).await?;
        if rows.is_empty() { break }
        for row in &rows {
            file.write_all(format_row(row, query.format).as_bytes()).await?;
        }
        offset += page_size;
    }
    Ok(query.file_path.clone())
}
```

**null session_id 处理**：前端 `TitleBar` 调用 `export_data` 时传 `session_id: null`，表示导出所有会话。SQL 查询需处理 `WHERE session_id = ?`（有值）或无 WHERE（null）两种情况。

内存占用恒定（每页 1000 条），不受数据量影响。

---

## 11. 端口热插拔

**设计决策**：当前代码中 `PortWatcher` 基础设施已存在但**从未激活**（`start_watcher()` 未被调用）。重构后**正式启用**热插拔检测，作为新功能。

```rust
// infra/watcher/watcher.rs
pub fn spawn(emitter: EventEmitter) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut watcher = PortWatcher::new(Duration::from_secs(2));
        loop {
            tokio::time::sleep(watcher.interval).await;
            let change = watcher.scan_once();
            if !change.arrived.is_empty() || !change.removed.is_empty() {
                emitter.emit_change(
                    change.arrived.into_iter().map(PortName::from).collect(),
                    change.removed.into_iter().map(PortName::from).collect(),
                );
            }
        }
    })
}
```

`enumerate_ports` 命令直接调用 `serialport::available_ports()`，不经过 watcher。

---

## 12. DB 基础设施

### 12.1 Schema（保持不变）

保持现有 `sessions` + `frames` 表结构、索引、migration 不变。

### 12.2 连接池初始化

```rust
// infra/db/pool.rs
pub async fn init_db() -> Result<SqlitePool> {
    let db_path = ensure_db_path()?;   // 确保 ~/.jackit/toolbox/tools/jackcom/data/ 存在
    migrate_old_path_if_needed(&db_path)?;  // 从旧路径迁移（见下文）
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display())).await?;
    sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await?;
    run_migrations(&pool).await?;
    Ok(pool)
}
```

**PRAGMA**：`PRAGMA foreign_keys = ON` 必须在每个连接上执行（SQLite 默认关闭外键）。

### 12.3 数据库路径迁移

从旧路径 `{data_local_dir}/jackcom/jackcom.db` 迁移到新路径 `~/.jackit/toolbox/tools/jackcom/data/jackcom.db`：
- 如果新路径不存在文件且旧路径存在 → 复制文件到新路径
- 不删除旧文件（避免降级时数据丢失）
- 使用 `std::fs::copy`，不是 rename

---

## 13. 已删除/清理内容

- `PortEvent::Stats` — 当前无发送方、无前端 listener，不需要
- `stats_collector.rs` — 随 Stats 一起删除
- `BrokerState` — EventBus 通过 Arc 共享，不注册为 Tauri state
- 自定义 `DataBits`/`StopBits`/`Parity` 枚举 — 直接 re-export serialport
- `thiserror` 依赖 — 统一使用 anyhow
- `log` crate 依赖 — 统一使用 tracing（`tracing` 兼容 `log` facade，但直接用 tracing 宏更清晰）
- `uuid` 依赖 — Cargo.toml 声明了但 Rust 代码从未使用，前端用 `crypto.randomUUID()`
- `tokio_util::sync::Notify` — 当前用于 OS 线程通知 tokio，重构后由 `tokio::sync::mpsc` 替代
- `channel/backpressure.rs` — broadcast 自带 lagged 处理，不需要自定义背压

---

## 14. 量化对比

| 指标 | 当前 | 重构后 |
|------|------|--------|
| 最大文件行数 | 787 行 (storage) | ~200 行 |
| 最大函数行数 | 159 行 (modbus parse) | ~50 行 |
| 最大嵌套深度 | 5 层 | 1 层 |
| 状态管理 | 1 个 God Object | 2 个域分离 State |
| DB pool 类型 | `Arc<RwLock<Option<Pool>>>` | `OnceCell<Pool>` |
| 事件分发 | 手写 broker 256 行 | broadcast 60 行 |
| 每帧内存拷贝 | 2-3 次 | 1 次 |
| hex/ascii 计算 | 每帧必算 | OnceCell 懒计算 |
| 文件数 | ~15 个混合职责 | ~40 个单一职责 |
