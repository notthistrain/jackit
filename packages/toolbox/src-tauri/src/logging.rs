use std::path::Path;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// 初始化 tracing 日志系统
/// 返回 WorkerGuard，必须保持存活直到应用退出
pub fn init(app_name: &str, log_dir: &Path) -> WorkerGuard {
    std::fs::create_dir_all(log_dir).ok();

    let file_appender = rolling::daily(log_dir, format!("{app_name}.log"));
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = if cfg!(debug_assertions) {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("info")
    };

    let file_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false);

    // dev 模式同时输出到 stdout，release 模式仅写文件
    let stdout_layer = if cfg!(debug_assertions) {
        Some(fmt::layer().with_writer(std::io::stdout))
    } else {
        None
    };

    tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer)
        .with(stdout_layer)
        .init();

    guard
}

/// 获取 toolbox 日志目录: ~/.jackit/toolbox/log/
pub fn get_log_dir() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".jackit").join("toolbox").join("log")
}
