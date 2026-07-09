use axum::extract::{Extension, Query, State};
use axum::Json;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

use crate::error::{AppError, ResDTO};
use crate::model::{self, DimensionCount, OverviewPoint, TrackedData};

/// 报表查询参数（overview / paths / sources 共用）。
#[derive(Debug, Deserialize)]
pub struct ReportQuery {
    pub site: String,
    pub from: String,
    pub to: String,
    /// overview 粒度：day | hour（默认 day）
    pub granularity: Option<String>,
    /// paths / sources 取 Top-N（默认 20，上限 200）
    pub limit: Option<i64>,
    /// sources 维度：referer | device（默认 referer）
    pub dim: Option<String>,
}

/// POST /api/metrics/track —— 打点上报（已过 check_track 中间件校验）。
///
/// 从中间件注入的 `TrackedData` 取站点/路径/来源/IP/UA，计算 visitor_hash 与设备类型后落库。
/// 落库时间以服务端 `datetime('now')` 为准。
pub async fn track(
    State(pool): State<SqlitePool>,
    Extension(data): Extension<TrackedData>,
) -> Result<Json<ResDTO<serde_json::Value>>, AppError> {
    let TrackedData { input, ip, ua } = data;
    let visitor_hash = visitor_hash(ip.as_deref(), ua.as_deref());
    let device = ua.as_deref().map(parse_device);

    let id = model::insert_page_view(
        &pool,
        &input.site,
        &input.path,
        &visitor_hash,
        ip.as_deref(),
        ua.as_deref(),
        input.referer.as_deref(),
        device.as_deref(),
    )
    .await?;

    tracing::debug!(id, site = %input.site, path = %input.path, "page view recorded");
    Ok(Json(ResDTO::ok(serde_json::json!({ "ok": true }))))
}

/// GET /api/metrics/overview —— 按时间聚合 PV/UV（需 admin）。
pub async fn overview(
    State(pool): State<SqlitePool>,
    Query(q): Query<ReportQuery>,
) -> Result<Json<ResDTO<Vec<OverviewPoint>>>, AppError> {
    let granularity = q.granularity.as_deref().unwrap_or("day");
    let rows = model::query_overview(&pool, &q.site, &q.from, &q.to, granularity).await?;
    Ok(Json(ResDTO::ok(rows)))
}

/// GET /api/metrics/paths —— 按页面路径 Top-N（需 admin）。
pub async fn paths(
    State(pool): State<SqlitePool>,
    Query(q): Query<ReportQuery>,
) -> Result<Json<ResDTO<Vec<DimensionCount>>>, AppError> {
    let limit = q.limit.unwrap_or(20).clamp(1, 200);
    let rows = model::query_top_paths(&pool, &q.site, &q.from, &q.to, limit).await?;
    Ok(Json(ResDTO::ok(rows)))
}

/// GET /api/metrics/sources —— 按 referer / device Top-N（需 admin）。
pub async fn sources(
    State(pool): State<SqlitePool>,
    Query(q): Query<ReportQuery>,
) -> Result<Json<ResDTO<Vec<DimensionCount>>>, AppError> {
    let dim = q.dim.as_deref().unwrap_or("referer");
    if dim != "referer" && dim != "device" {
        return Err(AppError::BadRequest(
            "dim must be 'referer' or 'device'".to_string(),
        ));
    }
    let limit = q.limit.unwrap_or(20).clamp(1, 200);
    let rows = model::query_top_sources(&pool, &q.site, &q.from, &q.to, dim, limit).await?;
    Ok(Json(ResDTO::ok(rows)))
}

/// visitor_hash = hex(sha256(ip|ua)) 前 32 字符，用于 UV 去重。
fn visitor_hash(ip: Option<&str>, ua: Option<&str>) -> String {
    let mut hasher = Sha256::new();
    hasher.update(ip.unwrap_or("").as_bytes());
    hasher.update(b"|");
    hasher.update(ua.unwrap_or("").as_bytes());
    hex::encode(hasher.finalize())[..32].to_string()
}

/// 简单 UA 解析：mobile / bot / desktop（不引第三方 ua-parser）。
fn parse_device(ua: &str) -> String {
    let lower = ua.to_ascii_lowercase();
    if lower.contains("bot")
        || lower.contains("spider")
        || lower.contains("curl")
        || lower.contains("python")
        || lower.contains("wget")
        || lower.contains("headless")
    {
        "bot".to_string()
    } else if lower.contains("mobile")
        || lower.contains("android")
        || lower.contains("iphone")
        || lower.contains("ipad")
    {
        "mobile".to_string()
    } else {
        "desktop".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visitor_hash_stable_and_distinct() {
        let a = visitor_hash(Some("1.2.3.4"), Some("Mozilla/5.0"));
        let b = visitor_hash(Some("1.2.3.4"), Some("Mozilla/5.0"));
        assert_eq!(a, b);
        assert_eq!(a.len(), 32);
        // IP 不同 → hash 不同
        assert_ne!(a, visitor_hash(Some("1.2.3.5"), Some("Mozilla/5.0")));
    }

    #[test]
    fn test_parse_device() {
        assert_eq!(
            parse_device("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"),
            "mobile"
        );
        assert_eq!(parse_device("Mozilla/5.0 (Linux; Android 13)"), "mobile");
        assert_eq!(parse_device("curl/8.0"), "bot");
        assert_eq!(parse_device("python-requests/2.31"), "bot");
        assert_eq!(
            parse_device("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
            "desktop"
        );
    }
}
