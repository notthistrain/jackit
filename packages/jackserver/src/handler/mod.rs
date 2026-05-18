pub mod health;
pub mod publish;
pub mod tools;

use axum::{routing::{get, post}, Router, middleware as axum_mw};
use sqlx::SqlitePool;

/// 构建完整的 app 路由
pub fn app(pool: SqlitePool, publish_token: String) -> Router {
    let publish_routes = Router::new()
        .route("/github", post(publish::github))
        .layer(axum_mw::from_fn_with_state(
            publish_token,
            crate::middleware::auth::require_token,
        ));

    let tools_routes = Router::new()
        .route("/", get(tools::list_software))
        .route("/download/{id}", get(tools::download_by_id))
        .route("/download-latest/{name}", get(tools::download_latest));

    let api_routes = Router::new()
        .route("/health", get(health::health))
        .nest("/publish", publish_routes)
        .nest("/tools", tools_routes);

    Router::new()
        .nest("/api", api_routes)
        .layer(axum_mw::from_fn(crate::middleware::log::request_log))
        .with_state(pool)
}
