pub mod health;
pub mod message;
pub mod metrics;
pub mod publish;
pub mod tools;

use axum::http::{header, HeaderValue, Method};
use axum::{middleware as axum_mw, routing::get, routing::post, Router};
use sqlx::SqlitePool;
use tower_http::cors::CorsLayer;

use crate::config::MetricsConfig;
use crate::middleware::message::check_message;
use crate::middleware::rate_limit::RateLimiter;
use crate::middleware::track::{check_report, check_track, ReportGuard, TrackGuard};

/// 构建完整的 app 路由。
///
/// 顶层 Router state 保持 `SqlitePool`（现有 health/publish/tools 的 State 提取不变）。
/// - 打点 `/api/metrics/track`：来源白名单 + HMAC 签名 + 时间戳 + 单 IP 限流
/// - 报表 `/api/metrics/{overview,paths,sources}`：**无鉴权**，仅单 IP 限流（防滥用）
pub fn app(pool: SqlitePool, publish_token: String, metrics: MetricsConfig) -> Router {
    let allowed_origins = metrics.allowed_origins.clone();
    let (rate_limit_max, rate_limit_window) = metrics
        .parse_rate_limit()
        .unwrap_or_else(|e| panic!("invalid metrics.rate_limit: {e}"));
    let track_guard = TrackGuard {
        metrics: metrics.clone(),
        limiter: RateLimiter::new(),
        rate_limit_max,
        rate_limit_window,
    };
    let report_guard = ReportGuard {
        limiter: RateLimiter::new(),
    };
    // 留言提交用独立限流器（同一份 secret/origins，但配额不与 track 互相挤占）
    let message_guard = TrackGuard {
        metrics: metrics.clone(),
        limiter: RateLimiter::new(),
        rate_limit_max,
        rate_limit_window,
    };

    // 打点：POST /api/metrics/track（半鉴权）
    let track_routes = Router::new()
        .route("/track", post(metrics::track))
        .layer(axum_mw::from_fn_with_state(track_guard.clone(), check_track));

    // 报表查询：GET /api/metrics/{overview,paths,sources}（无鉴权，仅限流）
    let report_routes = Router::new()
        .route("/overview", get(metrics::overview))
        .route("/paths", get(metrics::paths))
        .route("/sources", get(metrics::sources))
        .layer(axum_mw::from_fn_with_state(report_guard.clone(), check_report));

    let metrics_routes = track_routes.merge(report_routes);

    let publish_routes =
        Router::new()
            .route("/github", post(publish::github))
            .layer(axum_mw::from_fn_with_state(
                publish_token.clone(),
                crate::middleware::auth::require_token,
            ));

    let tools_routes = Router::new()
        .route("/", get(tools::list_software))
        .route("/download/{id}", get(tools::download_by_id))
        .route("/download-latest/{name}", get(tools::download_latest));

    // 留言：按站点收集用户反馈，三组路由分别套用不同中间件
    // - /submit：半鉴权（共用 track 的 secret/origins，但独立限流器，配额不与 track 互相挤占）
    // - /list  ：admin token（仅站长在管理后台查询，复用 publish_token）
    // - /admin/*：admin token（复用 publish_token）
    let message_submit_routes = Router::new()
        .route("/submit", post(message::submit))
        .layer(axum_mw::from_fn_with_state(message_guard.clone(), check_message));
    let message_list_routes = Router::new()
        .route("/list", get(message::list))
        .layer(axum_mw::from_fn_with_state(
            publish_token.clone(),
            crate::middleware::auth::require_token,
        ));
    let message_admin_routes = Router::new()
        .route("/consume", post(message::consume))
        .layer(axum_mw::from_fn_with_state(
            publish_token,
            crate::middleware::auth::require_token,
        ));
    let messages_routes = message_submit_routes
        .merge(message_list_routes)
        .nest("/admin", message_admin_routes);

    let api_routes = Router::new()
        .route("/health", get(health::health))
        .nest("/publish", publish_routes)
        .nest("/tools", tools_routes)
        .nest("/metrics", metrics_routes)
        .nest("/messages", messages_routes);

    Router::new()
        .nest("/api", api_routes)
        .layer(build_cors(&allowed_origins))
        .layer(axum_mw::from_fn(crate::middleware::log::request_log))
        .with_state(pool)
}

/// 构建 CORS 层：仅放行配置的白名单来源；未配置则不允许任何跨域。
fn build_cors(allowed_origins: &[String]) -> CorsLayer {
    let origins: Vec<HeaderValue> = allowed_origins
        .iter()
        .filter_map(|o| HeaderValue::from_str(o).ok())
        .collect();
    let mut layer = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE]);
    if !origins.is_empty() {
        layer = layer.allow_origin(origins);
    }
    layer
}
