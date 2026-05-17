mod commands;
mod db;
mod error;
mod logging;

use tracing_appender::non_blocking::WorkerGuard;
use tauri::Manager;

/// 持有日志 guard，防止被 drop
struct LogGuard(#[allow(dead_code)] WorkerGuard);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志（必须在 Builder 之前，确保整个启动过程都有日志）
    let log_dir = logging::get_log_dir();
    let guard = logging::init("jacc", &log_dir);

    tracing::info!("app started");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(LogGuard(guard))
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::init_pool())
                .expect("failed to init database");
            app.manage(pool);
            tracing::info!("database initialized");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // log
            commands::log::log_debug,
            commands::log::log_info,
            commands::log::log_warn,
            commands::log::log_error,
            // preferences
            commands::preferences::get_preference,
            commands::preferences::set_preference,
            // projects
            commands::projects::list_projects,
            commands::projects::add_project,
            commands::projects::open_project,
            commands::projects::remove_project,
            commands::projects::pin_project,
            // models
            commands::models::list_models,
            commands::models::add_model,
            commands::models::update_model,
            commands::models::delete_model,
            commands::models::bind_model,
            commands::models::activate_slot,
            commands::models::test_model,
            // config
            commands::config::read_merged_config,
            commands::config::write_config,
            commands::config::delete_config,
            // skills
            commands::skills::list_skills,
            commands::skills::toggle_skill,
            commands::skills::import_skill,
            commands::skills::install_skill_from_github,
            commands::skills::confirm_install_skill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}