use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response;

/// 请求日志中间件：记录 method、path、耗时、状态码
pub async fn request_log(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let start = std::time::Instant::now();

    let response = next.run(req).await;

    let elapsed = start.elapsed();
    let status = response.status().as_u16();

    tracing::info!(
        method = %method,
        path = %path,
        status = status,
        elapsed_ms = elapsed.as_millis() as u64,
        "request completed"
    );

    response
}
