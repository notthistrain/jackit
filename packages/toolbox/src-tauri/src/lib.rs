mod config;
mod db;
mod fs;
mod logging;
mod sync;
mod updater;

use tauri::{Emitter, Manager};
use tracing_appender::non_blocking::WorkerGuard;

struct LogGuard(WorkerGuard);

struct AppState {
    db: db::Database,
    cfg: config::Config,
}

#[tauri::command]
fn log_info(module: String, message: String) {
    tracing::info!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
fn log_warn(module: String, message: String) {
    tracing::warn!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
fn log_error(module: String, message: String) {
    tracing::error!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
fn config_get(state: tauri::State<AppState>, key: String) -> Result<serde_json::Value, String> {
    let cfg_json = serde_json::to_value(&state.cfg).map_err(|e| e.to_string())?;
    cfg_json.get(&key).cloned().ok_or_else(|| format!("key '{}' not found", key))
}

#[tauri::command]
fn config_set(state: tauri::State<AppState>, key: String, value: serde_json::Value) -> Result<(), String> {
    let mut cfg = state.cfg.clone();
    let parts: Vec<&str> = key.split('.').collect();

    if parts.len() == 2 {
        match parts[0] {
            "app" => {
                if parts[1] == "name" {
                    cfg.app.name = value.as_str().ok_or("invalid string value")?.to_string();
                } else if parts[1] == "environment" {
                    cfg.app.environment = value.as_str().ok_or("invalid string value")?.to_string();
                }
            }
            "tool" => {
                if parts[1] == "install_path" {
                    cfg.tool.install_path = value.as_str().ok_or("invalid string value")?.to_string();
                }
            }
            "server" => {
                if parts[1] == "address" {
                    cfg.server.address = value.as_str().ok_or("invalid string value")?.to_string();
                } else if parts[1] == "s3_port" {
                    cfg.server.s3_port = value.as_i64().ok_or("invalid integer value")? as i32;
                } else if parts[1] == "manual_path" {
                    cfg.server.manual_path = value.as_str().ok_or("invalid string value")?.to_string();
                }
            }
            "database" => {
                if parts[1] == "db_type" {
                    cfg.database.db_type = value.as_str().ok_or("invalid string value")?.to_string();
                } else if parts[1] == "path" {
                    cfg.database.path = value.as_str().ok_or("invalid string value")?.to_string();
                }
            }
            "log" => {
                if parts[1] == "level" {
                    cfg.log.level = value.as_str().ok_or("invalid string value")?.to_string();
                } else if parts[1] == "format" {
                    cfg.log.format = value.as_str().ok_or("invalid string value")?.to_string();
                } else if parts[1] == "output_path" {
                    cfg.log.output_path = value.as_str().ok_or("invalid string value")?.to_string();
                } else if parts[1] == "max_size" {
                    cfg.log.max_size = value.as_i64().ok_or("invalid integer value")? as i32;
                } else if parts[1] == "max_backups" {
                    cfg.log.max_backups = value.as_i64().ok_or("invalid integer value")? as i32;
                } else if parts[1] == "max_age" {
                    cfg.log.max_age = value.as_i64().ok_or("invalid integer value")? as i32;
                } else if parts[1] == "compress" {
                    cfg.log.compress = value.as_bool().ok_or("invalid boolean value")?;
                }
            }
            _ => return Err(format!("unknown config section: {}", parts[0])),
        }
    } else {
        return Err(format!("invalid key format, expected 'section.field' but got '{}'", key));
    }

    config::save(&cfg)?;
    Ok(())
}

#[tauri::command]
fn db_query_tools(state: tauri::State<AppState>, filter: Option<String>) -> Result<Vec<db::models::Tool>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let f = filter.as_deref().unwrap_or("all");
    db::models::query_tools(&conn, f)
}

#[tauri::command]
fn db_query_tool_by_id(state: tauri::State<AppState>, id: i64) -> Result<db::models::Tool, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    db::models::query_tool_by_id(&conn, id)
}

#[tauri::command]
fn db_upsert_tool(state: tauri::State<AppState>, tool: db::models::Tool) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    db::models::upsert_tool(&conn, &tool)
}

#[tauri::command]
fn db_delete_tool(state: tauri::State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tool_versions WHERE tool_id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tools WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn tl_install(state: tauri::State<AppState>, app: tauri::AppHandle, tool_id: i64, version: Option<String>) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let tool = db::models::query_tool_by_id(&conn, tool_id)?;
    let target_version = if let Some(v) = version {
        tool.versions.iter().find(|ver| ver.sequence == v)
            .ok_or_else(|| format!("version {} not found", v))?.clone()
    } else {
        tool.versions.first().ok_or("no versions available")?.clone()
    };
    drop(conn); // release lock before download

    let app_clone = app.clone();
    let file_path = fs::install::install_tool(
        &state.cfg.server.address,
        state.cfg.server.s3_port,
        &state.cfg.tool.install_path,
        &tool,
        &target_version,
        Box::new(move |percent| {
            let _ = app_clone.emit("tool:install:progress", serde_json::json!({
                "toolId": tool_id,
                "status": "downloading",
                "progress": percent,
                "message": format!("下载中 {}%", percent),
            }));
        }),
    )?;

    // update database
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    let mut updated_tool = tool.clone();
    updated_tool.version = target_version.sequence;
    updated_tool.file_path = file_path;
    updated_tool.installed_at = now;
    db::models::upsert_tool(&conn, &updated_tool)?;

    let _ = app.emit("tool:install:progress", serde_json::json!({
        "toolId": tool_id,
        "status": "completed",
        "progress": 100,
        "message": "安装完成",
    }));
    Ok(())
}

#[tauri::command]
fn tl_uninstall(state: tauri::State<AppState>, tool_id: i64) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut tool = db::models::query_tool_by_id(&conn, tool_id)?;
    if tool.installed_at.is_empty() {
        return Err("tool not installed".into());
    }
    tool.version = String::new();
    tool.file_path = String::new();
    tool.installed_at = String::new();
    db::models::upsert_tool(&conn, &tool)
}

#[tauri::command]
fn tl_launch(file_path: String) -> Result<u32, String> {
    fs::launch::launch_tool(&file_path)
}

#[tauri::command]
fn updater_check(state: tauri::State<AppState>) -> Result<Option<updater::UpdateInfo>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    updater::check::check_update(&conn, env!("CARGO_PKG_VERSION"))
}

#[tauri::command]
fn updater_download(state: tauri::State<AppState>, app: tauri::AppHandle, version_id: i64, size: i64) -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?.to_string_lossy().to_string();
    updater::download::download_update(
        &state.cfg,
        version_id,
        size,
        &exe_path,
        Box::new(move |progress| {
            let _ = app.emit("app:update:progress", &progress);
        }),
    )?;
    Ok(())
}

#[tauri::command]
fn updater_apply() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?.to_string_lossy().to_string();
    updater::apply::restart_for_update(&exe_path)
}

#[tauri::command]
fn sync_now(state: tauri::State<AppState>, app: tauri::AppHandle) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let result = sync::fetch_and_save(&state.cfg, &conn)?;
    let _ = app.emit("tools:sync:completed", serde_json::json!({
        "success": result.success,
        "count": result.count,
        "message": result.message,
    }));
    Ok(())
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_info_does_not_panic() {
        log_info("test-module".into(), "hello info".into());
    }

    #[test]
    fn log_warn_does_not_panic() {
        log_warn("test-module".into(), "hello warn".into());
    }

    #[test]
    fn log_error_does_not_panic() {
        log_error("test-module".into(), "hello error".into());
    }

    #[test]
    fn log_info_empty_strings() {
        log_info(String::new(), String::new());
    }

    #[test]
    fn log_warn_empty_strings() {
        log_warn(String::new(), String::new());
    }

    #[test]
    fn log_error_empty_strings() {
        log_error(String::new(), String::new());
    }

    #[test]
    fn log_info_unicode() {
        log_info("模块".into(), "你好世界 🌍".into());
    }

    #[test]
    fn log_warn_unicode() {
        log_warn("模块".into(), "警告信息 ⚠️".into());
    }

    #[test]
    fn log_error_unicode() {
        log_error("模块".into(), "错误信息 ❌".into());
    }
}

pub fn run() {
    let log_dir = logging::get_log_dir();
    let guard = logging::init("toolbox", &log_dir);
    tracing::info!("app started");

    let cfg = config::load().expect("failed to load config");
    let db = db::Database::new(&cfg).expect("failed to init database");
    tracing::info!("database initialized");

    tauri::Builder::default()
        .manage(LogGuard(guard))
        .manage(AppState { db, cfg })
        .setup(|app| {
            let _state = app.state::<AppState>();
            // cleanup old version files
            let exe_path = std::env::current_exe()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            updater::cleanup::cleanup_old_versions(&exe_path);
            // startup sync in background thread
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let state = handle.state::<AppState>();
                let conn = state.db.conn.lock().unwrap();
                if let Ok(result) = sync::fetch_and_save(&state.cfg, &conn) {
                    drop(conn);
                    let _ = handle.emit("tools:sync:completed", serde_json::json!({
                        "success": result.success,
                        "count": result.count,
                        "message": result.message,
                    }));
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            log_info,
            log_warn,
            log_error,
            config_get,
            config_set,
            db_query_tools,
            db_query_tool_by_id,
            db_upsert_tool,
            db_delete_tool,
            tl_install,
            tl_uninstall,
            tl_launch,
            updater_check,
            updater_download,
            updater_apply,
            sync_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
