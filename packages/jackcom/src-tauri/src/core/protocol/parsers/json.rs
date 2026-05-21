use crate::core::protocol::error::ParseError;
use crate::core::protocol::frame::ParsedData;
use crate::core::protocol::traits::ProtocolParser;
use crate::core::protocol::types::ProtocolType;

/// JSON 帧解析器
pub struct JsonParser;

impl ProtocolParser for JsonParser {
    fn protocol(&self) -> ProtocolType {
        ProtocolType::Json
    }

    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        let text = String::from_utf8_lossy(data);
        let trimmed = text.trim();
        let value: serde_json::Value = serde_json::from_str(trimmed)
            .map_err(|e| ParseError::JsonError(e.to_string()))?;
        Ok(ParsedData::Json(value))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_parse_object() {
        let parser = JsonParser;
        let result = parser.parse(b"{\"key\": \"value\"}").unwrap();
        if let ParsedData::Json(val) = result {
            assert_eq!(val["key"], "value");
        } else {
            panic!("Expected Json variant");
        }
    }

    #[test]
    fn json_parse_array() {
        let parser = JsonParser;
        let result = parser.parse(b"[1, 2, 3]").unwrap();
        if let ParsedData::Json(val) = result {
            assert_eq!(val.as_array().unwrap().len(), 3);
        } else {
            panic!("Expected Json variant");
        }
    }

    #[test]
    fn json_parse_invalid() {
        let parser = JsonParser;
        let result = parser.parse(b"not json");
        assert!(matches!(result, Err(ParseError::JsonError(_))));
    }

    #[test]
    fn json_parse_with_whitespace() {
        let parser = JsonParser;
        let result = parser.parse(b"  {\"a\":1}  \n").unwrap();
        if let ParsedData::Json(val) = result {
            assert_eq!(val["a"], 1);
        } else {
            panic!("Expected Json variant");
        }
    }
}
