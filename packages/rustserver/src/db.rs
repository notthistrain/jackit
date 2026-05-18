use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

pub async fn init_pool(db_path: &str) -> Result<SqlitePool, sqlx::Error> {
    // 确保数据目录存在
    if let Some(parent) = std::path::Path::new(db_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let url = format!("sqlite:{}?mode=rwc", db_path);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    migrate(&pool).await?;
    Ok(pool)
}

async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS software (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT NOT NULL UNIQUE,
            display_name TEXT,
            description  TEXT,
            ext          TEXT,
            identifier   TEXT,
            created_at   TEXT DEFAULT (datetime('now')),
            updated_at   TEXT DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS software_version (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            software_id INTEGER NOT NULL REFERENCES software(id) ON DELETE CASCADE,
            sequence    TEXT NOT NULL,
            key         TEXT NOT NULL,
            size        INTEGER DEFAULT 0,
            force       INTEGER DEFAULT 0,
            changelog   TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            UNIQUE(software_id, sequence)
        )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// 创建内存数据库（测试用）
#[cfg(feature = "test-utils")]
pub async fn setup_test_db() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    migrate(&pool).await.unwrap();
    pool
}
