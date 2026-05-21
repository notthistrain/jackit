use std::sync::Arc;

use tokio::sync::broadcast;

use crate::core::event::port_event::PortEvent;

/// 事件总线 -- tokio::broadcast 封装
///
/// 替代原来 256 行的手写 broker。60 行解决。
pub struct EventBus {
    tx: broadcast::Sender<Arc<PortEvent>>,
}

impl EventBus {
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self { tx }
    }

    pub fn emitter(&self) -> crate::services::emitter::EventEmitter {
        crate::services::emitter::EventEmitter::new(self.tx.clone())
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Arc<PortEvent>> {
        self.tx.subscribe()
    }
}
