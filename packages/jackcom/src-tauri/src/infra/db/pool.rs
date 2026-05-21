use std::path::PathBuf;

use anyhow::{Context, Result};
use sqlx::SqlitePool;

const MIGRATION_001: &str = include_str!("migrations/001_init.sql");

/// DB 初始化：创建连接池 + migration + PRAGMA
pub async fn init_db() -> Result<SqlitePool> {
    let db_path = ensure_db_path()?;

    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = SqlitePool::connect(&db_url)
        .await
        .context("创建 SQLite 连接池失败")?;

    // PRAGMA: 每个 SQLite 连接必须执行（默认关闭外键）
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .context("设置 PRAGMA foreign_keys 失败")?;

    sqlx::query(MIGRATION_001).execute(&pool).await?;

    tracing::info!("数据库初始化完成: {}", db_path.display());
    Ok(pool)
}

/// 确保数据目录存在，返回 DB 文件路径
fn ensure_db_path() -> Result<PathBuf> {
    // 新路径：~/.jackit/toolbox/tools/jackcom/data/jackcom.db
    // 按项目规范 CLAUDE.md
    let jackit_base = dirs::home_dir()
        .context("无法获取 HOME 目录")?
        .join(".jackit")
        .join("toolbox")
        .join("tools")
        .join("jackcom")
        .join("data");
    std::fs::create_dir_all(&jackit_base).context("创建数据目录失败")?;
    Ok(jackit_base.join("jackcom.db"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn init_db_creates_tables() {
        // 使用内存数据库测试
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(MIGRATION_001).execute(&pool).await.unwrap();

        // 验证表存在
        let result: Vec<(String,)> =
            sqlx::query_as("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .fetch_all(&pool)
                .await
                .unwrap();

        let table_names: Vec<&str> = result.iter().map(|(n,)| n.as_str()).collect();
        assert!(table_names.contains(&"sessions"));
        assert!(table_names.contains(&"frames"));
    }
}
