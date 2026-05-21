use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::broadcast;

use crate::core::event::port_event::PortEvent;
use crate::core::serial::types::{Direction, PortName, SessionId};
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
                    if let Ok(arc) = result {
                        if let PortEvent::Data { port_id, frames, direction } = arc.as_ref() {
                            let session_id: Option<SessionId> = session_lookup.get(port_id)
                                .map(|s| *s);
                            for f in frames {
                                buffer.push(FrameRow::new(
                                    session_id,
                                    &format!("{:?}", f.protocol).to_lowercase(),
                                    &f.raw_hex(),
                                    *direction,
                                    f.formatted(),
                                    &f.summary(),
                                ));
                            }
                            if buffer.len() >= batch_size {
                                flush_to_db(&pool, &buffer).await;
                                buffer.clear();
                            }
                        }
                    }
                }
                _ = interval.tick() => {
                    if !buffer.is_empty() {
                        flush_to_db(&pool, &buffer).await;
                        buffer.clear();
                    }
                }
            }
        }
    })
}

async fn flush_to_db(pool: &SqlitePool, rows: &[FrameRow]) {
    if let Err(e) = frame_repo::insert_frames_batch(pool, rows).await {
        tracing::error!("DB 写入失败 ({} 条): {e}", rows.len());
    }
}
