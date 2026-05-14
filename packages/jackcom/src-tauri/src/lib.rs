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
use protocol::frame::{bytes_to_hex, DisplayFrame, ParsedFrame};
use serial::manager::SerialManager;

/// 将 ParsedFrame 转换为前端 DisplayFrame
fn parsed_to_display(frame: &ParsedFrame, id: i64) -> DisplayFrame {
    DisplayFrame {
        id,
        timestamp: frame.raw.timestamp,
        direction: frame.raw.direction,
        raw_hex: bytes_to_hex(&frame.raw.data),
        formatted: frame.formatted.clone(),
        protocol: frame.protocol,
        summary: format_parsed_summary(&frame.parsed),
    }
}

/// 根据 ParsedData 生成摘要
fn format_parsed_summary(parsed: &protocol::ParsedData) -> String {
    use protocol::ParsedData;
    match parsed {
        ParsedData::Raw { hex, .. } => format!("Raw {} bytes", hex.split_whitespace().count()),
        ParsedData::Modbus(m) => format!("Slave {} Func {}", m.slave, m.function),
        ParsedData::AT(a) => {
            if a.is_response {
                format!("AT Response: {}", a.command)
            } else {
                match &a.params {
                    Some(p) => format!("AT+{}={}", a.command, p),
                    None => format!("AT+{}", a.command),
                }
            }
        }
        ParsedData::Json(v) => match v {
            serde_json::Value::Object(m) => format!("JSON {} keys", m.len()),
            _ => "JSON".to_string(),
        },
    }
}

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
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
/// 对 Data 事件做 ParsedFrame→DisplayFrame 转换，
/// 其他事件直接透传。
async fn run_tauri_bridge(
    mut rx: tokio::sync::mpsc::Receiver<PortEvent>,
    app_handle: tauri::AppHandle,
) {
    use serde::Serialize;

    /// 前端可序列化的事件 payload（只包含 DisplayFrame）
    #[derive(Serialize)]
    #[serde(tag = "type")]
    enum BridgeEvent {
        Data {
            port_id: String,
            frames: Vec<DisplayFrame>,
        },
        Opened {
            port_id: String,
            config: serial::config::SerialConfig,
        },
        Closed {
            port_id: String,
            reason: serial::config::CloseReason,
        },
        Error {
            port_id: String,
            error: String,
        },
        Change {
            arrived: Vec<String>,
            removed: Vec<String>,
        },
        Stats {
            port_id: String,
            rx: u64,
            tx: u64,
            fps: u32,
        },
    }

    let mut frame_id: i64 = 0;
    while let Some(event) = rx.recv().await {
        let (event_name, bridge_event) = match &event {
            PortEvent::Data { port_id, frames } => {
                let display_frames: Vec<DisplayFrame> = frames
                    .iter()
                    .map(|f| {
                        frame_id = frame_id.wrapping_add(1);
                        parsed_to_display(f, frame_id)
                    })
                    .collect();
                ("port:data", serde_json::to_value(&BridgeEvent::Data {
                    port_id: port_id.clone(),
                    frames: display_frames,
                }).ok())
            }
            PortEvent::Opened { .. } => {
                let val = serde_json::to_value(&event).ok();
                ("port:opened", val)
            }
            PortEvent::Closed { .. } => {
                let val = serde_json::to_value(&event).ok();
                ("port:closed", val)
            }
            PortEvent::Error { .. } => {
                let val = serde_json::to_value(&event).ok();
                ("port:error", val)
            }
            PortEvent::Change { .. } => {
                let val = serde_json::to_value(&event).ok();
                ("port:change", val)
            }
            PortEvent::Stats { .. } => {
                let val = serde_json::to_value(&event).ok();
                ("port:stats", val)
            }
        };
        if let Some(payload) = bridge_event {
            let _ = app_handle.emit(event_name, payload);
        }
    }
    log::info!("Tauri event bridge stopped");
}
