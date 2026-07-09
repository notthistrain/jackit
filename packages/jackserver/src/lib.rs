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
    handler::app(
        pool,
        "test-token".to_string(),
        config::MetricsConfig {
            enabled: true,
            track_secret: "test-track".to_string(),
            allowed_origins: vec!["https://test.local".to_string()],
            rate_limit: "1000/m".to_string(),
        },
    )
}

/// 测试辅助：按服务端相同规则计算打点签名（`site|path|ts` 的 HMAC-SHA256 hex）。
/// 仅供集成测试构造合法上报使用。
#[cfg(feature = "test-utils")]
pub fn test_sign_track(secret: &str, site: &str, path: &str, ts: i64) -> String {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(format!("{site}|{path}|{ts}").as_bytes());
    hex::encode(mac.finalize().into_bytes())
}
