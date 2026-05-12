use std::collections::HashSet;
use std::time::Duration;

use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

/// 端口变化事件
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortChange {
    pub arrived: Vec<String>,
    pub removed: Vec<String>,
}

impl PortChange {
    pub fn is_empty(&self) -> bool {
        self.arrived.is_empty() && self.removed.is_empty()
    }
}

/// 端口热插拔监听器
///
/// 通过轮询 serialport::available_ports() 检测端口列表变化。
/// 检测到变化时通过 change_tx 发送 PortChange。
pub struct PortWatcher {
    current_ports: HashSet<String>,
    poll_interval: Duration,
    cancel: CancellationToken,
}

/// 默认轮询间隔（2 秒）
const DEFAULT_POLL_INTERVAL: Duration = Duration::from_secs(2);

impl PortWatcher {
    pub fn new() -> Self {
        Self {
            current_ports: HashSet::new(),
            poll_interval: DEFAULT_POLL_INTERVAL,
            cancel: CancellationToken::new(),
        }
    }

    /// 设置轮询间隔
    pub fn with_poll_interval(mut self, interval: Duration) -> Self {
        self.poll_interval = interval;
        self
    }

    /// 获取当前端口列表
    pub fn current_ports(&self) -> &HashSet<String> {
        &self.current_ports
    }

    /// 扫描一次端口变化（同步版本，用于测试）
    pub fn scan_once(&mut self) -> PortChange {
        let new_ports = Self::enumerate_ports();
        let new_set: HashSet<String> = new_ports.iter().cloned().collect();

        let arrived: Vec<String> = new_set.difference(&self.current_ports).cloned().collect();
        let removed: Vec<String> = self.current_ports.difference(&new_set).cloned().collect();

        self.current_ports = new_set;

        PortChange { arrived, removed }
    }

    /// 启动后台轮询 task
    pub fn spawn(mut self, change_tx: mpsc::UnboundedSender<PortChange>) -> (tokio::task::JoinHandle<()>, CancellationToken) {
        let cancel = self.cancel.clone();
        let interval = self.poll_interval;

        let handle = tokio::spawn(async move {
            // 初始化端口列表
            self.current_ports = Self::enumerate_ports().into_iter().collect();

            loop {
                tokio::select! {
                    _ = tokio::time::sleep(interval) => {
                        let change = self.scan_once();
                        if !change.is_empty() {
                            if change_tx.send(change).is_err() {
                                break; // 接收端关闭
                            }
                        }
                    }
                    _ = self.cancel.cancelled() => {
                        break;
                    }
                }
            }
        });

        (handle, cancel)
    }

    /// 枚举可用端口
    pub fn enumerate_ports() -> Vec<String> {
        serialport::available_ports()
            .unwrap_or_default()
            .into_iter()
            .map(|p| p.port_name)
            .collect()
    }

    /// 停止监听
    pub fn cancel(&self) {
        self.cancel.cancel();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_change_empty() {
        let change = PortChange {
            arrived: vec![],
            removed: vec![],
        };
        assert!(change.is_empty());
    }

    #[test]
    fn test_port_change_non_empty() {
        let change = PortChange {
            arrived: vec!["COM3".to_string()],
            removed: vec![],
        };
        assert!(!change.is_empty());
    }

    #[test]
    fn test_enumerate_ports() {
        let ports = PortWatcher::enumerate_ports();
        // 在没有串口的环境中返回空列表，不应 panic
        println!("Available ports: {:?}", ports);
    }

    #[test]
    fn test_scan_once_initial() {
        let mut watcher = PortWatcher::new();
        let change = watcher.scan_once();
        // 首次扫描：removed 为空
        assert!(change.removed.is_empty());
        // 第二次扫描（无变化）：无 arrived/removed
        let change2 = watcher.scan_once();
        assert!(change2.is_empty());
    }

    #[test]
    fn test_scan_detects_new_port() {
        let mut watcher = PortWatcher::new();
        watcher.current_ports = HashSet::from(["COM3".to_string()]);

        // 扫描会更新到实际端口列表
        let change = watcher.scan_once();
        // 只验证不 panic
        println!("Change: arrived={:?}, removed={:?}", change.arrived, change.removed);
    }

    #[test]
    fn test_watcher_default_interval() {
        let watcher = PortWatcher::new();
        assert_eq!(watcher.poll_interval, Duration::from_secs(2));
    }

    #[test]
    fn test_watcher_custom_interval() {
        let watcher = PortWatcher::new().with_poll_interval(Duration::from_millis(500));
        assert_eq!(watcher.poll_interval, Duration::from_millis(500));
    }

    #[tokio::test]
    async fn test_watcher_spawn_and_cancel() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let watcher = PortWatcher::new().with_poll_interval(Duration::from_millis(100));
        let (handle, cancel) = watcher.spawn(tx);

        // 等待一轮扫描
        tokio::time::sleep(Duration::from_millis(150)).await;

        // 取消
        cancel.cancel();

        // 等待 task 结束
        let _ = handle.await;

        // 可能收到也可能没收到变化事件（取决于端口变化）
        // 只验证不 panic
        drop(rx);
    }
}
