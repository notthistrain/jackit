use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::broadcast;

use crate::core::event::port_event::PortEvent;
use crate::core::protocol::types::ProtocolType;
use crate::core::serial::types::{PortName, SessionId};
use crate::infra::db::frame_repo::{self, FrameRow};

/// 启动 DB 写入任务
///
/// subscribe -> 攒批 -> 事务 batch INSERT
pub fn spawn(
    mut rx: broadcast::Receiver<Arc<PortEvent>>,
    pool: SqlitePool,
    batch_size: usize,
    flush_interval: Duration,
    session_lookup: Arc<DashMap<PortName, SessionId>>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut buffer: Vec<FrameRow> = Vec::with_capacity(batch_size);
        let mut interval = tokio::time::interval(flush_interval);

        loop {
            tokio::select! {
                result = rx.recv() => {
                    if handle_recv(result, &mut buffer, &session_lookup) {
                        continue;
                    } else {
                        break;
                    }
                }
                _ = interval.tick() => {
                    try_flush(&pool, &mut buffer).await;
                }
            }

            if buffer.len() >= batch_size {
                try_flush(&pool, &mut buffer).await;
            }
        }
    })
}

/// 处理接收结果，返回 true=继续 false=退出
fn handle_recv(
    result: Result<Arc<PortEvent>, broadcast::error::RecvError>,
    buffer: &mut Vec<FrameRow>,
    session_lookup: &DashMap<PortName, SessionId>,
) -> bool {
    match result {
        Ok(arc) => {
            collect_data_frames(arc.as_ref(), buffer, session_lookup);
            true
        }
        Err(broadcast::error::RecvError::Lagged(n)) => {
            tracing::warn!("DB Writer: 跳过 {n} 个事件");
            true
        }
        Err(_) => false,
    }
}

/// 从 PortEvent::Data 中提取帧写入 buffer
fn collect_data_frames(
    event: &PortEvent,
    rows: &mut Vec<FrameRow>,
    session_lookup: &DashMap<PortName, SessionId>,
) {
    let PortEvent::Data {
        port_id,
        frames,
        direction,
    } = event
    else {
        return;
    };
    let session_id = session_lookup.get(port_id).map(|s| *s);
    for f in frames {
        rows.push(FrameRow::new(
            session_id,
            protocol_to_str(f.protocol),
            &f.raw_hex(),
            *direction,
            f.formatted(),
            &f.summary(),
        ));
    }
}

/// 攒批写入，失败时保留 buffer 下次重试
async fn try_flush(pool: &SqlitePool, buffer: &mut Vec<FrameRow>) {
    if buffer.is_empty() {
        return;
    }
    if frame_repo::insert_frames_batch(pool, buffer).await.is_err() {
        return;
    }
    buffer.clear();
}

/// 将 ProtocolType 转为小写字符串用于 DB 存储（不依赖 Debug trait）
fn protocol_to_str(p: ProtocolType) -> &'static str {
    match p {
        ProtocolType::Raw => "raw",
        ProtocolType::Modbus => "modbus",
        ProtocolType::AT => "at",
        ProtocolType::Json => "json",
    }
}
