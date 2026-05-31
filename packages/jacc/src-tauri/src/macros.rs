/// 为 Tauri 命令自动记录入口/出口/耗时/成功/失败的宏。
///
/// 读操作用法（debug 级别）：
///   log_read_command!("command_name", { some_inner().await })
///
/// 写操作用法（info 级别，在宏内加手动日志）：
///   log_write_command!("command_name", {
///       let result = some_inner().await?;
///       tracing::info!(id = result.id, "resource created");
///       Ok(result)
///   })
/// 读命令宏：debug 级别日志
#[macro_export]
macro_rules! log_read_command {
    ($name:expr, $($body:tt)*) => {{
        let start = std::time::Instant::now();
        tracing::debug!(command = $name, "→ invoked");
        let result = async { $($body)* }.await;
        let elapsed = start.elapsed();
        match &result {
            Ok(_) => tracing::debug!(
                command = $name,
                elapsed_ms = elapsed.as_millis() as u64,
                "✓ completed"
            ),
            Err(e) => tracing::warn!(
                command = $name,
                elapsed_ms = elapsed.as_millis() as u64,
                error = %e,
                "✗ failed"
            ),
        }
        result
    }};
}

/// 写命令宏：info 级别日志
#[macro_export]
macro_rules! log_write_command {
    ($name:expr, $($body:tt)*) => {{
        let start = std::time::Instant::now();
        tracing::info!(command = $name, "→ invoked");
        let result = async { $($body)* }.await;
        let elapsed = start.elapsed();
        match &result {
            Ok(_) => tracing::info!(
                command = $name,
                elapsed_ms = elapsed.as_millis() as u64,
                "✓ completed"
            ),
            Err(e) => tracing::warn!(
                command = $name,
                elapsed_ms = elapsed.as_millis() as u64,
                error = %e,
                "✗ failed"
            ),
        }
        result
    }};
}

/// 兼容老调用，保留 log_command! 等同 log_write_command!
#[macro_export]
macro_rules! log_command {
    ($($t:tt)*) => { $crate::log_write_command!($($t)*) };
}
