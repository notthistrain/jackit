use std::sync::Arc;

use dashmap::DashMap;

use crate::core::serial::types::{PortName, SessionId};
use crate::services::emitter::EventEmitter;

/// 活跃端口条目
pub struct PortEntry {
    pub port_name: PortName,
    pub task: crate::services::port_task::PortTask,
    pub session_id: SessionId,
}

/// 串口状态管理 -- 域分离（不再 God Object）
pub struct SerialState {
    pub ports: DashMap<PortName, PortEntry>,
    pub sessions: Arc<DashMap<PortName, SessionId>>,
    pub emitter: EventEmitter,
}

impl SerialState {
    pub fn new(emitter: EventEmitter, sessions: Arc<DashMap<PortName, SessionId>>) -> Self {
        Self {
            ports: DashMap::new(),
            sessions,
            emitter,
        }
    }

    pub fn is_port_open(&self, port_name: &PortName) -> bool {
        self.ports.contains_key(port_name)
    }

    pub fn open_port_names(&self) -> Vec<PortName> {
        self.ports.iter().map(|r| r.key().clone()).collect()
    }
}
