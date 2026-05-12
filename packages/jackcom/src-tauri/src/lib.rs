pub mod channel;
mod commands;
mod error;
pub mod protocol;
mod serial;
mod state;

use state::AppState;

#[tauri::command]
fn ping() -> Result<&'static str, error::AppError> {
    Ok("pong")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
