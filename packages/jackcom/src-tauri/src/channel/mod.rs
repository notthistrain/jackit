pub mod broker;
pub mod backpressure;

pub use broker::BrokerHandle;

use serde::Serialize;

use crate::protocol::frame::ParsedFrame;
use crate::serial::config::{CloseReason, SerialConfig};

/// Subscriber 唯一标识（一个前端窗口对应一个）
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SubscriberId(String);

impl SubscriberId {
    pub fn new(label: &str) -> Self {
        Self(label.to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for SubscriberId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// 串口事件：Broker 和前端之间的统一消息格式
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum PortEvent {
    /// 收到数据帧（批量，可能包含多个 ParsedFrame）
    Data {
        port_id: String,
        frames: Vec<ParsedFrame>,
    },
    /// 端口已打开
    Opened {
        port_id: String,
        config: SerialConfig,
    },
    /// 端口已关闭
    Closed {
        port_id: String,
        reason: CloseReason,
    },
    /// 端口错误
    Error {
        port_id: String,
        error: String,
    },
    /// 端口列表变更
    Change {
        arrived: Vec<String>,
        removed: Vec<String>,
    },
    /// 端口统计
    Stats {
        port_id: String,
        rx: u64,
        tx: u64,
        fps: u32,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::Bytes;
    use chrono::Utc;
    use crate::protocol::frame::{Direction, RawFrame, ParsedFrame};
    use crate::protocol::{ProtocolType, ParsedData};

    fn make_parsed_frame(port_id: &str, data: &[u8]) -> ParsedFrame {
        let hex: String = data.iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ");
        let ascii: String = data.iter()
            .map(|&b| if b >= 0x20 && b < 0x7F { b as char } else { '.' })
            .collect();
        ParsedFrame {
            raw: RawFrame {
                port_id: port_id.to_string(),
                timestamp: Utc::now(),
                data: Bytes::from(data.to_vec()),
                direction: Direction::Rx,
            },
            protocol: ProtocolType::Raw,
            parsed: ParsedData::Raw { hex, ascii },
            formatted: format!("{:02X?}", data),
        }
    }

    #[test]
    fn port_event_data_serializes_with_type_tag() {
        let frame = make_parsed_frame("COM3", b"\x01\x02\x03");
        let event = PortEvent::Data {
            port_id: "COM3".to_string(),
            frames: vec![frame],
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"data""#));
        assert!(json.contains("COM3"));
    }

    #[test]
    fn port_event_closed_serializes_with_reason() {
        let event = PortEvent::Closed {
            port_id: "COM3".to_string(),
            reason: CloseReason::Disconnected,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"closed""#));
        assert!(json.contains("disconnected"));
    }

    #[test]
    fn port_event_change_has_no_port_id() {
        let event = PortEvent::Change {
            arrived: vec!["COM4".to_string()],
            removed: vec!["COM5".to_string()],
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"change""#));
        assert!(json.contains("COM4"));
        assert!(json.contains("COM5"));
    }

    #[test]
    fn port_event_stats_serializes_numbers() {
        let event = PortEvent::Stats {
            port_id: "COM3".to_string(),
            rx: 1024,
            tx: 512,
            fps: 60,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"stats""#));
        assert!(json.contains("1024"));
        assert!(json.contains("60"));
    }

    #[test]
    fn subscriber_id_display_and_equality() {
        let id1 = SubscriberId::new("main-window");
        let id2 = SubscriberId::new("main-window");
        let id3 = SubscriberId::new("waveform-window");
        assert_eq!(id1, id2);
        assert_ne!(id1, id3);
        assert_eq!(id1.to_string(), "main-window");
        assert_eq!(id1.as_str(), "main-window");
    }
}
