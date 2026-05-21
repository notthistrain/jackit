use std::sync::Arc;

use tokio::sync::broadcast;

use crate::core::event::port_event::PortEvent;
use crate::core::protocol::frame::ParsedFrame;
use crate::core::serial::config::{CloseReason, SerialConfig};
use crate::core::serial::types::{Direction, PortName};

/// 类型安全的事件发布器
///
/// Clone-friendly：每个需要发布事件的组件持有一个 clone
#[derive(Clone)]
pub struct EventEmitter {
    tx: broadcast::Sender<Arc<PortEvent>>,
}

impl EventEmitter {
    pub fn new(tx: broadcast::Sender<Arc<PortEvent>>) -> Self {
        Self { tx }
    }

    pub fn emit(&self, event: PortEvent) {
        let _ = self.tx.send(Arc::new(event));
    }

    pub fn emit_data(&self, port: PortName, frames: Vec<ParsedFrame>, direction: Direction) {
        self.emit(PortEvent::Data {
            port_id: port,
            frames,
            direction,
        });
    }

    pub fn emit_opened(&self, port: PortName, config: SerialConfig) {
        self.emit(PortEvent::Opened { port_id: port, config });
    }

    pub fn emit_closed(&self, port: PortName, reason: CloseReason) {
        self.emit(PortEvent::Closed { port_id: port, reason });
    }

    #[allow(dead_code)]
    pub fn emit_error(&self, port: PortName, error: String) {
        self.emit(PortEvent::Error { port_id: port, error });
    }

    pub fn emit_change(&self, arrived: Vec<PortName>, removed: Vec<PortName>) {
        self.emit(PortEvent::Change { arrived, removed });
    }
}
