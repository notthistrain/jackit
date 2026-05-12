use std::io;

use dashmap::DashMap;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::channel::broker::BrokerHandle;
use crate::error::AppError;
use crate::serial::config::SerialConfig;
use crate::serial::port::LowLatencyPort;
use crate::serial::watcher::{PortChange, PortWatcher};

/// 端口条目：LowLatencyPort（内含 write_tx 通道）
struct PortEntry {
    port: LowLatencyPort,
}

/// Watcher 后台 task 句柄
struct WatcherHandle {
    task: tokio::task::JoinHandle<()>,
    _cancel: CancellationToken,
}

/// 串口管理器：管理多个端口连接的生命周期
pub struct SerialManager {
    /// 已打开的端口 (port_name → PortEntry)
    ports: DashMap<String, PortEntry>,
    /// Broker 句柄（克隆给每个端口 task）
    broker: BrokerHandle,
    /// 端口热插拔监听器
    watcher: Option<WatcherHandle>,
}

impl SerialManager {
    pub fn new(broker: BrokerHandle) -> Self {
        Self {
            ports: DashMap::new(),
            broker,
            watcher: None,
        }
    }

    /// 枚举可用端口
    pub fn enumerate_ports(&self) -> Vec<String> {
        PortWatcher::enumerate_ports()
    }

    /// 打开串口连接
    pub fn open_port(&self, config: SerialConfig) -> Result<(), AppError> {
        let port_name = config.port_name.clone();

        if self.ports.contains_key(&port_name) {
            return Err(AppError::PortInUse(port_name));
        }

        let port = LowLatencyPort::spawn(
            config,
            self.broker.clone(),
        ).map_err(|e| AppError::Serial(e.to_string()))?;

        self.ports.insert(port_name, PortEntry { port });
        Ok(())
    }

    /// 关闭串口连接
    pub fn close_port(&self, port_name: &str) -> Result<(), AppError> {
        let (_, entry) = self.ports.remove(port_name)
            .ok_or_else(|| AppError::PortNotFound(port_name.to_string()))?;

        // 取消端口（通知 OS 线程和 tokio 任务退出）
        entry.port.cancel();

        Ok(())
    }

    /// 发送数据到指定端口（通过 LowLatencyPort 的 write_tx 通道）
    pub fn send_data(&self, port_name: &str, data: Vec<u8>) -> Result<(), AppError> {
        let entry = self.ports.get(port_name)
            .ok_or_else(|| AppError::PortNotFound(port_name.to_string()))?;

        entry.port.send(data)
            .map_err(|_| AppError::Serial(format!("端口 {} 写入通道已关闭", port_name)))
    }

    /// 关闭所有端口
    pub fn close_all(&self) {
        let port_names: Vec<String> = self.ports.iter().map(|e| e.key().clone()).collect();
        for name in port_names {
            if let Some((_, entry)) = self.ports.remove(&name) {
                entry.port.cancel();
            }
        }
    }

    /// 启动端口热插拔监听
    pub fn start_watcher(&mut self) -> mpsc::UnboundedReceiver<PortChange> {
        let (change_tx, change_rx) = mpsc::unbounded_channel();
        let watcher = PortWatcher::new();
        let (task, cancel) = watcher.spawn(change_tx);
        self.watcher = Some(WatcherHandle { task, _cancel: cancel });
        change_rx
    }

    /// 停止端口热插拔监听
    pub fn stop_watcher(&mut self) {
        if let Some(w) = self.watcher.take() {
            w.task.abort();
        }
    }

    /// 获取已打开端口列表
    pub fn open_ports(&self) -> Vec<String> {
        self.ports.iter().map(|e| e.key().clone()).collect()
    }

    /// 检查端口是否已打开
    pub fn is_open(&self, port_name: &str) -> bool {
        self.ports.contains_key(port_name)
    }

    /// 关闭所有资源
    pub fn shutdown(mut self) {
        self.stop_watcher();
        self.close_all();
    }
}

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
    fn test_manager_enumerate_ports() {
        let broker = BrokerHandle::new_test();
        let manager = SerialManager::new(broker);
        let ports = manager.enumerate_ports();
        println!("Ports: {:?}", ports);
    }

    #[test]
    fn test_manager_open_nonexistent_port() {
        let broker = BrokerHandle::new_test();
        let manager = SerialManager::new(broker);
        let config = test_config("COM_NONEXISTENT_99999");
        let result = manager.open_port(config);
        assert!(result.is_err());
    }

    #[test]
    fn test_manager_close_nonexistent_port() {
        let broker = BrokerHandle::new_test();
        let manager = SerialManager::new(broker);
        let result = manager.close_port("COM_NONEXISTENT");
        assert!(result.is_err());
        assert!(matches!(result, Err(AppError::PortNotFound(_))));
    }

    #[test]
    fn test_manager_send_to_nonexistent_port() {
        let broker = BrokerHandle::new_test();
        let manager = SerialManager::new(broker);
        let result = manager.send_data("COM_NONEXISTENT", vec![0x01, 0x02]);
        assert!(result.is_err());
    }

    #[test]
    fn test_manager_open_ports_empty() {
        let broker = BrokerHandle::new_test();
        let manager = SerialManager::new(broker);
        assert!(manager.open_ports().is_empty());
    }

    #[test]
    fn test_manager_is_open() {
        let broker = BrokerHandle::new_test();
        let manager = SerialManager::new(broker);
        assert!(!manager.is_open("COM3"));
    }

    #[test]
    fn test_manager_close_all_no_panic() {
        let broker = BrokerHandle::new_test();
        let manager = SerialManager::new(broker);
        manager.close_all();
    }
}
