pub mod config;
pub mod db;
pub mod error;
pub mod handler;
pub mod middleware;
pub mod model;

use axum::Router;
use sqlx::SqlitePool;

/// Build a test app for integration tests.
/// Not behind #[cfg(test)] because integration tests in tests/ cannot access #[cfg(test)] items.
pub fn test_app(pool: SqlitePool) -> Router {
    use axum::routing::{get, post};
    use axum::middleware as axum_mw;

    let publish_token = "test-token".to_string();

    let publish_routes = Router::new()
        .route("/github", post(handler::publish::github))
        .layer(axum_mw::from_fn_with_state(
            publish_token,
            middleware::auth::require_token,
        ));

    let tools_routes = Router::new()
        .route("/", get(handler::tools::list_software))
        .route("/download/{id}", get(handler::tools::download_by_id))
        .route("/download-latest/{name}", get(handler::tools::download_latest));

    Router::new()
        .route("/api/health", get(handler::health::health))
        .nest("/api/publish", publish_routes)
        .nest("/api/tools", tools_routes)
        .layer(axum_mw::from_fn(middleware::log::request_log))
        .with_state(pool)
}
