use std::sync::OnceLock;

use bytes::Bytes;
use serde::{Deserialize, Serialize};

use super::types::{ATData, ModbusData, ProtocolType};
use super::format::bytes_to_hex;

/// 解析后的数据（按协议分发）
///
/// **Serde 契约**（前端依赖此格式，不可更改）：
/// - `{"type":"raw","data":{"hex":"01 03 FF","ascii":"..."}}`
/// - `{"type":"modbus","data":{"slave":1,"function":"...",...}}`
/// - `{"type":"at","data":{"command":"AT","is_response":false,...}}`
/// - `{"type":"json","data":{...}}`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "lowercase")]
pub enum ParsedData {
    Raw { hex: String, ascii: String },
    Modbus(ModbusData),
    AT(ATData),
    Json(serde_json::Value),
}

/// 解析帧：经 Parser 处理后的结构化数据
#[derive(Debug, Clone)]
pub struct ParsedFrame {
    pub raw: Bytes,
    pub protocol: ProtocolType,
    pub parsed: ParsedData,
    formatted: OnceLock<String>,
}

impl ParsedFrame {
    pub fn new(raw: Bytes, protocol: ProtocolType, parsed: ParsedData) -> Self {
        Self {
            raw,
            protocol,
            parsed,
            formatted: OnceLock::new(),
        }
    }

    /// 获取格式化文本（懒计算，只触发一次）
    pub fn formatted(&self) -> &str {
        self.formatted.get_or_init(|| self.compute_format())
    }

    fn compute_format(&self) -> String {
        match &self.parsed {
            ParsedData::Raw { hex, ascii } => {
                format!("HEX: {hex}\nASCII: {ascii}")
            }
            ParsedData::Modbus(data) => {
                format!(
                    "Modbus RTU | 从站: {} | 功能: {} | 寄存器: {}-{} | 值: {:?}",
                    data.slave, data.function, data.start_reg,
                    data.start_reg + data.count - 1, data.values
                )
            }
            ParsedData::AT(data) => {
                let prefix = if data.is_response { "←" } else { "→" };
                format!("{prefix} AT{}", data.command)
            }
            ParsedData::Json(val) => {
                serde_json::to_string_pretty(val).unwrap_or_default()
            }
        }
    }

    /// 获取摘要文本
    pub fn summary(&self) -> String {
        match &self.parsed {
            ParsedData::Raw { .. } => {
                format!("Raw {} bytes", self.raw.len())
            }
            ParsedData::Modbus(data) => {
                format!("Modbus {} slave={}", data.function, data.slave)
            }
            ParsedData::AT(data) => {
                let kind = if data.is_response { "响应" } else { "命令" };
                format!("AT {} {}", kind, data.command)
            }
            ParsedData::Json(_) => "JSON".to_string(),
        }
    }

    /// 获取 hex 字符串（用于 DB 存储 / 前端 raw_hex 字段）
    pub fn raw_hex(&self) -> String {
        bytes_to_hex(&self.raw)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parsed_data_raw_serde() {
        let data = ParsedData::Raw {
            hex: "01 03 FF".to_string(),
            ascii: "...".to_string(),
        };
        let json = serde_json::to_string(&data).unwrap();
        // 验证 tagged union 格式
        assert!(json.contains(r#""type":"raw""#));
        assert!(json.contains(r#""data""#));
        assert!(json.contains(r#""hex":"01 03 FF""#));
        // roundtrip
        let back: ParsedData = serde_json::from_str(&json).unwrap();
        if let ParsedData::Raw { hex, ascii } = back {
            assert_eq!(hex, "01 03 FF");
            assert_eq!(ascii, "...");
        } else {
            panic!("Expected Raw variant");
        }
    }

    #[test]
    fn parsed_data_modbus_serde() {
        let data = ParsedData::Modbus(ModbusData {
            slave: 1,
            function: "Read Holding Registers".to_string(),
            start_reg: 0,
            count: 10,
            values: vec![100, 200],
            crc_valid: true,
        });
        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains(r#""type":"modbus""#));
        let back: ParsedData = serde_json::from_str(&json).unwrap();
        assert!(matches!(back, ParsedData::Modbus(_)));
    }

    #[test]
    fn parsed_data_json_serde() {
        let inner = serde_json::json!({"key": "value"});
        let data = ParsedData::Json(inner.clone());
        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains(r#""type":"json""#));
        let back: ParsedData = serde_json::from_str(&json).unwrap();
        assert!(matches!(back, ParsedData::Json(_)));
    }

    #[test]
    fn parsed_frame_lazy_format() {
        let frame = ParsedFrame::new(
            Bytes::from_static(&[0x01, 0x03]),
            ProtocolType::Raw,
            ParsedData::Raw {
                hex: "01 03".to_string(),
                ascii: "..".to_string(),
            },
        );
        // 首次调用触发计算
        let fmt = frame.formatted();
        assert!(fmt.contains("HEX: 01 03"));
        // 再次调用不重新计算（OnceLock 保证）
        let fmt2 = frame.formatted();
        assert!(std::ptr::eq(fmt, fmt2));
    }

    #[test]
    fn parsed_frame_summary() {
        let frame = ParsedFrame::new(
            Bytes::from_static(&[0x01, 0x03]),
            ProtocolType::Raw,
            ParsedData::Raw {
                hex: "01 03".to_string(),
                ascii: "..".to_string(),
            },
        );
        assert_eq!(frame.summary(), "Raw 2 bytes");
    }
}
