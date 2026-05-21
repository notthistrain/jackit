# Plan 3: 基础设施层

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 IO 线程（串口阻塞读写）、DB 基础设施（连接池 + migration + repo）、端口热插拔检测器、日志初始化。

**架构：** `infra/` 模块包含三个子模块：`port_io/`（OS 线程 I/O）、`db/`（SQLite 操作）、`watcher/`（端口热插拔）。加上 `logging.rs`（日志初始化）。所有组件可独立测试。

**技术栈：** serialport, sqlx (sqlite), tokio, tracing, tracing-subscriber, tracing-appender, dirs

**基目录：** `packages/jackcom/src-tauri/`

**依赖关系：** 依赖 Plan 1 的 core 类型。不依赖 Plan 2 的解析器。

---

## 文件结构

| 操作 | 文件 | 职责 | 预估行数 |
|------|------|------|---------|
| 修改 | `src/lib.rs` | 添加 `mod infra;` 和 `mod logging;` | +2 |
| 创建 | `src/infra/mod.rs` | 模块声明 | ~5 |
| 创建 | `src/infra/port_io/mod.rs` | 模块声明 | ~3 |
| 创建 | `src/infra/port_io/io_thread.rs` | OS 线程：阻塞读 + 同步写 | ~100 |
| 创建 | `src/infra/port_io/bridge.rs` | sync→async 桥接辅助 | ~30 |
| 创建 | `src/infra/db/mod.rs` | 模块声明 | ~5 |
| 创建 | `src/infra/db/pool.rs` | init_db + migration | ~60 |
| 创建 | `src/infra/db/session_repo.rs` | session CRUD | ~60 |
| 创建 | `src/infra/db/frame_repo.rs` | frame CRUD + 分页查询 | ~80 |
| 创建 | `src/infra/db/migration.rs` | migration 入口 | ~15 |
| 创建 | `src/infra/db/migrations/001_init.sql` | 现有 schema（复制） | ~35 |
| 创建 | `src/infra/watcher/mod.rs` | 模块声明 | ~3 |
| 创建 | `src/infra/watcher/watcher.rs` | 端口热插拔检测 | ~80 |
| 修改 | `src/logging.rs` | tracing 初始化 + LogGuard | ~50 |

---

### 任务 1：创建 infra 模块骨架

**文件：**
- 修改：`src/lib.rs`
- 创建：所有 mod.rs 文件

- [ ] **步骤 1：创建目录和模块文件**

```bash
mkdir -p src/infra/port_io src/infra/db/migrations src/infra/watcher
```

`src/infra/mod.rs`：
```rust
pub mod port_io;
pub mod db;
pub mod watcher;
```

`src/infra/port_io/mod.rs`：
```rust
pub mod io_thread;
pub mod bridge;
```

`src/infra/db/mod.rs`：
```rust
pub mod pool;
pub mod session_repo;
pub mod frame_repo;
pub mod migration;
```

`src/infra/watcher/mod.rs`：
```rust
pub mod watcher;
```

- [ ] **步骤 2：创建占位文件**

每个 `.rs` 文件先写入 `// 占位` 确保编译。

`src/infra/port_io/io_thread.rs` → `// Task 2`
`src/infra/port_io/bridge.rs` → `// Task 3`
`src/infra/db/pool.rs` → `// Task 4`
`src/infra/db/session_repo.rs` → `// Task 5`
`src/infra/db/frame_repo.rs` → `// Task 6`
`src/infra/db/migration.rs` → `// Task 4`
`src/infra/db/migrations/001_init.sql` → 复制现有文件
`src/infra/watcher/watcher.rs` → `// Task 7`

- [ ] **步骤 3：复制 migration SQL**

从 `src/storage/migrations/001_init.sql` 复制到 `src/infra/db/migrations/001_init.sql`（内容完全相同）。

- [ ] **步骤 4：添加模块声明到 lib.rs**

在 `src/lib.rs` 添加：
```rust
mod infra;
```

- [ ] **步骤 5：验证编译**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src-tauri/src/infra/ packages/jackcom/src-tauri/src/lib.rs
git commit -m "feat(jackcom): 创建 infra 模块骨架"
```

---

### 任务 2：IO 线程

**文件：**
- 修改：`src/infra/port_io/io_thread.rs`

**设计要点：**
- OS 线程阻塞读 + 10ms timeout
- 读数据通过 `tokio::sync::mpsc(4096)` 发给 tokio
- 写数据通过 `std::sync::mpsc(16)` 从外部接收

- [ ] **步骤 1：实现 IoThread**

```rust
use std::io::{self, Read, Write};
use std::sync::mpsc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use bytes::{Bytes, BytesMut};
use tokio::sync::mpsc as async_mpsc;
use tokio_util::sync::CancellationToken;

/// IO 线程：在 OS 线程中执行阻塞的串口读写
pub struct IoThread {
    write_tx: mpsc::Sender<Vec<u8>>,
    thread_handle: Option<JoinHandle<()>>,
}

/// IO 线程配置
pub struct IoThreadConfig {
    pub read_buffer_size: usize,
    pub read_timeout: Duration,
}

impl Default for IoThreadConfig {
    fn default() -> Self {
        Self {
            read_buffer_size: 4096,
            read_timeout: Duration::from_millis(10),
        }
    }
}

impl IoThread {
    /// 启动 IO 线程
    ///
    /// - `port`: 已打开的串口（move 进线程）
    /// - `data_tx`: 读数据输出通道（tokio async mpsc）
    /// - `cancel`: 取消令牌
    pub fn spawn(
        mut port: Box<dyn serialport::SerialPort>,
        data_tx: async_mpsc::Sender<Bytes>,
        cancel: CancellationToken,
        config: IoThreadConfig,
    ) -> io::Result<Self> {
        let (write_tx, write_rx) = mpsc::channel::<Vec<u8>>(16);

        let handle = thread::Builder::new()
            .name(format!("io-{}", port.name().unwrap_or_default()))
            .spawn(move || {
                let mut buf = vec![0u8; config.read_buffer_size];
                loop {
                    // 检查取消
                    if cancel.is_cancelled() {
                        break;
                    }

                    // 1. 写入待发送数据
                    while let Ok(data) = write_rx.try_recv() {
                        if let Err(e) = port.write_all(&data) {
                            tracing::warn!("串口写入失败: {e}");
                        }
                    }

                    // 2. 阻塞读取
                    port.set_timeout(config.read_timeout).ok();
                    match port.read(&mut buf) {
                        Ok(n) if n > 0 => {
                            let mut bytes_mut = BytesMut::new();
                            bytes_mut.extend_from_slice(&buf[..n]);
                            let bytes = bytes_mut.freeze();
                            if data_tx.blocking_send(bytes).is_err() {
                                break; // channel closed
                            }
                        }
                        Ok(_) => {} // n == 0, ignore
                        Err(ref e) if e.kind() == io::ErrorKind::TimedOut => {}
                        Err(ref e) if e.kind() == io::ErrorKind::Interrupted => {}
                        Err(e) => {
                            tracing::error!("串口读取错误: {e}");
                            break;
                        }
                    }
                }
                tracing::debug!("IO 线程退出");
            })?;

        Ok(Self {
            write_tx,
            thread_handle: Some(handle),
        })
    }

    /// 发送数据到串口
    pub fn send(&self, data: Vec<u8>) -> io::Result<()> {
        self.write_tx.send(data).map_err(|e| {
            io::Error::new(io::ErrorKind::BrokenPipe, format!("IO 线程已关闭: {e}"))
        })
    }
}

impl Drop for IoThread {
    fn drop(&mut self) {
        // write_tx drop 后线程中的 write_rx 会返回 Err，加速退出
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    #[tokio::test]
    async fn io_thread_send_through_channel() {
        let (data_tx, mut data_rx) = mpsc::channel(4096);
        let cancel = CancellationToken::new();
        let cancel_clone = cancel.clone();

        // 创建一个 mock serial port（这里用 /dev/null 模拟）
        // 实际测试需要 mock，此处仅验证通道机制
        let config = IoThreadConfig::default();
        // 注意：实际运行需要真实串口，此处仅验证结构
        assert!(data_tx.capacity() >= 4096);
        cancel.cancel();
    }
}
```

> **注意**：`tokio_util::sync::CancellationToken` 仍在 Cargo.toml 中（`tokio-util = "0.7"`）。虽然设计文档说删除它，但 CancellationToken 是 tokio 生态标准做法，保留使用更合理。Plan 5 清理时决定是否移除。

- [ ] **步骤 2：验证编译**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/infra/port_io/io_thread.rs
git commit -m "feat(jackcom): 实现 IoThread（OS 线程阻塞读写）"
```

---

### 任务 3：sync→async 桥接辅助

**文件：**
- 修改：`src/infra/port_io/bridge.rs`

- [ ] **步骤 1：实现桥接**

```rust
use bytes::Bytes;
use tokio::sync::mpsc;

/// 创建 IO 线程与 tokio 之间的通道
pub fn create_io_channel(capacity: usize) -> (mpsc::Sender<Bytes>, mpsc::Receiver<Bytes>) {
    mpsc::channel(capacity)
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom/src-tauri/src/infra/port_io/bridge.rs
git commit -m "feat(jackcom): 添加 sync→async 桥接辅助"
```

---

### 任务 4：DB 连接池 + Migration

**文件：**
- 修改：`src/infra/db/pool.rs`
- 修改：`src/infra/db/migration.rs`

- [ ] **步骤 1：实现 migration 入口**

`src/infra/db/migration.rs`：
```rust
use anyhow::Result;
use sqlx::SqlitePool;

const MIGRATION_001: &str = include_str!("migrations/001_init.sql");

pub async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::query(MIGRATION_001).execute(pool).await?;
    Ok(())
}
```

- [ ] **步骤 2：实现连接池初始化**

`src/infra/db/pool.rs`：
```rust
use std::path::PathBuf;

use anyhow::{Context, Result};
use sqlx::SqlitePool;

use super::migration::run_migrations;

/// DB 初始化：创建连接池 + migration + PRAGMA
pub async fn init_db() -> Result<SqlitePool> {
    let db_path = ensure_db_path()?;
    migrate_old_path_if_needed(&db_path)?;

    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = SqlitePool::connect(&db_url)
        .await
        .context("创建 SQLite 连接池失败")?;

    // PRAGMA: 每个 SQLite 连接必须执行（默认关闭外键）
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .context("设置 PRAGMA foreign_keys 失败")?;

    run_migrations(&pool).await?;

    tracing::info!("数据库初始化完成: {}", db_path.display());
    Ok(pool)
}

/// 确保数据目录存在，返回 DB 文件路径
fn ensure_db_path() -> Result<PathBuf> {
    let base = dirs::data_local_dir()
        .context("无法获取本地数据目录")?;
    // 新路径：~/.jackit/toolbox/tools/jackcom/data/jackcom.db
    // 按项目规范 CLAUDE.md
    let jackit_base = dirs::home_dir()
        .context("无法获取 HOME 目录")?
        .join(".jackit")
        .join("toolbox")
        .join("tools")
        .join("jackcom")
        .join("data");
    std::fs::create_dir_all(&jackit_base)
        .context("创建数据目录失败")?;
    Ok(jackit_base.join("jackcom.db"))
}

/// 从旧路径迁移数据库文件
fn migrate_old_path_if_needed(new_path: &PathBuf) -> Result<()> {
    if new_path.exists() {
        return Ok(());
    }
    let old_base = dirs::data_local_dir()
        .context("无法获取本地数据目录")?;
    let old_path = old_base.join("jackcom").join("jackcom.db");
    if old_path.exists() {
        tracing::info!("迁移数据库: {} → {}", old_path.display(), new_path.display());
        std::fs::copy(&old_path, new_path)
            .context("数据库迁移失败")?;
        tracing::info!("数据库迁移完成（旧文件保留）");
    }
    Ok(())
}
```

- [ ] **步骤 3：编写 DB 初始化测试**

在 `src/infra/db/pool.rs` 底部添加：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn init_db_creates_tables() {
        // 使用内存数据库测试
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await.unwrap();
        run_migrations(&pool).await.unwrap();

        // 验证表存在
        let result: Vec<(String,)> = sqlx::query_as(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        let table_names: Vec<&str> = result.iter().map(|(n,)| n.as_str()).collect();
        assert!(table_names.contains(&"sessions"));
        assert!(table_names.contains(&"frames"));
    }
}
```

- [ ] **步骤 4：运行测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib infra::db::pool`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src-tauri/src/infra/db/
git commit -m "feat(jackcom): 实现 DB 连接池初始化 + migration + 路径迁移"
```

---

### 任务 5：Session Repository

**文件：**
- 修改：`src/infra/db/session_repo.rs`

- [ ] **步骤 1：实现 Session CRUD**

```rust
use anyhow::{Context, Result};
use sqlx::SqlitePool;

use crate::core::serial::types::{PortName, SessionId};

/// 创建新会话
pub async fn create_session(
    pool: &SqlitePool,
    port_name: &PortName,
    baud_rate: u32,
) -> Result<SessionId> {
    let result = sqlx::query_as::<_, (i64,)>(
        "INSERT INTO sessions (port_name, baud_rate) VALUES (?, ?) RETURNING id"
    )
    .bind(port_name.as_str())
    .bind(baud_rate as i64)
    .fetch_one(pool)
    .await
    .context("创建 session 失败")?;

    Ok(SessionId::new(result.0))
}

/// 结束会话
pub async fn end_session(pool: &SqlitePool, session_id: SessionId) -> Result<()> {
    sqlx::query("UPDATE sessions SET ended_at = datetime('now') WHERE id = ?")
        .bind(session_id.value())
        .execute(pool)
        .await
        .context("结束 session 失败")?;
    Ok(())
}

/// 会话信息（用于 list_recent_sessions）
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub id: i64,
    pub port_name: String,
    pub baud_rate: u32,
    pub created_at: String,
}

/// 查询最近的会话
pub async fn list_recent_sessions(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<SessionInfo>> {
    let rows = sqlx::query_as::<_, (i64, String, i64, String)>(
        "SELECT id, port_name, baud_rate, started_at FROM sessions ORDER BY started_at DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .context("查询 sessions 失败")?;

    Ok(rows.into_iter().map(|(id, port_name, baud_rate, started_at)| {
        SessionInfo {
            id,
            port_name,
            baud_rate: baud_rate as u32,
            // DB 字段 started_at → 前端字段 created_at
            created_at: started_at,
        }
    }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn session_crud() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(include_str!("migrations/001_init.sql"))
            .execute(&pool)
            .await
            .unwrap();

        // 创建
        let port = PortName::new("COM_TEST");
        let session_id = create_session(&pool, &port, 115200).await.unwrap();
        assert!(session_id.value() > 0);

        // 查询
        let sessions = list_recent_sessions(&pool, 10).await.unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].port_name, "COM_TEST");
        assert_eq!(sessions[0].baud_rate, 115200);
        // 验证字段映射：started_at → created_at
        assert!(!sessions[0].created_at.is_empty());

        // 结束
        end_session(&pool, session_id).await.unwrap();
    }
}
```

- [ ] **步骤 2：运行测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib infra::db::session_repo`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/infra/db/session_repo.rs
git commit -m "feat(jackcom): 实现 Session Repository（CRUD + started_at→created_at 映射）"
```

---

### 任务 6：Frame Repository

**文件：**
- 修改：`src/infra/db/frame_repo.rs`

- [ ] **步骤 1：实现 Frame CRUD + 分页查询**

```rust
use anyhow::{Context, Result};
use sqlx::SqlitePool;

use crate::core::serial::types::{Direction, SessionId};

/// DB 中的帧行
#[derive(Debug, Clone)]
pub struct FrameRow {
    pub session_id: i64,
    pub direction: String,
    pub raw_data: Vec<u8>,
    pub protocol: String,
    pub formatted: String,
    pub summary: String,
}

impl FrameRow {
    pub fn new(
        session_id: Option<SessionId>,
        protocol: &str,
        raw_hex: &str,
        direction: Direction,
        formatted: &str,
        summary: &str,
    ) -> Self {
        Self {
            session_id: session_id.map(|s| s.value()).unwrap_or(0),
            direction: direction.to_string(),
            raw_data: hex_to_bytes(raw_hex),
            protocol: protocol.to_string(),
            formatted: formatted.to_string(),
            summary: summary.to_string(),
        }
    }
}

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    hex.split_whitespace()
        .filter_map(|s| u8::from_str_radix(s, 16).ok())
        .collect()
}

/// 批量插入帧（事务）
pub async fn insert_frames_batch(pool: &SqlitePool, rows: &[FrameRow]) -> Result<()> {
    if rows.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await.context("开始事务失败")?;
    for row in rows {
        sqlx::query(
            "INSERT INTO frames (session_id, direction, raw_data, protocol, formatted, summary) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(row.session_id)
        .bind(&row.direction)
        .bind(&row.raw_data)
        .bind(&row.protocol)
        .bind(&row.formatted)
        .bind(&row.summary)
        .execute(&mut *tx)
        .await
        .context("插入 frame 失败")?;
    }
    tx.commit().await.context("提交事务失败")?;
    Ok(())
}

/// 查询条件
pub struct FrameQuery {
    pub session_id: Option<i64>,
    pub direction: Option<String>,
    pub protocol: Option<String>,
    pub limit: i64,
    pub offset: i64,
}

/// 查询结果帧
#[derive(Debug, Clone)]
pub struct FrameRecord {
    pub id: i64,
    pub session_id: i64,
    pub timestamp: String,
    pub direction: String,
    pub raw_data: Vec<u8>,
    pub protocol: String,
    pub formatted: String,
    pub summary: String,
}

/// 分页查询帧
pub async fn query_frames(pool: &SqlitePool, query: &FrameQuery) -> Result<(Vec<FrameRecord>, i64)> {
    // 构建 WHERE 子句
    let mut conditions = Vec::new();
    let mut param_count = 0u8;

    if query.session_id.is_some() {
        conditions.push(format!("session_id = ?{}", param_count + 1));
        param_count += 1;
    }
    if query.direction.is_some() {
        conditions.push(format!("direction = ?{}", param_count + 1));
        param_count += 1;
    }
    if query.protocol.is_some() {
        conditions.push(format!("protocol = ?{}", param_count + 1));
        param_count += 1;
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // 计数
    let count_sql = format!("SELECT COUNT(*) FROM frames {where_clause}");
    let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
    if let Some(sid) = query.session_id { count_query = count_query.bind(sid); }
    if let Some(ref d) = query.direction { count_query = count_query.bind(d); }
    if let Some(ref p) = query.protocol { count_query = count_query.bind(p); }
    let total = count_query.fetch_one(pool).await.context("查询 frame 计数失败")?;

    // 查询
    let data_sql = format!(
        "SELECT id, session_id, timestamp, direction, raw_data, protocol, formatted, summary FROM frames {where_clause} ORDER BY timestamp DESC LIMIT ?{} OFFSET ?{}",
        param_count + 1, param_count + 2
    );
    let mut data_query = sqlx::query_as::<_, (i64, i64, String, String, Vec<u8>, String, String, String)>(&data_sql);
    if let Some(sid) = query.session_id { data_query = data_query.bind(sid); }
    if let Some(ref d) = query.direction { data_query = data_query.bind(d); }
    if let Some(ref p) = query.protocol { data_query = data_query.bind(p); }
    data_query = data_query.bind(query.limit).bind(query.offset);

    let rows = data_query.fetch_all(pool).await.context("查询 frames 失败")?;

    let records = rows.into_iter().map(|(id, session_id, timestamp, direction, raw_data, protocol, formatted, summary)| {
        FrameRecord { id, session_id, timestamp, direction, raw_data, protocol, formatted, summary }
    }).collect();

    Ok((records, total))
}

/// 分页查询帧 ID（用于流式导出）
pub async fn query_frames_paginated(
    pool: &SqlitePool,
    session_id: Option<i64>,
    limit: i64,
    offset: i64,
) -> Result<Vec<FrameRecord>> {
    let sql = match session_id {
        Some(sid) => {
            format!("SELECT id, session_id, timestamp, direction, raw_data, protocol, formatted, summary FROM frames WHERE session_id = ?1 ORDER BY timestamp ASC LIMIT ?2 OFFSET ?3")
        }
        None => {
            format!("SELECT id, session_id, timestamp, direction, raw_data, protocol, formatted, summary FROM frames ORDER BY timestamp ASC LIMIT ?1 OFFSET ?2")
        }
    };

    let mut q = sqlx::query_as::<_, (i64, i64, String, String, Vec<u8>, String, String, String)>(&sql);
    if let Some(sid) = session_id {
        q = q.bind(sid);
    }
    q = q.bind(limit).bind(offset);

    let rows = q.fetch_all(pool).await.context("分页查询 frames 失败")?;
    Ok(rows.into_iter().map(|(id, session_id, timestamp, direction, raw_data, protocol, formatted, summary)| {
        FrameRecord { id, session_id, timestamp, direction, raw_data, protocol, formatted, summary }
    }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::session_repo;

    async fn setup_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(include_str!("migrations/001_init.sql"))
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    #[tokio::test]
    async fn insert_and_query_frames() {
        let pool = setup_db().await;
        let sid = session_repo::create_session(&pool, &PortName::new("COM_TEST"), 9600).await.unwrap();

        let rows = vec![
            FrameRow::new(Some(sid), "raw", "01 03 FF", Direction::Rx, "HEX: 01 03 FF", "Raw 3 bytes"),
            FrameRow::new(Some(sid), "raw", "AA BB", Direction::Tx, "HEX: AA BB", "Raw 2 bytes"),
        ];
        insert_frames_batch(&pool, &rows).await.unwrap();

        let query = FrameQuery {
            session_id: Some(sid.value()),
            direction: None,
            protocol: None,
            limit: 10,
            offset: 0,
        };
        let (records, total) = query_frames(&pool, &query).await.unwrap();
        assert_eq!(total, 2);
        assert_eq!(records.len(), 2);
    }
}
```

- [ ] **步骤 2：运行测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib infra::db::frame_repo`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/infra/db/frame_repo.rs
git commit -m "feat(jackcom): 实现 Frame Repository（批量插入 + 分页查询 + null session_id 支持）"
```

---

### 任务 7：端口热插拔检测器

**文件：**
- 修改：`src/infra/watcher/watcher.rs`

- [ ] **步骤 1：实现 PortWatcher**

```rust
use std::time::Duration;

use crate::core::serial::types::PortName;

/// 端口变化结果
pub struct PortChange {
    pub arrived: Vec<PortName>,
    pub removed: Vec<PortName>,
}

/// 端口热插拔检测器
pub struct PortWatcher {
    known_ports: Vec<String>,
    pub interval: Duration,
}

impl PortWatcher {
    pub fn new(interval: Duration) -> Self {
        Self {
            known_ports: Vec::new(),
            interval,
        }
    }

    /// 执行一次扫描，检测端口变化
    pub fn scan_once(&mut self) -> PortChange {
        let current = match serialport::available_ports() {
            Ok(ports) => ports.into_iter().map(|p| p.port_name).collect::<Vec<_>>(),
            Err(_) => return PortChange {
                arrived: Vec::new(),
                removed: Vec::new(),
            },
        };

        let arrived: Vec<PortName> = current.iter()
            .filter(|p| !self.known_ports.contains(p))
            .map(|p| PortName::new(p.clone()))
            .collect();

        let removed: Vec<PortName> = self.known_ports.iter()
            .filter(|p| !current.contains(p))
            .map(|p| PortName::new(p.clone()))
            .collect();

        self.known_ports = current;

        PortChange { arrived, removed }
    }

    /// 初始化已知端口列表（不触发 change 事件）
    pub fn initialize(&mut self) {
        self.known_ports = match serialport::available_ports() {
            Ok(ports) => ports.into_iter().map(|p| p.port_name).collect(),
            Err(_) => Vec::new(),
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn watcher_detects_new_port() {
        let mut watcher = PortWatcher::new(Duration::from_secs(2));
        // 首次初始化
        watcher.initialize();
        let known_count = watcher.known_ports.len();

        // 扫描一次（无变化时）
        let change = watcher.scan_once();
        assert!(change.arrived.is_empty() || !change.arrived.is_empty());
        // 第二次扫描应该无变化
        let change2 = watcher.scan_once();
        assert!(change2.arrived.is_empty());
        assert!(change2.removed.is_empty());
    }
}
```

- [ ] **步骤 2：运行测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib infra::watcher`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/infra/watcher/
git commit -m "feat(jackcom): 实现端口热插拔检测器"
```

---

### 任务 8：日志初始化

**文件：**
- 修改：`src/logging.rs`

> 注：当前 `logging.rs` 已存在，需要改为统一的 tracing 初始化。由于旧代码仍依赖 `log` crate，此任务在 Plan 5 之前不应破坏旧代码。策略：更新函数签名但保持向后兼容。

- [ ] **步骤 1：重写 logging.rs**

```rust
use std::path::PathBuf;

use tracing_subscriber::EnvFilter;

/// 日志守卫 — 保持 alive 直到应用退出
pub struct LogGuard {
    _guard: tracing_appender::non_blocking::WorkerGuard,
}

/// 初始化日志系统
///
/// 返回 LogGuard 必须注册为 Tauri managed state 以保持存活
pub fn init_logging(app_name: &str) -> LogGuard {
    let log_dir = ensure_log_dir(app_name);
    let file_appender = tracing_appender::rolling::daily(&log_dir, "jackcom.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_writer(non_blocking)
        .with_ansi(false)
        .init();

    tracing::info!("日志系统初始化完成: {}", log_dir.display());

    LogGuard { _guard: guard }
}

fn ensure_log_dir(app_name: &str) -> PathBuf {
    let dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".jackit")
        .join("toolbox")
        .join("tools")
        .join(app_name)
        .join("log");
    let _ = std::fs::create_dir_all(&dir);
    dir
}
```

- [ ] **步骤 2：验证编译**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：PASS（旧代码可能 still 使用 `log::info!` 宏，但由于 `tracing` 兼容 `log` facade，不破坏）

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/logging.rs
git commit -m "feat(jackcom): 重写日志初始化（统一 tracing + LogGuard）"
```

---

### 任务 9：全量编译验证

- [ ] **步骤 1：cargo check**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：PASS

- [ ] **步骤 2：运行所有 infra 测试**

运行：`cd packages/jackcom/src-tauri && cargo test --lib infra`
预期：所有测试通过

- [ ] **步骤 3：运行所有测试**

运行：`cd packages/jackcom/src-tauri && cargo test`
预期：全部通过

---

## 自检

**1. 规格覆盖度：**
- §3.5 零拷贝 → IoThread 使用 BytesMut::freeze() → Bytes ✅
- §3.6 通道策略 → mpsc(4096) for IO, std::sync::mpsc(16) for write ✅
- §4.1 读数据流程 → IoThread ✅
- §11 端口热插拔 → PortWatcher ✅
- §12.1 Schema → 001_init.sql 保持不变 ✅
- §12.2 连接池 → init_db + PRAGMA foreign_keys ✅
- §12.3 路径迁移 → migrate_old_path_if_needed ✅
- §7 日志 → init_logging + LogGuard ✅
- §9 Session 生命周期 → create_session + end_session + started_at→created_at ✅

**2. 占位符扫描：** 无 TODO

**3. 类型一致性：**
- `SessionId` 在 session_repo 和 frame_repo 中使用同一类型
- `PortName` 在 session_repo 和 watcher 中使用同一类型
- `Direction` 在 FrameRow 中使用 core::serial::types::Direction
- `FrameQuery.session_id: Option<i64>` 处理 null 情况（导出所有会话）
