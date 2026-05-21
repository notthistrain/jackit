use serde::{Deserialize, Serialize};

/// 支持的协议类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProtocolType {
    Raw,
    Modbus,
    AT,
    Json,
}

/// 检测结果
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Detection {
    NeedMore,
    Matched(ProtocolType, usize), // (协议, 匹配长度)
    Rejected,
}

/// Modbus 解析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusData {
    pub slave: u8,
    pub function: String,
    pub start_reg: u16,
    pub count: u16,
    pub values: Vec<u16>,
    pub crc_valid: bool,
}

/// AT 命令解析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ATData {
    pub command: String,
    pub is_response: bool,
    pub params: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protocol_type_serde_lowercase() {
        assert_eq!(serde_json::to_string(&ProtocolType::Raw).unwrap(), "\"raw\"");
        assert_eq!(serde_json::to_string(&ProtocolType::Modbus).unwrap(), "\"modbus\"");
        assert_eq!(serde_json::to_string(&ProtocolType::AT).unwrap(), "\"at\"");
        assert_eq!(serde_json::to_string(&ProtocolType::Json).unwrap(), "\"json\"");
        // roundtrip
        let back: ProtocolType = serde_json::from_str("\"modbus\"").unwrap();
        assert_eq!(back, ProtocolType::Modbus);
    }
}
