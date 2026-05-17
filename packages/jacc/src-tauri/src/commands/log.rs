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
