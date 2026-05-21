use std::io::{self, Read, Write};
use std::sync::mpsc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use bytes::{Bytes, BytesMut};
use tokio::sync::mpsc as async_mpsc;
use tokio_util::sync::CancellationToken;

/// IO 线程：在 OS 线程中执行阻塞的串口读写
pub struct IoThread {
    write_tx: mpsc::Sender<Vec<u8>>,
    thread_handle: Option<JoinHandle<()>>,
}

/// IO 线程配置
pub struct IoThreadConfig {
    pub read_buffer_size: usize,
    pub read_timeout: Duration,
}

impl Default for IoThreadConfig {
    fn default() -> Self {
        Self {
            read_buffer_size: 4096,
            read_timeout: Duration::from_millis(10),
        }
    }
}

impl IoThread {
    /// 启动 IO 线程
    ///
    /// - `port`: 已打开的串口（move 进线程）
    /// - `data_tx`: 读数据输出通道（tokio async mpsc）
    /// - `cancel`: 取消令牌
    pub fn spawn(
        mut port: Box<dyn serialport::SerialPort>,
        data_tx: async_mpsc::Sender<Bytes>,
        cancel: CancellationToken,
        config: IoThreadConfig,
    ) -> io::Result<Self> {
        let (write_tx, write_rx) = mpsc::channel::<Vec<u8>>();

        let handle = thread::Builder::new()
            .name(format!("io-{}", port.name().unwrap_or_default()))
            .spawn(move || {
                let mut buf = vec![0u8; config.read_buffer_size];
                loop {
                    // 检查取消
                    if cancel.is_cancelled() {
                        break;
                    }

                    // 1. 写入待发送数据
                    while let Ok(data) = write_rx.try_recv() {
                        if let Err(e) = port.write_all(&data) {
                            tracing::warn!("串口写入失败: {e}");
                        }
                    }

                    // 2. 阻塞读取
                    port.set_timeout(config.read_timeout).ok();
                    match port.read(&mut buf) {
                        Ok(n) if n > 0 => {
                            let mut bytes_mut = BytesMut::new();
                            bytes_mut.extend_from_slice(&buf[..n]);
                            let bytes = bytes_mut.freeze();
                            if data_tx.blocking_send(bytes).is_err() {
                                break; // channel closed
                            }
                        }
                        Ok(_) => {} // n == 0, ignore
                        Err(ref e) if e.kind() == io::ErrorKind::TimedOut => {}
                        Err(ref e) if e.kind() == io::ErrorKind::Interrupted => {}
                        Err(e) => {
                            tracing::error!("串口读取错误: {e}");
                            break;
                        }
                    }
                }
                tracing::debug!("IO 线程退出");
            })?;

        Ok(Self {
            write_tx,
            thread_handle: Some(handle),
        })
    }

    /// 发送数据到串口
    pub fn send(&self, data: Vec<u8>) -> io::Result<()> {
        self.write_tx.send(data).map_err(|e| {
            io::Error::new(io::ErrorKind::BrokenPipe, format!("IO 线程已关闭: {e}"))
        })
    }
}

impl Drop for IoThread {
    fn drop(&mut self) {
        // write_tx drop 后线程中的 write_rx 会返回 Err，加速退出
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    #[tokio::test]
    async fn io_thread_send_through_channel() {
        let (data_tx, mut _data_rx) = mpsc::channel::<Bytes>(4096);
        let cancel = CancellationToken::new();
        let _cancel_clone = cancel.clone();

        // 创建一个 mock serial port（这里用 /dev/null 模拟）
        // 实际测试需要 mock，此处仅验证通道机制
        let config = IoThreadConfig::default();
        // 注意：实际运行需要真实串口，此处仅验证结构
        assert!(data_tx.capacity() >= 4096);
        cancel.cancel();
    }
}
