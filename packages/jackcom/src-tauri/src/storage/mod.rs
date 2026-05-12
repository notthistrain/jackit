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
}
