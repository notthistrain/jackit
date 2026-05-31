use std::sync::Mutex;
use tauri::State;
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn set_active_project(
    watcher: State<'_, Mutex<crate::settings_watcher::SettingsWatcher>>,
    path: Option<String>,
) -> AppResult<()> {
    log_command!("set_active_project", {
        let project_path = match path {
            None => None,
            Some(s) if s.is_empty() => None,
            Some(s) => {
                let canonical = crate::path_guard::validate_project_path(&s)?;
                Some(crate::claude_settings::project_settings_path(&canonical))
            }
        };
        let mut w = watcher.lock().map_err(|e| AppError::Custom(format!("watcher lock: {e}")))?;
        w.set_active_project(project_path).map_err(|e| AppError::Custom(format!("watcher: {e}")))?;
        Ok(())
    })
}
