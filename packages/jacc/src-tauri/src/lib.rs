#[macro_use]
mod macros;

pub mod claude_settings;
pub mod commands;
mod db;
pub mod error;
mod logging;
mod path_guard;
pub mod settings_watcher;

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

    // 启动期校验 HOME：找不到则 fail-fast，避免数据写到随机工作目录
    let _home = dirs::home_dir().unwrap_or_else(|| {
        tracing::error!("HOME not found, jacc cannot start");
        panic!("HOME not found, jacc cannot start");
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(LogGuard(guard))
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::init_pool())
                .expect("failed to init database");
            app.manage(pool);
            tracing::info!("database initialized");

            let global = claude_settings::global_settings_path();
            match settings_watcher::SettingsWatcher::start(app.handle().clone(), global) {
                Ok(w) => {
                    app.manage(std::sync::Mutex::new(w));
                    tracing::info!("settings watcher started");
                }
                Err(e) => tracing::error!(?e, "settings watcher start failed"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // active project
            commands::active_project::set_active_project,
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
            // providers
            commands::providers::add_provider,
            commands::providers::list_providers,
            commands::providers::update_provider,
            commands::providers::delete_provider,
            // api_keys
            commands::api_keys::add_api_key,
            commands::api_keys::list_api_keys,
            commands::api_keys::update_api_key,
            commands::api_keys::delete_api_key,
            // models
            commands::models::add_model,
            commands::models::list_models,
            commands::models::update_model,
            commands::models::delete_model,
            commands::models::test_model,
            // slot bindings
            commands::slots::get_slot_bindings,
            commands::slots::bind_slot,
            commands::slots::unbind_slot,
            commands::slots::set_current_model,
            // config
            commands::config::read_merged_config,
            commands::config::write_config,
            commands::config::delete_config,
            commands::config::reset_corrupted_settings,
            // delete preview
            commands::delete_preview::preview_delete_impact,
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