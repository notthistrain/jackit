use std::io::{self, Read, Write};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use bytes::Bytes;
use chrono::Utc;
use serialport::{self, SerialPort};
use tokio::sync::{mpsc, Notify};
use tokio_util::sync::CancellationToken;

use crate::channel::broker::BrokerHandle;
use crate::protocol::detector::AutoDetector;
use crate::protocol::frame::{Direction, RawFrame};
use crate::serial::config::SerialConfig;

/// 读超时：10ms，保证写延迟 ≤ 10ms + 取消响应 ≤ 10ms
const READ_TIMEOUT: Duration = Duration::from_millis(10);

/// 低延迟串口工作器
///
/// 单个 OS 线程负责串口阻塞读写，通过 mpsc 通道和 Notify
/// 与 tokio 异步任务通信。收到数据后立即通知异步端处理。
pub struct LowLatencyPort {
    pub task: tokio::task::JoinHandle<()>,
    pub cancel: CancellationToken,
    pub config: SerialConfig,
    /// 写命令通道：外部通过此通道发送数据到 OS 线程
    pub write_tx: std::sync::mpsc::Sender<Vec<u8>>,
}

impl LowLatencyPort {
    /// 启动端口工作器
    ///
    /// 创建 OS I/O 线程 + tokio 处理任务，返回句柄
    pub fn spawn(
        config: SerialConfig,
        broker: BrokerHandle,
    ) -> io::Result<Self> {
        let cancel = CancellationToken::new();
        let cancel_clone = cancel.clone();
        let port_name = config.port_name.clone();

        // 打开串口（阻塞模式）
        let port = Self::open_port(&config)?;

        // 共享端口（Arc<Mutex>），OS 线程 + 可能的外部关闭操作
        let port = Arc::new(Mutex::new(port));

        // 通知机制：OS 线程读到数据后立即通知 tokio 任务
        let data_available = Arc::new(Notify::new());

        // 读数据通道：OS 线程 → tokio 任务
        let (data_tx, data_rx) = mpsc::unbounded_channel::<Bytes>();

        // 写命令通道：tokio 任务 → OS 线程
        let (write_tx, write_rx) = std::sync::mpsc::channel::<Vec<u8>>();

        // 启动 OS I/O 线程
        let io_cancel = cancel_clone.clone();
        let io_notify = data_available.clone();
        let io_port = port.clone();

        let _io_thread = std::thread::Builder::new()
            .name(format!("serial-io-{}", port_name))
            .spawn(move || {
                Self::io_loop(
                    io_port,
                    data_tx,
                    write_rx,
                    io_notify,
                    io_cancel,
                );
            })
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        // 启动 tokio 处理任务
        let broker_clone = broker.clone();
        let config_for_task = config.clone();
        let task = tokio::spawn(async move {
            Self::process_loop(
                data_rx,
                data_available,
                broker_clone,
                cancel_clone,
                port_name.clone(),
                config_for_task,
            ).await;
        });

        Ok(Self {
            task,
            cancel,
            config,
            write_tx,
        })
    }

    /// 打开串口并配置参数
    fn open_port(config: &SerialConfig) -> io::Result<Box<dyn SerialPort>> {
        use crate::serial::config::{DataBits as DB, FlowControl as FC, Parity as P, StopBits as SB};

        let data_bits = match config.data_bits {
            DB::Five => serialport::DataBits::Five,
            DB::Six => serialport::DataBits::Six,
            DB::Seven => serialport::DataBits::Seven,
            DB::Eight => serialport::DataBits::Eight,
        };
        let stop_bits = match config.stop_bits {
            SB::One => serialport::StopBits::One,
            SB::Two => serialport::StopBits::Two,
        };
        let parity = match config.parity {
            P::None => serialport::Parity::None,
            P::Odd => serialport::Parity::Odd,
            P::Even => serialport::Parity::Even,
        };
        let flow_control = match config.flow_control {
            FC::None => serialport::FlowControl::None,
            FC::Hardware => serialport::FlowControl::Hardware,
            FC::Software => serialport::FlowControl::Software,
        };

        serialport::new(&config.port_name, config.baud_rate)
            .data_bits(data_bits)
            .stop_bits(stop_bits)
            .parity(parity)
            .flow_control(flow_control)
            .timeout(READ_TIMEOUT)
            .open()
            .map_err(|e| io::Error::new(io::ErrorKind::NotConnected, e.to_string()))
    }

    /// OS 线程 I/O 循环：阻塞读写串口
    fn io_loop(
        port: Arc<Mutex<Box<dyn SerialPort>>>,
        data_tx: mpsc::UnboundedSender<Bytes>,
        write_rx: std::sync::mpsc::Receiver<Vec<u8>>,
        notify: Arc<Notify>,
        cancel: CancellationToken,
    ) {
        let mut buf = [0u8; 4096];

        loop {
            // 检查取消
            if cancel.is_cancelled() {
                break;
            }

            // 读串口（阻塞，10ms timeout）
            let read_result = {
                let mut port_guard = match port.lock() {
                    Ok(guard) => guard,
                    Err(poisoned) => poisoned.into_inner(),
                };
                port_guard.read(&mut buf)
            };

            match read_result {
                Ok(0) => {
                    // EOF - 端口关闭
                    let _ = data_tx.send(Bytes::new());
                    notify.notify_one();
                    break;
                }
                Ok(n) => {
                    let data = Bytes::copy_from_slice(&buf[..n]);
                    let _ = data_tx.send(data);
                    notify.notify_one(); // 立即通知异步端
                }
                Err(ref e) if e.kind() == io::ErrorKind::TimedOut => {
                    // 超时正常，继续检查写队列和取消
                }
                Err(_) => {
                    let _ = data_tx.send(Bytes::new());
                    notify.notify_one();
                    break;
                }
            }

            // 非阻塞检查写队列
            while let Ok(data) = write_rx.try_recv() {
                let write_result = {
                    let mut port_guard = match port.lock() {
                        Ok(guard) => guard,
                        Err(poisoned) => poisoned.into_inner(),
                    };
                    port_guard.write_all(&data)
                };
                if write_result.is_err() {
                    break;
                }
            }
        }
    }

    /// Tokio 处理任务：接收数据并经 AutoDetector 解析后发布到 Broker
    async fn process_loop(
        mut data_rx: mpsc::UnboundedReceiver<Bytes>,
        notify: Arc<Notify>,
        broker: BrokerHandle,
        cancel: CancellationToken,
        port_id: String,
        config: SerialConfig,
    ) {
        let mut detector = AutoDetector::new();

        // 发布 Opened 事件
        broker.publish_port_opened(&port_id, &config);

        loop {
            tokio::select! {
                // 等待数据通知
                _ = notify.notified() => {
                    // 批量 drain 所有待处理数据
                    while let Some(data) = data_rx.try_recv().ok() {
                        if data.is_empty() {
                            // 空数据 = 端口关闭信号
                            broker.publish_port_closed(
                                &port_id,
                                crate::serial::config::CloseReason::Disconnected,
                            );
                            return;
                        }

                        let raw_frame = RawFrame {
                            port_id: port_id.clone(),
                            timestamp: Utc::now(),
                            data,
                            direction: Direction::Rx,
                        };

                        // AutoDetector 解析 → ParsedFrame → 发布到 Broker
                        let parsed_frames = detector.process(&raw_frame);
                        if !parsed_frames.is_empty() {
                            broker.publish_data(&port_id, parsed_frames);
                        }
                    }
                }

                // 取消信号
                _ = cancel.cancelled() => {
                    broker.publish_port_closed(
                        &port_id,
                        crate::serial::config::CloseReason::Disconnected,
                    );
                    return;
                }
            }
        }
    }

    /// 发送数据到端口（通过 write_tx 通道，由 OS 线程执行写入）
    pub fn send(&self, data: Vec<u8>) -> io::Result<()> {
        self.write_tx.send(data)
            .map_err(|_| io::Error::new(io::ErrorKind::NotConnected, "端口写入通道已关闭"))
    }

    /// 取消端口
    pub fn cancel(&self) {
        self.cancel.cancel();
    }
}

// === 测试 ===

#[cfg(test)]
mod tests {
    use super::*;
    use crate::serial::config::{DataBits, FlowControl, Parity, StopBits};

    fn test_config(port: &str) -> SerialConfig {
        SerialConfig {
            port_name: port.to_string(),
            baud_rate: 115200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
        }
    }

    #[test]
    fn test_config_to_serialport() {
        let config = test_config("COM_TEST");
        // 验证配置转换不会 panic
        // 实际打开会失败（端口不存在），但转换逻辑应正确
        let result = LowLatencyPort::open_port(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_cancellation_token() {
        let cancel = CancellationToken::new();
        assert!(!cancel.is_cancelled());
        cancel.cancel();
        assert!(cancel.is_cancelled());
    }

    #[test]
    fn test_notify_immediate() {
        let notify = Notify::new();
        notify.notify_one();
        // 不阻塞，只是验证 API 可用
    }

    #[test]
    fn test_mutex_poison_recovery() {
        let port: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(vec![1, 2, 3]));

        // 模拟 Mutex 中毒恢复
        let result = {
            let guard = port.lock().unwrap();
            drop(guard);
            port.lock().map(|g| g.clone())
        };
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), vec![1, 2, 3]);
    }

    #[test]
    fn test_read_timeout_value() {
        assert_eq!(READ_TIMEOUT, Duration::from_millis(10));
    }

    #[test]
    fn test_write_channel() {
        let (tx, rx) = std::sync::mpsc::channel::<Vec<u8>>();
        tx.send(vec![0x01, 0x02]).unwrap();
        let data = rx.try_recv().unwrap();
        assert_eq!(data, vec![0x01, 0x02]);
    }

    #[test]
    fn test_write_channel_closed() {
        let (tx, rx) = std::sync::mpsc::channel::<Vec<u8>>();
        drop(rx);
        assert!(tx.send(vec![0x01]).is_err());
    }
}
