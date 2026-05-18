pub mod config;
pub mod db;
pub mod error;
pub mod handler;
pub mod middleware;
pub mod model;

#[cfg(feature = "test-utils")]
use sqlx::SqlitePool;

/// 构建测试用 app（集成测试使用）
#[cfg(feature = "test-utils")]
pub fn test_app(pool: SqlitePool) -> axum::Router {
    handler::app(pool, "test-token".to_string())
}
