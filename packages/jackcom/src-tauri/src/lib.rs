mod app;
mod commands;
mod core;
mod error;
mod infra;
mod logging;
mod services;

use tauri::Manager;
use commands::{serial, data, config, log};

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async {
                let (log_guard, serial_state, storage_state) =
                    app::build_app(app_handle).await
                    .expect("应用初始化失败");

                app.manage(log_guard);
                app.manage(serial_state);
                app.manage(storage_state);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            // 串口命令
            serial::enumerate_ports,
            serial::open_port,
            serial::close_port,
            serial::send_data,
            serial::close_all,
            // 数据命令
            data::query_history,
            data::export_data,
            // 配置命令
            config::get_config,
            config::save_config,
            config::list_recent_sessions,
            // 日志命令
            log::log_debug,
            log::log_info,
            log::log_warn,
            log::log_error,
        ])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用失败");
}
