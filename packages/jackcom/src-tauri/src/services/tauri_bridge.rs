use std::collections::HashMap;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use tauri::Emitter;
use tokio::sync::broadcast;

use crate::core::event::display_frame::DisplayFrame;
use crate::core::event::port_event::PortEvent;
use crate::core::protocol::frame::ParsedFrame;
use crate::core::serial::types::{Direction, PortName};

/// 启动 Tauri 桥接任务
///
/// subscribe -> 10ms batch -> emit 前端事件
pub fn spawn(
    mut rx: broadcast::Receiver<Arc<PortEvent>>,
    app_handle: tauri::AppHandle,
    batch_interval: Duration,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut pending: HashMap<PortName, Vec<Arc<PortEvent>>> = HashMap::new();
        let mut interval = tokio::time::interval(batch_interval);
        let frame_id = AtomicI64::new(0);

        loop {
            tokio::select! {
                result = rx.recv() => {
                    if !on_event(result, &mut pending, &app_handle) {
                        break;
                    }
                }
                _ = interval.tick() => {
                    flush(&mut pending, &app_handle, &frame_id).await;
                }
            }
        }
    })
}

fn on_event(
    result: Result<Arc<PortEvent>, broadcast::error::RecvError>,
    pending: &mut HashMap<PortName, Vec<Arc<PortEvent>>>,
    app: &tauri::AppHandle,
) -> bool {
    let event = match result {
        Ok(e) => e,
        Err(broadcast::error::RecvError::Lagged(n)) => {
            tracing::warn!("Bridge: 跳过 {n} 个事件");
            return true;
        }
        Err(_) => return false, // channel closed
    };

    // 数据事件：缓冲等待批量刷新；非数据事件：直接 emit
    match event.as_ref() {
        PortEvent::Data { port_id, .. } => {
            pending.entry(port_id.clone()).or_default().push(event);
        }
        _ => {
            let _ = app.emit(
                event_name(event.as_ref()),
                serde_json::to_value(event.as_ref()).unwrap_or_default(),
            );
        }
    }
    true
}

async fn flush(
    pending: &mut HashMap<PortName, Vec<Arc<PortEvent>>>,
    app: &tauri::AppHandle,
    frame_id: &AtomicI64,
) {
    if pending.is_empty() {
        return;
    }
    for (port_id, events) in pending.drain() {
        let display_frames: Vec<DisplayFrame> = events
            .iter()
            .filter_map(|ev| {
                if let PortEvent::Data {
                    frames, direction, ..
                } = ev.as_ref()
                {
                    Some(
                        frames
                            .iter()
                            .map(|f| to_display_frame(f, *direction, frame_id)),
                    )
                } else {
                    None
                }
            })
            .flatten()
            .collect();

        if !display_frames.is_empty() {
            // 取最后一条帧的方向作为本批次方向（大多数情况同一批次方向一致）
            let batch_direction = display_frames
                .last()
                .map(|f| f.direction)
                .unwrap_or(Direction::Rx);
            let _ = app.emit(
                "port:data",
                serde_json::json!({
                    "type": "data",
                    "port_id": port_id.as_str(),
                    "frames": display_frames,
                    "direction": match batch_direction {
                        Direction::Rx => "rx",
                        Direction::Tx => "tx",
                    },
                }),
            );
        }
    }
}

fn to_display_frame(
    frame: &ParsedFrame,
    direction: Direction,
    frame_id: &AtomicI64,
) -> DisplayFrame {
    DisplayFrame {
        id: frame_id.fetch_add(1, Ordering::Relaxed),
        timestamp: Utc::now(),
        direction,
        raw_hex: frame.raw_hex(),
        formatted: frame.formatted().to_string(),
        protocol: frame.protocol,
        summary: frame.summary(),
    }
}

fn event_name(event: &PortEvent) -> &str {
    match event {
        PortEvent::Opened { .. } => "port:opened",
        PortEvent::Closed { .. } => "port:closed",
        PortEvent::Error { .. } => "port:error",
        PortEvent::Change { .. } => "port:change",
        PortEvent::Data { .. } => "port:data",
    }
}
