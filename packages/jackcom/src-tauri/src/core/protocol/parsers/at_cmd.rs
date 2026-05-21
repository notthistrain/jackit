use crate::core::protocol::error::ParseError;
use crate::core::protocol::frame::ParsedData;
use crate::core::protocol::traits::ProtocolParser;
use crate::core::protocol::types::{ATData, ProtocolType};

/// AT 命令解析器
pub struct AtParser;

impl AtParser {
    fn parse_at_line(&self, line: &str) -> Result<ParsedData, ParseError> {
        let trimmed = line.trim_end_matches(|c: char| c == '\r' || c == '\n');
        let trimmed = trimmed.trim();

        if trimmed.is_empty() {
            return Err(ParseError::InvalidFrame("空行".into()));
        }

        // 响应判断：以常见响应前缀开头
        let is_response = trimmed.starts_with("OK")
            || trimmed.starts_with("ERROR")
            || trimmed.starts_with("SEND OK")
            || trimmed.starts_with("SEND FAIL")
            || trimmed.starts_with("busy")
            || trimmed.starts_with("no change")
            || trimmed.starts_with("WIFI")
            || trimmed.starts_with("+");

        if is_response && !trimmed.starts_with("AT") {
            return Ok(ParsedData::AT(ATData {
                command: trimmed.to_string(),
                is_response: true,
                params: None,
            }));
        }

        // 命令格式：AT+CMD=PARAM 或 AT+CMD? 或 AT
        if !trimmed.starts_with("AT") {
            return Err(ParseError::InvalidFrame("不以 AT 开头".into()));
        }

        let after_at = &trimmed[2..];
        if after_at.is_empty() {
            // 纯 AT 测试命令
            return Ok(ParsedData::AT(ATData {
                command: "AT".to_string(),
                is_response: false,
                params: None,
            }));
        }

        // AT+CMD? 或 AT+CMD=PARAM
        if let Some(stripped) = after_at.strip_prefix('+') {
            if let Some(eq_pos) = stripped.find('=') {
                let cmd = &stripped[..eq_pos];
                let params = &stripped[eq_pos + 1..];
                return Ok(ParsedData::AT(ATData {
                    command: format!("AT+{cmd}"),
                    is_response: false,
                    params: Some(params.to_string()),
                }));
            } else {
                // AT+CMD? 或 AT+CMD
                return Ok(ParsedData::AT(ATData {
                    command: format!("AT+{stripped}"),
                    is_response: false,
                    params: None,
                }));
            }
        }

        // 其他 AT 命令（如 ATE0, ATI 等）
        Ok(ParsedData::AT(ATData {
            command: trimmed.to_string(),
            is_response: false,
            params: None,
        }))
    }
}

impl ProtocolParser for AtParser {
    fn protocol(&self) -> ProtocolType {
        ProtocolType::AT
    }

    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        let text = String::from_utf8_lossy(data);
        self.parse_at_line(&text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn at_test_command() {
        let parser = AtParser;
        let result = parser.parse(b"AT\r\n").unwrap();
        if let ParsedData::AT(data) = result {
            assert_eq!(data.command, "AT");
            assert!(!data.is_response);
            assert!(data.params.is_none());
        } else {
            panic!("Expected AT variant");
        }
    }

    #[test]
    fn at_command_with_params() {
        let parser = AtParser;
        // 注意：不 trim 命令名 — AT+CWJAP 保持完整
        let result = parser.parse(b"AT+CWJAP=\"ssid\",\"pass\"\r\n").unwrap();
        if let ParsedData::AT(data) = result {
            assert_eq!(data.command, "AT+CWJAP");
            assert!(!data.is_response);
            assert_eq!(data.params.unwrap(), "\"ssid\",\"pass\"");
        } else {
            panic!("Expected AT variant");
        }
    }

    #[test]
    fn at_query_command() {
        let parser = AtParser;
        let result = parser.parse(b"AT+CWJAP?\r\n").unwrap();
        if let ParsedData::AT(data) = result {
            assert_eq!(data.command, "AT+CWJAP?");
            assert!(!data.is_response);
        } else {
            panic!("Expected AT variant");
        }
    }

    #[test]
    fn at_response_ok() {
        let parser = AtParser;
        let result = parser.parse(b"OK\r\n").unwrap();
        if let ParsedData::AT(data) = result {
            assert!(data.is_response);
            assert_eq!(data.command, "OK");
        } else {
            panic!("Expected AT variant");
        }
    }

    #[test]
    fn at_response_with_prefix() {
        let parser = AtParser;
        let result = parser.parse(b"+CWJAP:\"ssid\",\"mac\",1,-40\r\n").unwrap();
        if let ParsedData::AT(data) = result {
            assert!(data.is_response);
            assert!(data.command.starts_with('+'));
        } else {
            panic!("Expected AT variant");
        }
    }

    #[test]
    fn at_error_response() {
        let parser = AtParser;
        let result = parser.parse(b"ERROR\r\n").unwrap();
        if let ParsedData::AT(data) = result {
            assert!(data.is_response);
            assert_eq!(data.command, "ERROR");
        } else {
            panic!("Expected AT variant");
        }
    }
}
