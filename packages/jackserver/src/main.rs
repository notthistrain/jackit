use jackserver::{config, db, handler};

#[tokio::main]
async fn main() {
    let config = config::AppConfig::load_or_default();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "jackserver=info".into()),
        )
        .init();

    tracing::info!("Starting jackserver...");

    let pool = db::init_pool(&config.database.path)
        .await
        .expect("Failed to initialize database");

    let app = handler::app(pool, config.publish.token.clone());

    let addr = format!("127.0.0.1:{}", config.server.port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c().await.unwrap();
}
