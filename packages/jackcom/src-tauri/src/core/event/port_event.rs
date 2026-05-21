use serde::Serialize;

use crate::core::protocol::frame::ParsedFrame;
use crate::core::serial::config::{CloseReason, SerialConfig};
use crate::core::serial::types::{Direction, PortName};

/// 端口事件（内部事件总线 + 前端通知共用）
///
/// **Serde 契约**（前端依赖此格式）：
/// - `{"type":"data","port_id":"COM3","frames":[...],"direction":"rx"}`
/// - `{"type":"opened","port_id":"COM3","config":{...}}`
/// - `{"type":"closed","port_id":"COM3","reason":"disconnected"}`
/// - `{"type":"error","port_id":"COM3","error":"..."}`
/// - `{"type":"change","arrived":[...],"removed":[...]}`
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum PortEvent {
    Data {
        port_id: PortName,
        frames: Vec<ParsedFrame>,
        direction: Direction,
    },
    Opened {
        port_id: PortName,
        config: SerialConfig,
    },
    Closed {
        port_id: PortName,
        reason: CloseReason,
    },
    Error {
        port_id: PortName,
        error: String,
    },
    Change {
        arrived: Vec<PortName>,
        removed: Vec<PortName>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_event_data_serde() {
        let event = PortEvent::Data {
            port_id: PortName::new("COM3"),
            frames: vec![],
            direction: Direction::Rx,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"data""#));
        assert!(json.contains(r#""port_id":"COM3""#));
        assert!(json.contains(r#""direction":"rx""#));
    }

    #[test]
    fn port_event_opened_serde() {
        let event = PortEvent::Opened {
            port_id: PortName::new("COM3"),
            config: SerialConfig::default(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"opened""#));
    }

    #[test]
    fn port_event_change_serde() {
        let event = PortEvent::Change {
            arrived: vec![PortName::new("COM4")],
            removed: vec![PortName::new("COM3")],
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"change""#));
        assert!(json.contains(r#""arrived""#));
        assert!(json.contains(r#""removed""#));
    }
}
