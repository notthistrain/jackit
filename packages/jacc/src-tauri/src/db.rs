use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::PathBuf;

/// 获取数据库文件路径: ~/.jackit/jacc/data/jacc.db
pub fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".jackit").join("jacc").join("data");
    std::fs::create_dir_all(&dir).ok();
    dir.join("jacc.db")
}

pub async fn init_pool() -> Result<SqlitePool, sqlx::Error> {
    let db_path = get_db_path();
    let url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    migrate(&pool).await?;
    Ok(pool)
}

async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alias TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            model_name TEXT NOT NULL,
            slot TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            name TEXT,
            last_opened_at TEXT DEFAULT (datetime('now')),
            pinned INTEGER DEFAULT 0
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    // 迁移：添加 context_size 字段
    sqlx::query(
        "ALTER TABLE models ADD COLUMN context_size TEXT DEFAULT NULL",
    )
    .execute(pool)
    .await
    .ok(); // 忽略 "duplicate column" 错误（已迁移过的数据库）

    Ok(())
}
