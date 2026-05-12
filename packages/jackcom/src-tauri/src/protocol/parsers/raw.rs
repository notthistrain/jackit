use crate::protocol::{Detection, ParsedData, ParseError, ProtocolDetector, ProtocolParser, ProtocolType};

/// 原始数据检测器：始终匹配（兜底协议）
pub struct RawDetector;

impl ProtocolDetector for RawDetector {
    fn feed(&mut self, _byte: u8) -> Detection {
        Detection::Matched(ProtocolType::Raw, 1)
    }

    fn reset(&mut self) {}

    fn protocol_name(&self) -> ProtocolType {
        ProtocolType::Raw
    }
}

/// 原始数据解析器：HEX + ASCII 格式化
pub struct RawParser;

impl ProtocolParser for RawParser {
    fn protocol(&self) -> ProtocolType {
        ProtocolType::Raw
    }

    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        let hex = data.iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ");
        let ascii = data.iter()
            .map(|&b| if b >= 0x20 && b < 0x7F { b as char } else { '.' })
            .collect();
        Ok(ParsedData::Raw { hex, ascii })
    }

    fn format(&self, parsed: &ParsedData) -> String {
        match parsed {
            ParsedData::Raw { hex, ascii } => {
                if hex.is_empty() {
                    return String::new();
                }
                format!("HEX: {} | ASCII: {}", hex, ascii)
            }
            _ => String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_raw_detector_matches_any_byte() {
        let mut det = RawDetector;
        assert_eq!(det.feed(0x00), Detection::Matched(ProtocolType::Raw, 1));
        assert_eq!(det.feed(0xFF), Detection::Matched(ProtocolType::Raw, 1));
        assert_eq!(det.feed(b'A'), Detection::Matched(ProtocolType::Raw, 1));
        assert_eq!(det.feed(0x80), Detection::Matched(ProtocolType::Raw, 1));
    }

    #[test]
    fn test_raw_detector_reset_no_effect() {
        let mut det = RawDetector;
        det.reset();
        assert_eq!(det.feed(0x42), Detection::Matched(ProtocolType::Raw, 1));
    }

    #[test]
    fn test_raw_detector_protocol_name() {
        let det = RawDetector;
        assert_eq!(det.protocol_name(), ProtocolType::Raw);
    }

    #[test]
    fn test_raw_parser_mixed_data() {
        let parser = RawParser;
        let data = b"\x01\x02\x0A\x0DHello";
        let result = parser.parse(data).unwrap();
        match result {
            ParsedData::Raw { hex, ascii } => {
                assert_eq!(hex, "01 02 0A 0D 48 65 6C 6C 6F");
                assert_eq!(ascii, "....Hello");
            }
            _ => panic!("Expected Raw variant"),
        }
    }

    #[test]
    fn test_raw_parser_empty_input() {
        let parser = RawParser;
        let result = parser.parse(b"").unwrap();
        match result {
            ParsedData::Raw { hex, ascii } => {
                assert_eq!(hex, "");
                assert_eq!(ascii, "");
            }
            _ => panic!("Expected Raw variant"),
        }
    }

    #[test]
    fn test_raw_parser_format() {
        let parser = RawParser;
        let data = b"\xAB\xCD";
        let parsed = parser.parse(data).unwrap();
        let formatted = parser.format(&parsed);
        assert_eq!(formatted, "HEX: AB CD | ASCII: ..");
    }

    #[test]
    fn test_raw_parser_format_wrong_variant() {
        let parser = RawParser;
        let parsed = ParsedData::Json(serde_json::json!({"key": "value"}));
        let formatted = parser.format(&parsed);
        assert_eq!(formatted, "");
    }

    #[test]
    fn test_raw_parser_protocol_type() {
        let parser = RawParser;
        assert_eq!(parser.protocol(), ProtocolType::Raw);
    }
}
