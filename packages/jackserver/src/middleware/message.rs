//! 留言提交中间件：来源白名单 + HMAC 签名 + 时间戳防重放 + 单 IP 限流。
//!
//! 与 [`crate::middleware::track::check_track`] 共用 [`MetricsConfig`]
//! （`track_secret` / `allowed_origins` / `rate_limit`），但 body 解析为
//! [`MessageInput`]，注入 [`MessageData`] 到请求 extensions。
//!
//! 安全说明与打点一致：签名仅提高伪造门槛，真正兜底是限流。

use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::{to_bytes, Body};
use axum::extract::{Request, State};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::error::{AppError, ResDTO};
use crate::middleware::track::{client_ip, request_origin, verify_sig, TrackGuard, TS_FRESH_WINDOW_SECS};
use crate::model::{MessageData, MessageInput};

/// 留言请求体最大字节数（留言内容可能较长，给 128KB）。
const MAX_MESSAGE_BODY_BYTES: usize = 128 * 1024;
/// 留言 nickname / content 字段长度上限（按字符数计）。
const MAX_NICKNAME_LEN: usize = 64;
const MAX_CONTENT_LEN: usize = 4096;

/// 留言提交中间件，复用 [`TrackGuard`]（同样的 metrics 配置 + 限流器 + 限流参数）。
///
/// 校验通过后把 [`MessageData`] 注入请求 extensions，由 [`crate::handler::message::submit`]
/// 取出落库。
pub async fn check_message(
    State(guard): State<TrackGuard>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    // 模块禁用：直接返回成功但不落库（与 track 行为一致）
    if !guard.metrics.enabled {
        return Ok(Json(ResDTO::ok(serde_json::json!({ "ok": true }))).into_response());
    }

    // 来源白名单（与 track 复用同一份 allowed_origins）
    let origin = request_origin(req.headers());
    let allowed = guard
        .metrics
        .allowed_origins
        .iter()
        .any(|o| Some(o.as_str()) == origin.as_deref());
    if !allowed {
        tracing::warn!(?origin, "message rejected: origin not allowed");
        return Err(AppError::BadRequest("origin not allowed".to_string()));
    }

    // 提前读取 IP / UA（into_parts 会消费 req）
    let ip = client_ip(req.headers()).or_else(|| {
        req.extensions()
            .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
            .map(|ci| ci.0.ip().to_string())
    });
    let ua = req
        .headers()
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // 读取并解析 body
    let (parts, body) = req.into_parts();
    let bytes = to_bytes(body, MAX_MESSAGE_BODY_BYTES)
        .await
        .map_err(|e| AppError::Internal(format!("read message body: {e}")))?;
    let input: MessageInput = serde_json::from_slice(&bytes)
        .map_err(|e| AppError::BadRequest(format!("invalid message body: {e}")))?;

    if input.site.is_empty() || input.nickname.is_empty() || input.content.is_empty() {
        return Err(AppError::BadRequest(
            "missing site / nickname / content".to_string(),
        ));
    }
    if input.nickname.chars().count() > MAX_NICKNAME_LEN
        || input.content.chars().count() > MAX_CONTENT_LEN
    {
        return Err(AppError::BadRequest(
            "nickname or content too long".to_string(),
        ));
    }

    // 时间戳新鲜度（防重放）
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    if (now - input.ts).abs() > TS_FRESH_WINDOW_SECS {
        tracing::warn!(ts = input.ts, now, "message rejected: stale timestamp");
        return Err(AppError::BadRequest("stale timestamp".to_string()));
    }

    // HMAC 签名校验（拼接规则与 track 一致：site|path|ts，path 缺失按空串）
    let path_for_sig = input.path.as_deref().unwrap_or("");
    if !verify_sig(
        &guard.metrics.track_secret,
        &input.site,
        path_for_sig,
        input.ts,
        &input.sig,
    ) {
        tracing::warn!(site = %input.site, "message rejected: invalid signature");
        return Err(AppError::BadRequest("invalid signature".to_string()));
    }

    // 单 IP 限流（与 track 共用同一限流器实例，配额也共享）
    let ip_key = ip.clone().unwrap_or_else(|| "unknown".to_string());
    if !guard
        .limiter
        .allow(&ip_key, guard.rate_limit_max, guard.rate_limit_window)
        .await
    {
        tracing::warn!(ip = %ip_key, "message rejected: rate limit");
        return Err(AppError::TooManyRequests("rate limit exceeded".to_string()));
    }

    // 校验通过：注入 MessageData（submit 只读 Extension，不读 body，无需还原）
    let mut req = Request::from_parts(parts, Body::empty());
    req.extensions_mut().insert(MessageData { input, ip, ua });
    Ok(next.run(req).await)
}
