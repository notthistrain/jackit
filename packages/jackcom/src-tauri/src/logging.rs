use std::path::PathBuf;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

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

// ============================================================
// 旧版 API — 向后兼容，Plan 5 清理时移除
// ============================================================

/// 初始化 tracing 日志系统（旧版）
/// 返回 WorkerGuard，必须保持存活直到应用退出
pub fn init(app_name: &str, log_dir: &std::path::Path) -> tracing_appender::non_blocking::WorkerGuard {
    std::fs::create_dir_all(log_dir).ok();

    let file_appender = tracing_appender::rolling::daily(log_dir, format!("{app_name}.log"));
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = if cfg!(debug_assertions) {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("info")
    };

    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false);

    // dev 模式同时输出到 stdout，release 模式仅写文件
    let stdout_layer = if cfg!(debug_assertions) {
        Some(tracing_subscriber::fmt::layer().with_writer(std::io::stdout))
    } else {
        None
    };

    tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer)
        .with(stdout_layer)
        .try_init()
        .ok();

    guard
}

/// 获取 jackcom 日志目录: ~/.jackit/toolbox/tools/jackcom/log/
pub fn get_log_dir() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| {
        eprintln!("warning: could not determine home directory, using current directory for logs");
        std::path::PathBuf::from(".")
    });
    home.join(".jackit").join("toolbox").join("tools").join("jackcom").join("log")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn get_log_dir_returns_correct_path() {
        let log_dir = get_log_dir();
        let home = dirs::home_dir().unwrap();
        assert_eq!(
            log_dir,
            home.join(".jackit").join("toolbox").join("tools").join("jackcom").join("log")
        );
    }

    #[test]
    fn get_log_dir_ends_with_log() {
        let log_dir = get_log_dir();
        assert_eq!(log_dir.file_name().unwrap(), "log");
    }

    #[test]
    fn init_creates_dir_and_writes_log_file() {
        let tmp = tempfile::tempdir().unwrap();
        let log_dir = tmp.path().join("log");
        assert!(!log_dir.exists());

        let guard = init("jackcom-test", &log_dir);

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
