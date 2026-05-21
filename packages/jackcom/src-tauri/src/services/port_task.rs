use bytes::Bytes;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::core::serial::types::PortName;
use crate::infra::port_io::io_thread::{IoThread, IoThreadConfig};
use crate::services::emitter::EventEmitter;
use crate::services::port_processor::PortProcessor;

/// 单端口任务编排：IoThread + PortProcessor
pub struct PortTask {
    _io: IoThread,
    _processor: tokio::task::JoinHandle<()>,
    _cancel: CancellationToken,
}

impl PortTask {
    /// 创建并启动端口任务
    ///
    /// 1. 创建 tokio mpsc 通道
    /// 2. 启动 IoThread（OS 线程）
    /// 3. 启动 PortProcessor（tokio task）
    pub fn start(
        port: Box<dyn serialport::SerialPort>,
        port_name: PortName,
        emitter: EventEmitter,
    ) -> anyhow::Result<Self> {
        let cancel = CancellationToken::new();
        let (data_tx, data_rx) = mpsc::channel::<Bytes>(4096);

        // 启动 IO 线程
        let io = IoThread::spawn(
            port,
            data_tx,
            cancel.clone(),
            IoThreadConfig::default(),
        )?;

        // 启动 PortProcessor
        let processor = PortProcessor::spawn(
            port_name,
            data_rx,
            emitter,
            cancel.clone(),
        );

        Ok(Self { _io: io, _processor: processor, _cancel: cancel })
    }

    /// 发送数据
    pub fn send(&self, data: Vec<u8>) -> anyhow::Result<()> {
        self._io.send(data)
            .map_err(|e| anyhow::anyhow!("发送失败: {e}"))
    }

    /// 停止端口任务
    pub async fn stop(self) {
        self._cancel.cancel();
        let _ = self._processor.await;
        // IoThread 在 drop 时自动 join
    }
}
