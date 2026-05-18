mod config;
mod db;
mod error;
mod handler;
mod middleware;
mod model;

use axum::{middleware as axum_mw, routing::{get, post}, Router};

#[tokio::main]
async fn main() {
    let config = config::AppConfig::load_or_default();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rustserver=info".into()),
        )
        .init();

    tracing::info!("Starting rustserver...");

    let pool = db::init_pool(&config.database.path)
        .await
        .expect("Failed to initialize database");
    tracing::info!("Database initialized");

    let publish_token = config.publish.token.clone();
    let port = config.server.port;

    let publish_routes = Router::new()
        .route("/github", post(handler::publish::github))
        .layer(axum_mw::from_fn_with_state(
            publish_token,
            middleware::auth::require_token,
        ));

    let app = Router::new()
        .route("/api/health", get(handler::health::health))
        .nest("/api/publish", publish_routes)
        .with_state(pool);

    let addr = format!("127.0.0.1:{}", port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    tokio::spawn(async {
        tokio::signal::ctrl_c().await.unwrap();
        tracing::info!("Shutdown signal received");
    });

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c().await.unwrap();
}
