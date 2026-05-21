use std::sync::Arc;

use dashmap::DashMap;

use crate::core::serial::types::{PortName, SessionId};
use crate::services::emitter::EventEmitter;

/// 活跃端口条目
pub struct PortEntry {
    #[allow(dead_code)]
    pub port_name: PortName,
    pub task: crate::services::port_task::PortTask,
    pub session_id: SessionId,
}

/// 串口状态管理 -- 域分离（不再 God Object）
pub struct SerialState {
    ports: DashMap<PortName, PortEntry>,
    sessions: Arc<DashMap<PortName, SessionId>>,
    emitter: EventEmitter,
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

    pub fn emitter(&self) -> &EventEmitter {
        &self.emitter
    }

    pub fn insert_port(&self, name: PortName, entry: PortEntry) {
        self.sessions.insert(name.clone(), entry.session_id);
        self.ports.insert(name, entry);
    }

    pub fn remove_port(&self, port_name: &PortName) -> Option<(PortName, PortEntry)> {
        let removed = self.ports.remove(port_name);
        if removed.is_some() {
            self.sessions.remove(port_name);
        }
        removed
    }

    pub fn get_port(&self, port_name: &PortName) -> Option<dashmap::mapref::one::Ref<'_, PortName, PortEntry>> {
        self.ports.get(port_name)
    }

    #[allow(dead_code)]
    pub fn open_port_names(&self) -> Vec<PortName> {
        self.ports.iter().map(|r| r.key().clone()).collect()
    }

    #[allow(dead_code)]
    pub fn sessions(&self) -> &Arc<DashMap<PortName, SessionId>> {
        &self.sessions
    }
}
