use bytes::Bytes;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::core::protocol::detector::AutoDetector;
use crate::core::serial::types::{Direction, PortName};
use crate::services::emitter::EventEmitter;

/// 端口处理器：Bytes -> AutoDetector -> ParsedFrame -> EventEmitter
pub struct PortProcessor;

impl PortProcessor {
    /// 启动处理任务
    pub fn spawn(
        port_name: PortName,
        mut data_rx: mpsc::Receiver<Bytes>,
        emitter: EventEmitter,
        cancel: CancellationToken,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut detector = AutoDetector::new();

            loop {
                tokio::select! {
                    data = data_rx.recv() => {
                        let Some(data) = data else { break };
                        let frames = detector.process(&data);
                        if !frames.is_empty() {
                            emitter.emit_data(port_name.clone(), frames, Direction::Rx);
                        }
                    }
                    _ = cancel.cancelled() => break,
                }
            }
            tracing::debug!("PortProcessor 退出: {}", port_name);
        })
    }
}
