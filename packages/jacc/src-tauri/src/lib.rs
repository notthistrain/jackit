mod commands;
mod db;
mod error;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let pool = rt.block_on(db::init_pool()).expect("failed to init database");
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::preferences::get_preference,
            commands::preferences::set_preference,
            commands::projects::list_projects,
            commands::projects::add_project,
            commands::projects::open_project,
            commands::projects::remove_project,
            commands::projects::pin_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
