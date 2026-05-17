use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::PathBuf;

/// 获取数据库文件路径: ~/.jackit/toolbox/tools/jacc/data/jacc.db
pub fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".jackit").join("toolbox").join("tools").join("jacc").join("data");
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
    // 启用 foreign keys（ON DELETE CASCADE 需要）
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alias TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            model_name TEXT NOT NULL,
            context_size TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS model_slots (
            slot TEXT PRIMARY KEY,
            model_id INTEGER NOT NULL,
            context_size TEXT,
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
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

    // 迁移：如果旧 models 表有 slot 列，重建表移除它
    // SQLite 不支持 DROP COLUMN，需要重建
    let has_slot: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM pragma_table_info('models') WHERE name = 'slot'"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0) > 0;

    if has_slot {
        sqlx::query(
            "CREATE TABLE models_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alias TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )"
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "INSERT INTO models_new (id, alias, base_url, api_key, model_name, context_size, created_at, updated_at)
             SELECT id, alias, base_url, api_key, model_name, context_size, created_at, updated_at FROM models"
        )
        .execute(pool)
        .await?;

        sqlx::query("DROP TABLE models")
            .execute(pool)
            .await?;

        sqlx::query("ALTER TABLE models_new RENAME TO models")
            .execute(pool)
            .await?;
    }

    // 迁移：添加 context_size 字段（如果尚未存在）
    let has_ctx: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM pragma_table_info('models') WHERE name = 'context_size'"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0) > 0;

    if !has_ctx {
        sqlx::query("ALTER TABLE models ADD COLUMN context_size TEXT DEFAULT NULL")
            .execute(pool)
            .await
            .ok();
    }

    Ok(())
}
