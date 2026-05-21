#[tauri::command]
pub fn log_debug(module: String, message: String) {
    tracing::debug!("[前端:{module}] {message}");
}

#[tauri::command]
pub fn log_info(module: String, message: String) {
    tracing::info!("[前端:{module}] {message}");
}

#[tauri::command]
pub fn log_warn(module: String, message: String) {
    tracing::warn!("[前端:{module}] {message}");
}

#[tauri::command]
pub fn log_error(module: String, message: String) {
    tracing::error!("[前端:{module}] {message}");
}
