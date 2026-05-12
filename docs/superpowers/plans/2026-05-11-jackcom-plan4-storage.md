# Plan 4: JackCom Storage 异步持久化层

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** TDD 实现 sqlx + SQLite 异步存储，支持会话管理和历史帧查询

**前置依赖：**
- `protocol/frame.rs`: RawFrame, ParsedFrame, DisplayFrame, Direction, bytes_to_hex()
- `protocol/mod.rs`: ProtocolType
- `serial/config.rs`: SerialConfig
- `channel/mod.rs`: PortEvent (Plan 3)
- `state.rs`: AppState (db: Arc<RwLock<Option<SqlitePool>>>)

**架构：** SQLite 数据库，文件存储在 app data 目录（使用 dirs crate）。migrations/001_init.sql 建表。sessions 表记录会话，frames 表记录收发帧。提供 CRUD + 分页查询。使用 sqlx::SqlitePool + sqlx::query!

**技术栈：** sqlx 0.8 (runtime-tokio + sqlite)、dirs 5、chrono 0.4

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 创建 | `packages/jackcom/src-tauri/src/storage/mod.rs` | storage 模块入口：init_db, insert_frame, query_frames, create_session, list_sessions |
| 创建 | `packages/jackcom/src-tauri/src/storage/migrations/001_init.sql` | 建表迁移 SQL |
| 修改 | `packages/jackcom/src-tauri/src/lib.rs` | 注册 storage 模块，在 setup 中调用 init_db |
| 修改 | `packages/jackcom/src-tauri/src/state.rs` | 在 AppState 中提供 db 初始化辅助 |

---

### 任务 1：编写迁移 SQL + 测试建表

**文件：**
- 创建：`packages/jackcom/src-tauri/src/storage/migrations/001_init.sql`
- 创建：`packages/jackcom/src-tauri/src/storage/mod.rs`（框架，含 init_db + 测试）

- [ ] **步骤 1：创建 migrations/001_init.sql**

```sql
-- 会话表：每次打开串口创建一个 session
CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    port_name   TEXT    NOT NULL,
    baud_rate   INTEGER NOT NULL,
    config_json TEXT    NOT NULL DEFAULT '{}',
    started_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    ended_at    TEXT
);

-- 帧表：收发的每一帧数据
CREATE TABLE IF NOT EXISTS frames (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL,
    timestamp   TEXT    NOT NULL DEFAULT (datetime('now')),
    direction   TEXT    NOT NULL CHECK (direction IN ('tx', 'rx')),
    raw_data    BLOB    NOT NULL,
    protocol    TEXT    NOT NULL DEFAULT 'raw',
    formatted   TEXT    NOT NULL DEFAULT '',
    summary     TEXT    NOT NULL DEFAULT '',
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 索引：按会话 + 时间查询帧
CREATE INDEX IF NOT EXISTS idx_frames_session_time
    ON frames(session_id, timestamp);

-- 索引：按方向查询
CREATE INDEX IF NOT EXISTS idx_frames_direction
    ON frames(direction);

-- 索引：按协议查询
CREATE INDEX IF NOT EXISTS idx_frames_protocol
    ON frames(protocol);
```

- [ ] **步骤 2：创建 storage/mod.rs — init_db + 迁移执行**

```rust
pub mod migrations;

use sqlx::SqlitePool;
use std::path::PathBuf;

/// 建表迁移 SQL
const MIGRATION_001: &str = include_str!("migrations/001_init.sql");

/// 在 app data 目录下创建/打开数据库
pub async fn init_db() -> Result<SqlitePool, sqlx::Error> {
    let db_path = get_db_path();
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = SqlitePool::connect(&db_url).await?;
    run_migrations(&pool).await?;
    Ok(pool)
}

/// 使用内存数据库（用于测试）
pub async fn init_db_in_memory() -> Result<SqlitePool, sqlx::Error> {
    let pool = SqlitePool::connect("sqlite::memory:").await?;
    run_migrations(&pool).await?;
    Ok(pool)
}

/// 执行迁移
async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(MIGRATION_001).execute(pool).await?;
    Ok(())
}

/// 获取数据库文件路径
fn get_db_path() -> PathBuf {
    let app_data = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = app_data.join("jackcom");
    std::fs::create_dir_all(&dir).ok();
    dir.join("jackcom.db")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_init_db_in_memory_creates_tables() {
        let pool = init_db_in_memory().await
            .expect("内存数据库初始化失败");

        // 验证 sessions 表存在
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sessions"
        )
        .fetch_one(&pool)
        .await
        .expect("查询 sessions 表失败");
        assert_eq!(row.0, 0);

        // 验证 frames 表存在
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM frames"
        )
        .fetch_one(&pool)
        .await
        .expect("查询 frames 表失败");
        assert_eq!(row.0, 0);

        pool.close().await;
    }

    #[tokio::test]
    async fn test_migration_is_idempotent() {
        let pool = init_db_in_memory().await
            .expect("第一次初始化失败");

        // 再次执行迁移不应报错
        run_migrations(&pool).await
            .expect("重复迁移失败");

        pool.close().await;
    }
}
```

- [ ] **步骤 3：创建 migrations/mod.rs（让 migrations 目录成为模块）**

```rust
// migrations 子模块
// SQL 文件通过 include_str! 被 mod.rs 引用
```

- [ ] **步骤 4：运行测试 — 预期失败**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests --no-run
```

此时 storage 模块尚未在 lib.rs 注册，编译会报错。确认错误信息符合预期。

- [ ] **步骤 5：在 lib.rs 中注册 storage 模块**

在 `lib.rs` 顶部模块声明区域追加：

```rust
mod storage;
```

- [ ] **步骤 6：确认 sqlx features 正确**

确保 `Cargo.toml` 的 sqlx 依赖包含所需 features：

```toml
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio"] }
```

- [ ] **步骤 7：运行测试 — 预期通过**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests
```

预期：2 个测试通过（test_init_db_in_memory_creates_tables、test_migration_is_idempotent）。

- [ ] **步骤 8：Commit**

```bash
git add packages/jackcom/src-tauri/src/storage/ packages/jackcom/src-tauri/src/lib.rs
git commit -m "feat(jackcom): add storage module with migration and init_db"
```

---

### 任务 2：实现 insert_frame + 测试

**文件：**
- 修改：`packages/jackcom/src-tauri/src/storage/mod.rs`

- [ ] **步骤 1：编写测试 — insert_frame 基本功能**

在 `storage/mod.rs` 的 `#[cfg(test)] mod tests` 块中追加：

```rust
use crate::protocol::frame::{Direction, bytes_to_hex};
use crate::protocol::ProtocolType;
use chrono::Utc;

#[tokio::test]
async fn test_insert_frame_tx() {
    let pool = init_db_in_memory().await.unwrap();

    // 先创建 session
    let session_id = create_session(&pool, "COM3", 115200, "{}")
        .await
        .unwrap();

    // 插入一帧 TX 数据
    let raw_data = vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xC5, 0xCD];
    let timestamp = Utc::now();
    let frame_id = insert_frame(
        &pool,
        session_id,
        &timestamp,
        Direction::Tx,
        &raw_data,
        ProtocolType::Modbus,
        "Modbus RTU Read Holding Registers",
        "从站1 功能03 起始0 数量10",
    )
    .await
    .unwrap();

    assert!(frame_id > 0);

    // 验证数据正确
    let row: (String, String, Vec<u8>, String, String, String) = sqlx::query_as(
        "SELECT direction, timestamp, raw_data, protocol, formatted, summary FROM frames WHERE id = ?"
    )
    .bind(frame_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(row.0, "tx");
    assert_eq!(row.2, raw_data);
    assert_eq!(row.3, "modbus");

    pool.close().await;
}

#[tokio::test]
async fn test_insert_frame_rx() {
    let pool = init_db_in_memory().await.unwrap();
    let session_id = create_session(&pool, "COM5", 9600, "{}")
        .await
        .unwrap();

    let raw_data = vec![0x01, 0x03, 0x14];
    let timestamp = Utc::now();
    let frame_id = insert_frame(
        &pool,
        session_id,
        &timestamp,
        Direction::Rx,
        &raw_data,
        ProtocolType::Raw,
        "01 03 14",
        "原始数据 3 字节",
    )
    .await
    .unwrap();

    assert!(frame_id > 0);

    let row: (String, String) = sqlx::query_as(
        "SELECT direction, protocol FROM frames WHERE id = ?"
    )
    .bind(frame_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(row.0, "rx");
    assert_eq!(row.1, "raw");

    pool.close().await;
}
```

- [ ] **步骤 2：运行测试 — 预期失败**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests::test_insert_frame
```

确认编译错误：`insert_frame` 和 `create_session` 未定义。

- [ ] **步骤 3：实现 insert_frame 和 create_session**

在 `storage/mod.rs` 中 `init_db_in_memory` 函数之后追加：

```rust
use chrono::{DateTime, Utc};
use crate::protocol::frame::Direction;
use crate::protocol::ProtocolType;

/// 创建新会话
pub async fn create_session(
    pool: &SqlitePool,
    port_name: &str,
    baud_rate: u32,
    config_json: &str,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO sessions (port_name, baud_rate, config_json) VALUES (?, ?, ?)"
    )
    .bind(port_name)
    .bind(baud_rate as i64)
    .bind(config_json)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

/// 结束会话
pub async fn end_session(
    pool: &SqlitePool,
    session_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE sessions SET ended_at = datetime('now') WHERE id = ?"
    )
    .bind(session_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// 插入一帧数据
pub async fn insert_frame(
    pool: &SqlitePool,
    session_id: i64,
    timestamp: &DateTime<Utc>,
    direction: Direction,
    raw_data: &[u8],
    protocol: ProtocolType,
    formatted: &str,
    summary: &str,
) -> Result<i64, sqlx::Error> {
    let dir_str = match direction {
        Direction::Tx => "tx",
        Direction::Rx => "rx",
    };
    let proto_str = match protocol {
        ProtocolType::Raw => "raw",
        ProtocolType::Modbus => "modbus",
        ProtocolType::AT => "at",
        ProtocolType::Json => "json",
    };

    let result = sqlx::query(
        "INSERT INTO frames (session_id, timestamp, direction, raw_data, protocol, formatted, summary) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(session_id)
    .bind(timestamp.to_rfc3339())
    .bind(dir_str)
    .bind(raw_data)
    .bind(proto_str)
    .bind(formatted)
    .bind(summary)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}
```

- [ ] **步骤 4：运行测试 — 预期通过**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests::test_insert_frame
```

预期：2 个测试通过。

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src-tauri/src/storage/
git commit -m "feat(jackcom): implement insert_frame and create_session with tests"
```

---

### 任务 3：实现 query_frames（分页 + 过滤）+ 测试

**文件：**
- 修改：`packages/jackcom/src-tauri/src/storage/mod.rs`

- [ ] **步骤 1：定义查询参数和结果类型**

在 `storage/mod.rs` 中，`insert_frame` 函数之后追加：

```rust
/// 帧查询过滤条件
#[derive(Debug, Clone, Default)]
pub struct FrameQuery {
    pub session_id: Option<i64>,
    pub direction: Option<Direction>,
    pub protocol: Option<ProtocolType>,
    pub since: Option<DateTime<Utc>>,
    pub until: Option<DateTime<Utc>>,
    pub limit: i64,
    pub offset: i64,
}

impl FrameQuery {
    /// 创建默认查询（最新 50 条）
    pub fn new() -> Self {
        Self {
            limit: 50,
            offset: 0,
            ..Default::default()
        }
    }

    pub fn session(mut self, id: i64) -> Self {
        self.session_id = Some(id);
        self
    }

    pub fn direction(mut self, dir: Direction) -> Self {
        self.direction = Some(dir);
        self
    }

    pub fn protocol(mut self, proto: ProtocolType) -> Self {
        self.protocol = Some(proto);
        self
    }

    pub fn since(mut self, dt: DateTime<Utc>) -> Self {
        self.since = Some(dt);
        self
    }

    pub fn until(mut self, dt: DateTime<Utc>) -> Self {
        self.until = Some(dt);
        self
    }

    pub fn limit(mut self, n: i64) -> Self {
        self.limit = n;
        self
    }

    pub fn offset(mut self, n: i64) -> Self {
        self.offset = n;
        self
    }
}

/// 查询返回的帧记录行
#[derive(Debug, Clone)]
pub struct FrameRow {
    pub id: i64,
    pub session_id: i64,
    pub timestamp: String,
    pub direction: Direction,
    pub raw_data: Vec<u8>,
    pub protocol: ProtocolType,
    pub formatted: String,
    pub summary: String,
}

/// 分页查询结果
#[derive(Debug, Clone)]
pub struct FramePage {
    pub rows: Vec<FrameRow>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}
```

- [ ] **步骤 2：编写测试 — query_frames 分页和过滤**

在 `#[cfg(test)] mod tests` 块中追加：

```rust
async fn setup_test_data(pool: &SqlitePool) -> i64 {
    let sid = create_session(pool, "COM3", 115200, "{}").await.unwrap();
    let now = Utc::now();

    // 插入 5 帧：3 TX + 2 RX，不同协议
    insert_frame(pool, sid, &now, Direction::Tx, &[0x01], ProtocolType::Modbus, "M1", "modbus tx 1").await.unwrap();
    insert_frame(pool, sid, &now, Direction::Rx, &[0x02], ProtocolType::Modbus, "M2", "modbus rx 1").await.unwrap();
    insert_frame(pool, sid, &now, Direction::Tx, &[0x03], ProtocolType::Raw, "R1", "raw tx 1").await.unwrap();
    insert_frame(pool, sid, &now, Direction::Tx, &[0x04], ProtocolType::AT, "A1", "at tx 1").await.unwrap();
    insert_frame(pool, sid, &now, Direction::Rx, &[0x05], ProtocolType::Raw, "R2", "raw rx 1").await.unwrap();

    sid
}

#[tokio::test]
async fn test_query_all_frames() {
    let pool = init_db_in_memory().await.unwrap();
    let sid = setup_test_data(&pool).await;

    let page = query_frames(&pool, FrameQuery::new().session(sid).limit(10))
        .await
        .unwrap();

    assert_eq!(page.total, 5);
    assert_eq!(page.rows.len(), 5);
    assert_eq!(page.limit, 10);
    assert_eq!(page.offset, 0);

    pool.close().await;
}

#[tokio::test]
async fn test_query_frames_by_direction() {
    let pool = init_db_in_memory().await.unwrap();
    let sid = setup_test_data(&pool).await;

    let page = query_frames(&pool, FrameQuery::new().session(sid).direction(Direction::Tx))
        .await
        .unwrap();

    assert_eq!(page.total, 3);
    assert!(page.rows.iter().all(|r| r.direction == Direction::Tx));

    pool.close().await;
}

#[tokio::test]
async fn test_query_frames_by_protocol() {
    let pool = init_db_in_memory().await.unwrap();
    let sid = setup_test_data(&pool).await;

    let page = query_frames(&pool, FrameQuery::new().session(sid).protocol(ProtocolType::Modbus))
        .await
        .unwrap();

    assert_eq!(page.total, 2);
    assert!(page.rows.iter().all(|r| r.protocol == ProtocolType::Modbus));

    pool.close().await;
}

#[tokio::test]
async fn test_query_frames_pagination() {
    let pool = init_db_in_memory().await.unwrap();
    let sid = setup_test_data(&pool).await;

    // 第一页
    let page1 = query_frames(&pool, FrameQuery::new().session(sid).limit(2).offset(0))
        .await
        .unwrap();
    assert_eq!(page1.rows.len(), 2);
    assert_eq!(page1.total, 5);

    // 第二页
    let page2 = query_frames(&pool, FrameQuery::new().session(sid).limit(2).offset(2))
        .await
        .unwrap();
    assert_eq!(page2.rows.len(), 2);

    // 第三页
    let page3 = query_frames(&pool, FrameQuery::new().session(sid).limit(2).offset(4))
        .await
        .unwrap();
    assert_eq!(page3.rows.len(), 1);

    pool.close().await;
}

#[tokio::test]
async fn test_query_frames_empty_result() {
    let pool = init_db_in_memory().await.unwrap();
    let sid = setup_test_data(&pool).await;

    let page = query_frames(&pool, FrameQuery::new().session(sid).protocol(ProtocolType::Json))
        .await
        .unwrap();

    assert_eq!(page.total, 0);
    assert!(page.rows.is_empty());

    pool.close().await;
}

#[tokio::test]
async fn test_query_frames_by_time_range() {
    let pool = init_db_in_memory().await.unwrap();
    let sid = setup_test_data(&pool).await;

    // 使用过去的时间范围，不应匹配任何帧
    let past = Utc::now() - chrono::Duration::hours(1);
    let far_past = Utc::now() - chrono::Duration::hours(2);
    let page = query_frames(&pool, FrameQuery::new().session(sid).since(far_past).until(past))
        .await
        .unwrap();

    assert_eq!(page.total, 0);
    assert!(page.rows.is_empty());

    pool.close().await;
}
```

- [ ] **步骤 3：运行测试 — 预期失败**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests::test_query
```

确认编译错误：`query_frames` 未定义。

- [ ] **步骤 4：实现 query_frames**

在 `FramePage` 结构体之后追加：

```rust
/// 分页查询帧数据
pub async fn query_frames(
    pool: &SqlitePool,
    query: FrameQuery,
) -> Result<FramePage, sqlx::Error> {
    let mut where_clauses = Vec::new();
    let mut count_sql = String::from("SELECT COUNT(*) FROM frames");
    let mut select_sql = String::from(
        "SELECT id, session_id, timestamp, direction, raw_data, protocol, formatted, summary FROM frames"
    );

    if let Some(sid) = query.session_id {
        where_clauses.push(format!("session_id = {}", sid));
    }
    if let Some(ref dir) = query.direction {
        let dir_str = match dir {
            Direction::Tx => "tx",
            Direction::Rx => "rx",
        };
        where_clauses.push(format!("direction = '{}'", dir_str));
    }
    if let Some(ref proto) = query.protocol {
        let proto_str = match proto {
            ProtocolType::Raw => "raw",
            ProtocolType::Modbus => "modbus",
            ProtocolType::AT => "at",
            ProtocolType::Json => "json",
        };
        where_clauses.push(format!("protocol = '{}'", proto_str));
    }
    if let Some(ref since) = query.since {
        where_clauses.push(format!("timestamp >= '{}'", since.to_rfc3339()));
    }
    if let Some(ref until) = query.until {
        where_clauses.push(format!("timestamp <= '{}'", until.to_rfc3339()));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };

    // 查询总数
    let (total,): (i64,) = sqlx::query_as(&format!("{}{}", count_sql, where_sql))
        .fetch_one(pool)
        .await?;

    // 查询数据
    let data_sql = format!(
        "{}{} ORDER BY timestamp ASC LIMIT {} OFFSET {}",
        select_sql, where_sql, query.limit, query.offset
    );

    let rows: Vec<(i64, i64, String, String, Vec<u8>, String, String, String)> =
        sqlx::query_as(&data_sql).fetch_all(pool).await?;

    let frame_rows = rows.into_iter().map(|row| {
        let direction = match row.3.as_str() {
            "tx" => Direction::Tx,
            _ => Direction::Rx,
        };
        let protocol = match row.5.as_str() {
            "modbus" => ProtocolType::Modbus,
            "at" => ProtocolType::AT,
            "json" => ProtocolType::Json,
            _ => ProtocolType::Raw,
        };
        FrameRow {
            id: row.0,
            session_id: row.1,
            timestamp: row.2,
            direction,
            raw_data: row.4,
            protocol,
            formatted: row.6,
            summary: row.7,
        }
    }).collect();

    Ok(FramePage {
        rows: frame_rows,
        total,
        limit: query.limit,
        offset: query.offset,
    })
}
```

- [ ] **步骤 5：运行测试 — 预期通过**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests::test_query
```

预期：6 个测试全部通过。

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src-tauri/src/storage/
git commit -m "feat(jackcom): implement query_frames with pagination, direction, protocol, and time filters"
```

---

### 任务 4：实现 session CRUD + 测试

**文件：**
- 修改：`packages/jackcom/src-tauri/src/storage/mod.rs`

- [ ] **步骤 1：编写测试 — session CRUD 全流程**

在 `#[cfg(test)] mod tests` 块中追加：

```rust
#[tokio::test]
async fn test_create_and_end_session() {
    let pool = init_db_in_memory().await.unwrap();

    let sid = create_session(&pool, "COM3", 115200, r#"{"data_bits":"eight"}"#)
        .await
        .unwrap();

    assert!(sid > 0);

    // 结束会话
    end_session(&pool, sid).await.unwrap();

    // 验证 ended_at 已设置
    let row: (Option<String>,) = sqlx::query_as(
        "SELECT ended_at FROM sessions WHERE id = ?"
    )
    .bind(sid)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert!(row.0.is_some(), "ended_at 应该已被设置");

    pool.close().await;
}

#[tokio::test]
async fn test_list_sessions() {
    let pool = init_db_in_memory().await.unwrap();

    create_session(&pool, "COM1", 9600, "{}").await.unwrap();
    create_session(&pool, "COM2", 115200, "{}").await.unwrap();
    create_session(&pool, "COM3", 57600, "{}").await.unwrap();

    let sessions = list_sessions(&pool, 10, 0).await.unwrap();

    assert_eq!(sessions.len(), 3);
    // 按时间降序，最新的在前
    assert_eq!(sessions[0].port_name, "COM3");
    assert_eq!(sessions[1].port_name, "COM2");
    assert_eq!(sessions[2].port_name, "COM1");

    pool.close().await;
}

#[tokio::test]
async fn test_list_sessions_pagination() {
    let pool = init_db_in_memory().await.unwrap();

    for i in 0..5 {
        create_session(&pool, &format!("COM{}", i), 9600, "{}").await.unwrap();
    }

    let page1 = list_sessions(&pool, 2, 0).await.unwrap();
    assert_eq!(page1.len(), 2);

    let page2 = list_sessions(&pool, 2, 2).await.unwrap();
    assert_eq!(page2.len(), 2);

    let page3 = list_sessions(&pool, 2, 4).await.unwrap();
    assert_eq!(page3.len(), 1);

    pool.close().await;
}

#[tokio::test]
async fn test_get_session() {
    let pool = init_db_in_memory().await.unwrap();

    let sid = create_session(&pool, "COM7", 230400, r#"{"parity":"even"}"#)
        .await
        .unwrap();

    let session = get_session(&pool, sid).await.unwrap();

    assert_eq!(session.port_name, "COM7");
    assert_eq!(session.baud_rate, 230400);
    assert_eq!(session.config_json, r#"{"parity":"even"}"#);
    assert!(session.ended_at.is_none());

    pool.close().await;
}

#[tokio::test]
async fn test_get_session_not_found() {
    let pool = init_db_in_memory().await.unwrap();

    let result = get_session(&pool, 99999).await;
    assert!(result.is_none());

    pool.close().await;
}

#[tokio::test]
async fn test_delete_session_cascades_frames() {
    let pool = init_db_in_memory().await.unwrap();

    let sid = create_session(&pool, "COM1", 9600, "{}").await.unwrap();
    let now = Utc::now();
    insert_frame(&pool, sid, &now, Direction::Tx, &[0x01], ProtocolType::Raw, "", "").await.unwrap();
    insert_frame(&pool, sid, &now, Direction::Rx, &[0x02], ProtocolType::Raw, "", "").await.unwrap();

    // 删除 session
    delete_session(&pool, sid).await.unwrap();

    // frames 应该被级联删除
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM frames")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);

    // session 本身也应不存在
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sessions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);

    pool.close().await;
}
```

- [ ] **步骤 2：运行测试 — 预期失败**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests::test_create_and_end_session storage::tests::test_list_sessions storage::tests::test_get_session storage::tests::test_delete_session
```

确认编译错误：`list_sessions`、`get_session`、`delete_session` 未定义。

- [ ] **步骤 3：定义 SessionRow 类型 + 实现 session 查询函数**

在 `storage/mod.rs` 中，`query_frames` 函数之后追加：

```rust
/// 会话记录行
#[derive(Debug, Clone)]
pub struct SessionRow {
    pub id: i64,
    pub port_name: String,
    pub baud_rate: u32,
    pub config_json: String,
    pub started_at: String,
    pub ended_at: Option<String>,
}

/// 列出会话（按时间降序，分页）
pub async fn list_sessions(
    pool: &SqlitePool,
    limit: i64,
    offset: i64,
) -> Result<Vec<SessionRow>, sqlx::Error> {
    let rows: Vec<(i64, String, i64, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, port_name, baud_rate, config_json, started_at, ended_at FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?"
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|row| SessionRow {
        id: row.0,
        port_name: row.1,
        baud_rate: row.2 as u32,
        config_json: row.3,
        started_at: row.4,
        ended_at: row.5,
    }).collect())
}

/// 获取单个会话
pub async fn get_session(
    pool: &SqlitePool,
    session_id: i64,
) -> Result<Option<SessionRow>, sqlx::Error> {
    let result: Option<(i64, String, i64, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, port_name, baud_rate, config_json, started_at, ended_at FROM sessions WHERE id = ?"
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await?;

    Ok(result.map(|row| SessionRow {
        id: row.0,
        port_name: row.1,
        baud_rate: row.2 as u32,
        config_json: row.3,
        started_at: row.4,
        ended_at: row.5,
    }))
}

/// 删除会话及其所有帧（级联删除）
pub async fn delete_session(
    pool: &SqlitePool,
    session_id: i64,
) -> Result<(), sqlx::Error> {
    // SQLite 需要开启外键约束才能级联删除
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;

    sqlx::query("DELETE FROM frames WHERE session_id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    sqlx::query("DELETE FROM sessions WHERE id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
}
```

- [ ] **步骤 4：运行测试 — 预期通过**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests::test_create_and_end_session storage::tests::test_list_sessions storage::tests::test_get_session storage::tests::test_delete_session
```

预期：6 个测试全部通过。

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src-tauri/src/storage/
git commit -m "feat(jackcom): implement session CRUD with pagination and cascade delete"
```

---

### 任务 5：集成到 AppState 的 db 初始化

**文件：**
- 修改：`packages/jackcom/src-tauri/src/state.rs`
- 修改：`packages/jackcom/src-tauri/src/lib.rs`

- [ ] **步骤 1：编写测试 — AppState db 初始化**

在 `storage/mod.rs` 的测试块中追加：

```rust
use crate::state::AppState;

#[tokio::test]
async fn test_appstate_db_init() {
    let state = AppState::new();
    assert!(state.db.read().await.is_none());

    // 初始化内存数据库并注入
    let pool = init_db_in_memory().await.unwrap();
    *state.db.write().await = Some(pool);

    // 验证 db 已设置
    let db_guard = state.db.read().await;
    assert!(db_guard.is_some());

    // 使用 db 插入数据
    let pool = db_guard.as_ref().unwrap();
    let sid = create_session(pool, "COM_TEST", 57600, "{}").await.unwrap();
    assert!(sid > 0);
}
```

- [ ] **步骤 2：运行测试 — 预期失败**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests::test_appstate_db_init
```

确认是否有编译问题（state.rs 应已有 `db: Arc<RwLock<Option<SqlitePool>>>` 字段）。

- [ ] **步骤 3：在 lib.rs 的 setup 中集成 init_db**

更新 `lib.rs`，在 Tauri Builder 中添加 setup 回调：

```rust
mod channel;
mod commands;
mod error;
mod protocol;
mod serial;
mod state;
mod storage;

use state::AppState;
use storage::init_db;

#[tauri::command]
fn ping() -> Result<&'static str, error::AppError> {
    Ok("pong")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<AppState>();
                match init_db().await {
                    Ok(pool) => {
                        *state.db.write().await = Some(pool);
                        log::info!("数据库初始化成功");
                    }
                    Err(e) => {
                        log::error!("数据库初始化失败: {}", e);
                    }
                }
            });
            Ok(())
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 4：运行全部 storage 测试 — 预期通过**

```bash
cd packages/jackcom/src-tauri && cargo test storage::tests
```

预期：所有测试通过（包括新增的 test_appstate_db_init）。

- [ ] **步骤 5：运行全部测试 — 确认无回归**

```bash
cd packages/jackcom/src-tauri && cargo test
```

预期：所有测试通过。

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom/src-tauri/src/
git commit -m "feat(jackcom): integrate storage init_db into AppState and Tauri setup"
```

---

## 自检

**规格覆盖度：**
- init_db（文件数据库 + 内存数据库）+ 建表迁移
- sessions 表 CRUD（create_session, end_session, list_sessions, get_session, delete_session）
- frames 表写入（insert_frame）
- frames 表分页查询（query_frames：按 session/direction/protocol/time 过滤 + limit/offset 分页）
- 集成到 AppState 和 Tauri setup
- 测试全部使用 :memory: 数据库，不依赖文件系统

**占位符扫描：** 无 TODO/TBD，所有步骤有完整代码。

**类型一致性：**
- Direction (tx/rx) 与 protocol/frame.rs 一致
- ProtocolType (raw/modbus/at/json) 与 protocol/mod.rs 一致
- AppState.db 类型为 Arc<RwLock<Option<SqlitePool>>> 与 state.rs 一致
- 迁移 SQL 中 direction CHECK 约束和 Rust 枚举映射一致

**TDD 流程验证：** 每个任务均遵循 "写测试 -> 运行失败 -> 实现 -> 运行通过 -> commit" 循环。
