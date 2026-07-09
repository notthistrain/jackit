//! 固定窗口、单 IP、按分钟计数的内存限流器。
//!
//! 用于打点端点防刷量。实例在 `app()` 中创建一次，`Clone`（内部 `Arc`）共享计数。

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::Mutex;

const WINDOW: Duration = Duration::from_secs(60);

#[derive(Clone, Default)]
pub struct RateLimiter {
    inner: Arc<Mutex<HashMap<String, (Instant, u32)>>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self::default()
    }

    /// 判断 `key`（通常为客户端 IP）在当前 1 分钟窗口内是否仍可放行。
    /// 窗口过期则自动重置。返回 true 表示放行并已计数 +1。
    pub async fn allow(&self, key: &str, max_per_minute: u32) -> bool {
        if max_per_minute == 0 {
            return false; // 显式禁用：全部拒绝
        }
        let now = Instant::now();
        let mut map = self.inner.lock().await;
        let entry = map.entry(key.to_string()).or_insert((now, 0));
        if now.duration_since(entry.0) >= WINDOW {
            *entry = (now, 1);
            true
        } else if entry.1 < max_per_minute {
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
        assert!(limiter.allow("1.1.1.1", 2).await);
        assert!(limiter.allow("1.1.1.1", 2).await);
        assert!(!limiter.allow("1.1.1.1", 2).await);
    }

    #[tokio::test]
    async fn test_independent_keys() {
        let limiter = RateLimiter::new();
        assert!(limiter.allow("a", 1).await);
        assert!(limiter.allow("b", 1).await);
        assert!(!limiter.allow("a", 1).await);
    }

    #[tokio::test]
    async fn test_zero_max_blocks_all() {
        let limiter = RateLimiter::new();
        assert!(!limiter.allow("x", 0).await);
    }
}
