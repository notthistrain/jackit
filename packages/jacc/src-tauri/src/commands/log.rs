use std::sync::OnceLock;
use std::time::Instant;
use parking_lot::Mutex;

struct TokenBucket {
    last_flush: Instant,
    count_in_window: u32,
    window_start: Instant,
    dropped: u32,
}

static FRONTEND_LOG_BUCKET: OnceLock<Mutex<TokenBucket>> = OnceLock::new();

fn bucket() -> &'static Mutex<TokenBucket> {
    FRONTEND_LOG_BUCKET.get_or_init(|| {
        Mutex::new(TokenBucket {
            last_flush: Instant::now(),
            count_in_window: 0,
            window_start: Instant::now(),
            dropped: 0,
        })
    })
}

/// 返回 true 表示放行，false 表示丢弃
fn check_rate_limit() -> bool {
    let mut b = bucket().lock();
    let now = Instant::now();

    // 5s 一次 flush
    if now.duration_since(b.last_flush) > std::time::Duration::from_secs(5) && b.dropped > 0 {
        tracing::warn!(target: "frontend", dropped = b.dropped, "frontend log rate-limited");
        b.dropped = 0;
        b.last_flush = now;
    }

    // 1s 滑动窗口
    if now.duration_since(b.window_start) > std::time::Duration::from_secs(1) {
        b.window_start = now;
        b.count_in_window = 0;
    }

    if b.count_in_window >= 100 {
        b.dropped += 1;
        false
    } else {
        b.count_in_window += 1;
        true
    }
}

#[tauri::command]
pub fn log_debug(module: String, message: String) {
    if check_rate_limit() {
        tracing::debug!(target: "frontend", module = %module, "{}", message);
    }
}

#[tauri::command]
pub fn log_info(module: String, message: String) {
    if check_rate_limit() {
        tracing::info!(target: "frontend", module = %module, "{}", message);
    }
}

#[tauri::command]
pub fn log_warn(module: String, message: String) {
    if check_rate_limit() {
        tracing::warn!(target: "frontend", module = %module, "{}", message);
    }
}

#[tauri::command]
pub fn log_error(module: String, message: String) {
    if check_rate_limit() {
        tracing::error!(target: "frontend", module = %module, "{}", message);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_debug_does_not_panic() {
        log_debug("test-module".to_string(), "debug message".to_string());
    }

    #[test]
    fn log_info_does_not_panic() {
        log_info("test-module".to_string(), "info message".to_string());
    }

    #[test]
    fn log_warn_does_not_panic() {
        log_warn("test-module".to_string(), "warn message".to_string());
    }

    #[test]
    fn log_error_does_not_panic() {
        log_error("test-module".to_string(), "error message".to_string());
    }

    #[test]
    fn log_commands_handle_empty_strings() {
        log_debug(String::new(), String::new());
        log_info(String::new(), String::new());
        log_warn(String::new(), String::new());
        log_error(String::new(), String::new());
    }

    #[test]
    fn log_commands_handle_unicode() {
        log_info("模块".to_string(), "中文消息 🎉".to_string());
        log_warn("モジュール".to_string(), "日本語メッセージ".to_string());
        log_error("module".to_string(), "émojis: 🔥💀".to_string());
    }
}
