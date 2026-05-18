mod config;
mod db;
mod error;
mod model;

use axum::{routing::get, Router};
use error::ResDTO;

async fn health() -> axum::Json<ResDTO<serde_json::Value>> {
    axum::Json(ResDTO::ok(serde_json::json!({ "status": "ok" })))
}

#[tokio::main]
async fn main() {
    let config = config::AppConfig::load_or_default();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rustserver=info".into()),
        )
        .init();

    let app = Router::new()
        .route("/api/health", get(health));

    let addr = format!("127.0.0.1:{}", config.server.port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app)
        .await
        .unwrap();
}
