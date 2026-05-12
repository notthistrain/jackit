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
