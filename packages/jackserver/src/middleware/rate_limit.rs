//! 固定窗口、单 IP 的内存限流器。
//!
//! 用于打点端点防刷量。实例在 `app()` 中创建一次，`Clone`（内部 `Arc`）共享计数。
//! 窗口时长由调用方传入（来自配置 `metrics.rate_limit` 的解析结果）。

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::Mutex;

#[derive(Clone, Default)]
pub struct RateLimiter {
    inner: Arc<Mutex<HashMap<String, (Instant, u32)>>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self::default()
    }

    /// 判断 `key`（通常为客户端 IP）在当前 `window` 窗口内是否仍可放行。
    /// 窗口过期则自动重置。返回 true 表示放行并已计数 +1。
    /// `max == 0` 时显式全部拒绝。
    pub async fn allow(&self, key: &str, max: u32, window: Duration) -> bool {
        if max == 0 {
            return false; // 显式禁用：全部拒绝
        }
        let now = Instant::now();
        let mut map = self.inner.lock().await;
        let entry = map.entry(key.to_string()).or_insert((now, 0));
        if now.duration_since(entry.0) >= window {
            *entry = (now, 1);
            true
        } else if entry.1 < max {
            entry.1 += 1;
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_allows_up_to_max_then_blocks() {
        let limiter = RateLimiter::new();
        let win = Duration::from_secs(60);
        assert!(limiter.allow("1.1.1.1", 2, win).await);
        assert!(limiter.allow("1.1.1.1", 2, win).await);
        assert!(!limiter.allow("1.1.1.1", 2, win).await);
    }

    #[tokio::test]
    async fn test_independent_keys() {
        let limiter = RateLimiter::new();
        let win = Duration::from_secs(60);
        assert!(limiter.allow("a", 1, win).await);
        assert!(limiter.allow("b", 1, win).await);
        assert!(!limiter.allow("a", 1, win).await);
    }

    #[tokio::test]
    async fn test_zero_max_blocks_all() {
        let limiter = RateLimiter::new();
        assert!(!limiter.allow("x", 0, Duration::from_secs(60)).await);
    }

    #[tokio::test]
    async fn test_custom_window_resets_after_expiry() {
        // 窗口 50ms、每窗口最多 1 次：连发 2 次第二次应被拒；过期后重新放行。
        let limiter = RateLimiter::new();
        let win = Duration::from_millis(50);
        assert!(limiter.allow("k", 1, win).await);
        assert!(!limiter.allow("k", 1, win).await);
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert!(limiter.allow("k", 1, win).await);
    }
}
