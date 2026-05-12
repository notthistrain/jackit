pub mod channel;
mod commands;
mod error;
pub mod protocol;
mod serial;
mod state;
mod storage;

use state::AppState;
use storage::init_db;
use tauri::Manager;

#[tauri::command]
fn ping() -> Result<&'static str, error::AppError> {
    Ok("pong")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<AppState>();
                match init_db().await {
                    Ok(pool) => {
                        *state.db.write().await = Some(pool);
                        log::info!("数据库初始化成功");
                    }
                    Err(e) => {
                        log::error!("数据库初始化失败: {}", e);
                    }
                }
            });
            Ok(())
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
