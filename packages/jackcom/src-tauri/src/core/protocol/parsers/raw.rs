use crate::core::protocol::error::ParseError;
use crate::core::protocol::format::{bytes_to_ascii, bytes_to_hex};
use crate::core::protocol::frame::ParsedData;
use crate::core::protocol::traits::ProtocolParser;
use crate::core::protocol::types::ProtocolType;

/// Raw 协议解析器 — 无协议特定逻辑，直接展示 hex + ascii
pub struct RawParser;

impl ProtocolParser for RawParser {
    fn protocol(&self) -> ProtocolType {
        ProtocolType::Raw
    }

    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        Ok(ParsedData::Raw {
            hex: bytes_to_hex(data),
            ascii: bytes_to_ascii(data),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raw_parse_basic() {
        let parser = RawParser;
        assert_eq!(parser.protocol(), ProtocolType::Raw);

        let result = parser.parse(&[0x01, 0x03, 0xFF]).unwrap();
        if let ParsedData::Raw { hex, ascii } = result {
            assert_eq!(hex, "01 03 FF");
            assert_eq!(ascii, "...");
        } else {
            panic!("Expected Raw variant");
        }
    }

    #[test]
    fn raw_parse_empty() {
        let parser = RawParser;
        let result = parser.parse(&[]).unwrap();
        if let ParsedData::Raw { hex, ascii } = result {
            assert_eq!(hex, "");
            assert_eq!(ascii, "");
        } else {
            panic!("Expected Raw variant");
        }
    }

    #[test]
    fn raw_parse_printable_ascii() {
        let parser = RawParser;
        let result = parser.parse(b"Hello").unwrap();
        if let ParsedData::Raw { ascii, .. } = result {
            assert_eq!(ascii, "Hello");
        } else {
            panic!("Expected Raw variant");
        }
    }
}
