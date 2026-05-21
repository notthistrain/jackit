use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::core::protocol::types::ProtocolType;
use crate::core::serial::types::Direction;

/// 前端展示帧 — 字段名必须与前端 TypeScript 类型定义完全一致
///
/// **注意**：`raw_hex` 字段名（不是 `raw_data`）与当前前端一致
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayFrame {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub direction: Direction,
    pub raw_hex: String,
    pub formatted: String,
    pub protocol: ProtocolType,
    pub summary: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_frame_serde_field_names() {
        let frame = DisplayFrame {
            id: 1,
            timestamp: DateTime::UNIX_EPOCH,
            direction: Direction::Rx,
            raw_hex: "01 03".to_string(),
            formatted: "HEX: 01 03".to_string(),
            protocol: ProtocolType::Raw,
            summary: "Raw 2 bytes".to_string(),
        };
        let json = serde_json::to_value(&frame).unwrap();
        // 验证字段名与前端一致
        assert!(json.get("id").is_some());
        assert!(json.get("timestamp").is_some());
        assert!(json.get("direction").is_some());
        assert!(json.get("raw_hex").is_some(), "字段名必须是 raw_hex");
        assert!(json.get("formatted").is_some());
        assert!(json.get("protocol").is_some());
        assert!(json.get("summary").is_some());
        // 不应该有 raw_data 字段
        assert!(json.get("raw_data").is_none());
    }
}
