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
use tauri::Manager;

use channel::broker::{Broker, BrokerHandle};
use serial::manager::SerialManager;

#[tauri::command]
fn ping() -> Result<&'static str, error::AppError> {
    Ok("pong")
}

pub fn run() {
    // 创建 Broker 通道：事件从 SerialManager → Broker → 订阅者
    let (event_tx, event_rx) = tokio::sync::mpsc::channel(256);
    let broker_handle = BrokerHandle::new(event_tx);
    let broker = Broker::new(event_rx, 16);

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
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
