use bytes::Bytes;
use tokio::sync::mpsc;

/// 创建 IO 线程与 tokio 之间的通道
pub fn create_io_channel(capacity: usize) -> (mpsc::Sender<Bytes>, mpsc::Receiver<Bytes>) {
    mpsc::channel(capacity)
}
