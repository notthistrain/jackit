//! 打点上报中间件：来源白名单 + HMAC 签名 + 时间戳防重放 + 单 IP 限流。
//!
//! 安全说明：前端 track_secret 可被逆向抠出，签名仅提高伪造门槛、不保证防伪；
//! 真正兜底是限流（RateLimiter）。详见 plan「安全说明」一节。

use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::{to_bytes, Body};
use axum::extract::{Request, State};
use axum::http::HeaderMap;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use hmac::{Hmac, Mac};
use sha2::Sha256;

use crate::config::MetricsConfig;
use crate::error::{AppError, ResDTO};
use crate::middleware::auth::constant_time_eq;
use crate::middleware::rate_limit::RateLimiter;
use crate::model::{TrackInput, TrackedData};

type HmacSha256 = Hmac<Sha256>;

/// 打点时间戳允许的偏差（秒），超出视为重放/时钟错乱，拒绝。
const TS_FRESH_WINDOW_SECS: i64 = 300;
/// 打点请求体最大字节数。
const MAX_BODY_BYTES: usize = 64 * 1024;

/// 打点中间件持有的状态：metrics 配置 + 共享限流器。
#[derive(Clone)]
pub struct TrackGuard {
    pub metrics: MetricsConfig,
    pub limiter: RateLimiter,
}

pub async fn check_track(
    State(guard): State<TrackGuard>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    // 模块禁用：直接返回成功但不落库
    if !guard.metrics.enabled {
        return Ok(axum::Json(ResDTO::ok(serde_json::json!({ "ok": true }))).into_response());
    }

    // 来源白名单（Origin 优先，缺失时从 Referer 解析 scheme://host）
    let origin = request_origin(req.headers());
    let allowed = guard
        .metrics
        .allowed_origins
        .iter()
        .any(|o| Some(o.as_str()) == origin.as_deref());
    if !allowed {
        tracing::warn!(?origin, "track rejected: origin not allowed");
        return Err(AppError::BadRequest("origin not allowed".to_string()));
    }

    // 提前读取 IP / UA（into_parts 会消费 req）。
    // IP 优先取反代头（X-Forwarded-For / X-Real-IP），缺失时回退到 TCP 连接对端地址：
    // 反代场景下是反代的 IP（如 127.0.0.1），直连场景是真实客户端 IP。
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
    let bytes = to_bytes(body, MAX_BODY_BYTES)
        .await
        .map_err(|e| AppError::Internal(format!("read track body: {e}")))?;
    let input: TrackInput = serde_json::from_slice(&bytes)
        .map_err(|e| AppError::BadRequest(format!("invalid track body: {e}")))?;

    if input.site.is_empty() || input.path.is_empty() {
        return Err(AppError::BadRequest("missing site or path".to_string()));
    }

    // 时间戳新鲜度（防重放）
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    if (now - input.ts).abs() > TS_FRESH_WINDOW_SECS {
        tracing::warn!(ts = input.ts, now, "track rejected: stale timestamp");
        return Err(AppError::BadRequest("stale timestamp".to_string()));
    }

    // HMAC 签名校验
    if !verify_sig(
        &guard.metrics.track_secret,
        &input.site,
        &input.path,
        input.ts,
        &input.sig,
    ) {
        tracing::warn!(site = %input.site, "track rejected: invalid signature");
        return Err(AppError::BadRequest("invalid signature".to_string()));
    }

    // 单 IP 限流
    let ip_key = ip.clone().unwrap_or_else(|| "unknown".to_string());
    if !guard
        .limiter
        .allow(&ip_key, guard.metrics.rate_limit_per_minute)
        .await
    {
        tracing::warn!(ip = %ip_key, "track rejected: rate limit");
        return Err(AppError::TooManyRequests("rate limit exceeded".to_string()));
    }

    // 校验通过：把数据注入 extensions 交给 handler，并还原 body（handler 不再读 body）
    let mut req = Request::from_parts(parts, Body::from(bytes));
    req.extensions_mut().insert(TrackedData { input, ip, ua });
    Ok(next.run(req).await)
}

/// 校验 HMAC-SHA256 签名。拼接规则必须与前端 SDK 完全一致：`{site}|{path}|{ts}`，hex 输出。
fn verify_sig(secret: &str, site: &str, path: &str, ts: i64, sig: &str) -> bool {
    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(m) => m,
        Err(_) => return false,
    };
    mac.update(format!("{site}|{path}|{ts}").as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());
    constant_time_eq(expected.as_bytes(), sig.as_bytes())
}

/// 取请求来源：优先 Origin 头，缺失时从 Referer 解析 scheme://host。
fn request_origin(headers: &HeaderMap) -> Option<String> {
    if let Some(o) = headers.get("origin").and_then(|v| v.to_str().ok()) {
        let o = o.trim();
        if !o.is_empty() {
            return Some(o.to_string());
        }
    }
    let referer = headers.get("referer").and_then(|v| v.to_str().ok())?;
    extract_origin_from_url(referer)
}

/// 从 `scheme://host/path...` 中提取 `scheme://host`。
fn extract_origin_from_url(url: &str) -> Option<String> {
    let scheme_end = url.find("://")?;
    let scheme = &url[..scheme_end];
    let rest = &url[scheme_end + 3..];
    let host_end = rest.find('/').unwrap_or(rest.len());
    let host = &rest[..host_end];
    if scheme.is_empty() || host.is_empty() {
        return None;
    }
    Some(format!("{scheme}://{host}"))
}

/// 取客户端真实 IP：优先 X-Forwarded-For 首段，其次 X-Real-IP。
pub(crate) fn client_ip(headers: &HeaderMap) -> Option<String> {
    if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first) = xff.split(',').next() {
            let ip = first.trim();
            if !ip.is_empty() {
                return Some(ip.to_string());
            }
        }
    }
    headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_string())
}

// ===== 报表查询限流（无鉴权，仅按 IP 限流防滥用）=====

/// 报表查询限流中间件持有的状态（独立限流器实例，与打点互不影响）。
#[derive(Clone)]
pub struct ReportGuard {
    pub limiter: RateLimiter,
}

/// 报表查询的每分钟上限（按 IP）。报表为只读聚合，给一个宽松阈值防爬即可。
const REPORT_RATE_LIMIT_PER_MINUTE: u32 = 60;

/// 报表查询限流：单 IP 每分钟最多 `REPORT_RATE_LIMIT_PER_MINUTE` 次查询。
pub async fn check_report(
    State(guard): State<ReportGuard>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let ip = client_ip(req.headers()).or_else(|| {
        req.extensions()
            .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
            .map(|ci| ci.0.ip().to_string())
    });
    let ip_key = ip.clone().unwrap_or_else(|| "unknown".to_string());
    if !guard
        .limiter
        .allow(&ip_key, REPORT_RATE_LIMIT_PER_MINUTE)
        .await
    {
        tracing::warn!(ip = %ip_key, "report rejected: rate limit");
        return Err(AppError::TooManyRequests("rate limit exceeded".to_string()));
    }
    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_origin_from_url() {
        assert_eq!(
            extract_origin_from_url("https://blog.example.com/post/1").as_deref(),
            Some("https://blog.example.com")
        );
        assert_eq!(
            extract_origin_from_url("http://a.b.c").as_deref(),
            Some("http://a.b.c")
        );
        assert!(extract_origin_from_url("not-a-url").is_none());
    }

    #[test]
    fn test_verify_sig_roundtrip() {
        // 与前端 SDK 一致的拼接：site|path|ts
        let secret = "s3cret";
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(b"blog|/post|1700000000");
        let sig = hex::encode(mac.finalize().into_bytes());
        assert!(verify_sig(secret, "blog", "/post", 1700000000, &sig));
        // 错误签名 / 错误密钥 / 篡改字段 都应失败
        assert!(!verify_sig(secret, "blog", "/post", 1700000000, "deadbeef"));
        assert!(!verify_sig("wrong", "blog", "/post", 1700000000, &sig));
        assert!(!verify_sig(secret, "blog", "/tampered", 1700000000, &sig));
    }
}
