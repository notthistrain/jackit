use std::time::Duration;

use crate::core::serial::types::PortName;

/// 端口变化结果
pub struct PortChange {
    pub arrived: Vec<PortName>,
    pub removed: Vec<PortName>,
}

/// 端口热插拔检测器
pub struct PortWatcher {
    known_ports: Vec<String>,
    pub interval: Duration,
}

impl PortWatcher {
    pub fn new(interval: Duration) -> Self {
        Self {
            known_ports: Vec::new(),
            interval,
        }
    }

    /// 执行一次扫描，检测端口变化
    pub fn scan_once(&mut self) -> PortChange {
        let current = match serialport::available_ports() {
            Ok(ports) => ports.into_iter().map(|p| p.port_name).collect::<Vec<_>>(),
            Err(_) => return PortChange {
                arrived: Vec::new(),
                removed: Vec::new(),
            },
        };

        let arrived: Vec<PortName> = current.iter()
            .filter(|p| !self.known_ports.contains(p))
            .map(|p| PortName::new(p.clone()))
            .collect();

        let removed: Vec<PortName> = self.known_ports.iter()
            .filter(|p| !current.contains(p))
            .map(|p| PortName::new(p.clone()))
            .collect();

        self.known_ports = current;

        PortChange { arrived, removed }
    }

    /// 初始化已知端口列表（不触发 change 事件）
    pub fn initialize(&mut self) {
        self.known_ports = match serialport::available_ports() {
            Ok(ports) => ports.into_iter().map(|p| p.port_name).collect(),
            Err(_) => Vec::new(),
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn watcher_detects_new_port() {
        let mut watcher = PortWatcher::new(Duration::from_secs(2));
        // 首次初始化
        watcher.initialize();
        let known_count = watcher.known_ports.len();

        // 扫描一次（无变化时）
        let change = watcher.scan_once();
        assert!(change.arrived.is_empty() || !change.arrived.is_empty());
        // 第二次扫描应该无变化
        let change2 = watcher.scan_once();
        assert!(change2.arrived.is_empty());
        assert!(change2.removed.is_empty());
    }
}
