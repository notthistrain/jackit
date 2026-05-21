use std::path::PathBuf;

use tracing_subscriber::EnvFilter;

/// 日志守卫 — 保持 alive 直到应用退出
pub struct LogGuard {
    _guard: tracing_appender::non_blocking::WorkerGuard,
}

/// 初始化日志系统（新版：统一 tracing）
///
/// 返回 LogGuard 必须注册为 Tauri managed state 以保持存活
pub fn init_logging(app_name: &str) -> LogGuard {
    let log_dir = ensure_log_dir(app_name);
    let file_appender = tracing_appender::rolling::daily(&log_dir, "jackcom.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_writer(non_blocking)
        .with_ansi(false)
        .init();

    tracing::info!("日志系统初始化完成: {}", log_dir.display());

    LogGuard { _guard: guard }
}

fn ensure_log_dir(app_name: &str) -> PathBuf {
    let dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".jackit")
        .join("toolbox")
        .join("tools")
        .join(app_name)
        .join("log");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn ensure_log_dir_returns_correct_path() {
        let log_dir = ensure_log_dir("jackcom");
        let home = dirs::home_dir().unwrap();
        assert_eq!(
            log_dir,
            home.join(".jackit").join("toolbox").join("tools").join("jackcom").join("log")
        );
    }

    #[test]
    fn ensure_log_dir_ends_with_log() {
        let log_dir = ensure_log_dir("jackcom");
        assert_eq!(log_dir.file_name().unwrap(), "log");
    }

    #[test]
    fn init_creates_dir_and_writes_log_file() {
        // init_logging creates ~/.jackit/toolbox/tools/jackcom-test/log/
        let log_dir = ensure_log_dir("jackcom-test");
        // Clean up any previous test artifacts
        let _ = std::fs::remove_dir_all(&log_dir);

        let guard = init_logging("jackcom-test");

        assert!(log_dir.exists());
        assert!(log_dir.is_dir());

        tracing::info!("test message");
        drop(guard);

        let entries: Vec<_> = fs::read_dir(&log_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert!(!entries.is_empty(), "log directory should contain at least one file");
    }
}
