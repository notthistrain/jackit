use anyhow::Result;
use sqlx::SqlitePool;

const MIGRATION_001: &str = include_str!("migrations/001_init.sql");

pub async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::query(MIGRATION_001).execute(pool).await?;
    Ok(())
}
