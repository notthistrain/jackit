pub mod migrations;

use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use std::path::PathBuf;

use crate::protocol::frame::Direction;
use crate::protocol::ProtocolType;

/// 建表迁移 SQL
const MIGRATION_001: &str = include_str!("migrations/001_init.sql");

/// 在 app data 目录下创建/打开数据库
pub async fn init_db() -> Result<SqlitePool, sqlx::Error> {
    let db_path = get_db_path();
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = SqlitePool::connect(&db_url).await?;
    // 启用外键约束（SQLite 默认关闭）
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await?;
    run_migrations(&pool).await?;
    Ok(pool)
}

/// 使用内存数据库（用于测试）
pub async fn init_db_in_memory() -> Result<SqlitePool, sqlx::Error> {
    let pool = SqlitePool::connect("sqlite::memory:").await?;
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await?;
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
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let new_dir = home.join(".jackit").join("toolbox").join("tools").join("jackcom").join("data");
    let new_path = new_dir.join("jackcom.db");

    // 迁移旧数据
    if !new_path.exists() {
        let old_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("jackcom");
        let old_path = old_dir.join("jackcom.db");
        if old_path.exists() {
            std::fs::create_dir_all(&new_dir).ok();
            std::fs::copy(&old_path, &new_path).ok();
            // 保留旧文件作为备份，不删除
        }
    }

    std::fs::create_dir_all(&new_dir).ok();
    new_path
}

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

/// 分页查询帧数据（参数化查询）
pub async fn query_frames(
    pool: &SqlitePool,
    query: FrameQuery,
) -> Result<FramePage, sqlx::Error> {
    // 动态构建 SQL 和参数
    let mut where_parts: Vec<String> = Vec::new();
    let mut param_idx = 1u32; // SQLite 参数从 1 开始

    // 条件参数绑定（记录参数值用于两轮查询）
    let p_session_id = query.session_id;
    let p_direction: Option<String> = query.direction.map(|d| match d {
        Direction::Tx => "tx".to_string(),
        Direction::Rx => "rx".to_string(),
    });
    let p_protocol: Option<String> = query.protocol.map(|p| match p {
        ProtocolType::Raw => "raw".to_string(),
        ProtocolType::Modbus => "modbus".to_string(),
        ProtocolType::AT => "at".to_string(),
        ProtocolType::Json => "json".to_string(),
    });
    let p_since: Option<String> = query.since.map(|dt| dt.to_rfc3339());
    let p_until: Option<String> = query.until.map(|dt| dt.to_rfc3339());

    if p_session_id.is_some() {
        where_parts.push(format!("session_id = ?{}", param_idx));
        param_idx += 1;
    }
    if p_direction.is_some() {
        where_parts.push(format!("direction = ?{}", param_idx));
        param_idx += 1;
    }
    if p_protocol.is_some() {
        where_parts.push(format!("protocol = ?{}", param_idx));
        param_idx += 1;
    }
    if p_since.is_some() {
        where_parts.push(format!("timestamp >= ?{}", param_idx));
        param_idx += 1;
    }
    if p_until.is_some() {
        where_parts.push(format!("timestamp <= ?{}", param_idx));
        param_idx += 1;
    }

    let where_sql = if where_parts.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_parts.join(" AND "))
    };

    // 查询总数
    let count_sql = format!("SELECT COUNT(*) FROM frames{}", where_sql);
    let count_query = sqlx::query_scalar::<_, i64>(&count_sql);
    // 动态绑定参数（需要逐步 bind）
    let mut count_query = count_query;
    let mut bind_idx = 1u32;
    if let Some(sid) = p_session_id { count_query = count_query.bind(sid); bind_idx += 1; }
    if let Some(ref dir) = p_direction { count_query = count_query.bind(dir.clone()); bind_idx += 1; }
    if let Some(ref proto) = p_protocol { count_query = count_query.bind(proto.clone()); bind_idx += 1; }
    if let Some(ref since) = p_since { count_query = count_query.bind(since.clone()); bind_idx += 1; }
    if let Some(ref until) = p_until { count_query = count_query.bind(until.clone()); bind_idx += 1; }

    let total: i64 = count_query.fetch_one(pool).await?;

    // 查询数据
    let data_sql = format!(
        "SELECT id, session_id, timestamp, direction, raw_data, protocol, formatted, summary FROM frames{} ORDER BY timestamp ASC LIMIT ?{} OFFSET ?{}",
        where_sql, bind_idx, bind_idx + 1
    );
    let data_query = sqlx::query_as::<_, (i64, i64, String, String, Vec<u8>, String, String, String)>(&data_sql);
    let mut data_query = data_query;
    if let Some(sid) = p_session_id { data_query = data_query.bind(sid); }
    if let Some(ref dir) = p_direction { data_query = data_query.bind(dir.clone()); }
    if let Some(ref proto) = p_protocol { data_query = data_query.bind(proto.clone()); }
    if let Some(ref since) = p_since { data_query = data_query.bind(since.clone()); }
    if let Some(ref until) = p_until { data_query = data_query.bind(until.clone()); }
    data_query = data_query.bind(query.limit);
    data_query = data_query.bind(query.offset);

    let rows = data_query.fetch_all(pool).await?;

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

/// 删除会话（帧通过 ON DELETE CASCADE 自动删除）
pub async fn delete_session(
    pool: &SqlitePool,
    session_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM sessions WHERE id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
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
        // 验证三个端口名都在结果中（排序由 started_at 决定）
        let names: Vec<&str> = sessions.iter().map(|s| s.port_name.as_str()).collect();
        assert!(names.contains(&"COM1"));
        assert!(names.contains(&"COM2"));
        assert!(names.contains(&"COM3"));

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

        let session = get_session(&pool, sid).await.unwrap().unwrap();

        assert_eq!(session.port_name, "COM7");
        assert_eq!(session.baud_rate, 230400);
        assert_eq!(session.config_json, r#"{"parity":"even"}"#);
        assert!(session.ended_at.is_none());

        pool.close().await;
    }

    #[tokio::test]
    async fn test_get_session_not_found() {
        let pool = init_db_in_memory().await.unwrap();

        let result = get_session(&pool, 99999).await.unwrap();
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

    #[tokio::test]
    async fn test_appstate_db_init() {
        use crate::state::AppState;

        let state = AppState::new_test();
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
}
