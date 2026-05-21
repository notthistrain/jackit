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
    let _base = dirs::data_local_dir()
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
