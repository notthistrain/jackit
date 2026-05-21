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
                    match result {
                        Ok(arc) => {
                            if let PortEvent::Data { port_id, frames, direction } = arc.as_ref() {
                                let session_id: Option<SessionId> = session_lookup.get(port_id)
                                    .map(|s| *s);
                                for f in frames {
                                    buffer.push(FrameRow::new(
                                        session_id,
                                        protocol_to_str(f.protocol),
                                        &f.raw_hex(),
                                        *direction,
                                        f.formatted(),
                                        &f.summary(),
                                    ));
                                }
                                if buffer.len() >= batch_size {
                                    if flush_to_db(&pool, &buffer).await.is_err() {
                                        // S2: flush 失败保留 buffer，下次重试
                                        continue;
                                    }
                                    buffer.clear();
                                }
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(n)) => {
                            // S1: Lagged 时打 warn 日志
                            tracing::warn!("DB Writer: 跳过 {n} 个事件");
                            continue;
                        }
                        Err(_) => break, // channel closed
                    }
                }
                _ = interval.tick() => {
                    if !buffer.is_empty() {
                        if flush_to_db(&pool, &buffer).await.is_err() {
                            continue; // S2: 失败保留 buffer
                        }
                        buffer.clear();
                    }
                }
            }
        }
    })
}

async fn flush_to_db(pool: &SqlitePool, rows: &[FrameRow]) -> anyhow::Result<()> {
    frame_repo::insert_frames_batch(pool, rows).await
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
