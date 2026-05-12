pub mod channel;
mod commands;
mod error;
pub mod protocol;
mod serial;
mod state;
mod storage;

use std::sync::Arc;

use state::AppState;
use storage::init_db;
use tauri::{Emitter, Manager};

use channel::broker::{Broker, BrokerHandle};
use channel::PortEvent;
use serial::manager::SerialManager;

#[tauri::command]
fn ping() -> Result<&'static str, error::AppError> {
    Ok("pong")
}

pub fn run() {
    // 创建 Broker 通道：事件从 SerialManager → Broker → 订阅者
    let (event_tx, event_rx) = tokio::sync::mpsc::channel(256);
    let broker_handle = BrokerHandle::new(event_tx);
    let mut broker = Broker::new(event_rx, 16);

    // 订阅 Tauri Event 桥接（必须在 broker.run() 之前）
    let bridge_rx = broker.subscribe("tauri-bridge".to_string());

    // 创建 SerialManager（持有 BrokerHandle 副本）
    let serial_manager = Arc::new(SerialManager::new(broker_handle.clone()));

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // 启动 Broker 事件循环
            tauri::async_runtime::spawn(async move {
                broker.run(10).await;
            });

            // 启动 Broker → Tauri Event 桥接
            tauri::async_runtime::spawn(run_tauri_bridge(bridge_rx, app_handle.clone()));

            // 初始化数据库
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
        .manage(AppState::new(serial_manager, broker_handle))
        .invoke_handler(tauri::generate_handler![
            ping,
            // serial commands
            commands::serial::enumerate_ports,
            commands::serial::open_port,
            commands::serial::close_port,
            commands::serial::close_all,
            commands::serial::send_data,
            // data commands
            commands::data::query_history,
            commands::data::export_data,
            // config commands
            commands::config::get_config,
            commands::config::save_config,
            commands::config::list_recent_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 将 Broker 订阅事件桥接到 Tauri Event Bus
///
/// 从 subscriber receiver 读取 PortEvent，
/// 根据变体类型映射到对应的 Tauri event name 并 emit 到前端。
async fn run_tauri_bridge(
    mut rx: tokio::sync::mpsc::Receiver<PortEvent>,
    app_handle: tauri::AppHandle,
) {
    while let Some(event) = rx.recv().await {
        let event_name = match &event {
            PortEvent::Data { .. } => "port:data",
            PortEvent::Opened { .. } => "port:opened",
            PortEvent::Closed { .. } => "port:closed",
            PortEvent::Error { .. } => "port:error",
            PortEvent::Change { .. } => "port:change",
            PortEvent::Stats { .. } => "port:stats",
        };
        let _ = app_handle.emit(event_name, &event);
    }
    log::info!("Tauri event bridge stopped");
}
