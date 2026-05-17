#[tauri::command]
pub fn log_debug(module: String, message: String) {
    tracing::debug!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
pub fn log_info(module: String, message: String) {
    tracing::info!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
pub fn log_warn(module: String, message: String) {
    tracing::warn!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
pub fn log_error(module: String, message: String) {
    tracing::error!(target: "frontend", "[{}] {}", module, message);
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
