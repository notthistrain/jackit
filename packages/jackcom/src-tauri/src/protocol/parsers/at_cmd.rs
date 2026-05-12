use crate::protocol::{Detection, ParsedData, ParseError, ProtocolDetector, ProtocolParser, ProtocolType, ATData};

/// AT 命令检测状态机
#[derive(Debug, Clone, Copy, PartialEq)]
enum ATState {
    /// 等待起始字符
    Idle,
    /// 收到 'A'，等待 'T'
    AfterA,
    /// 收到 "AT"，正在收集命令体
    InCommand,
    /// 收到 'O'，可能是 "OK"
    AfterO,
    /// 收到 "OK"，等待 \r\n
    AfterOK,
    /// 收到 'E'，可能是 "ERROR"
    AfterE,
    /// 收到 "ER"
    AfterER,
    /// 收到 "ERR"
    AfterERR,
    /// 收到 "ERRO"，等待 'R'
    AfterERRO,
    /// 收到 "ERROR"，等待 \r\n
    AfterERROR,
    /// 收到 '+'，正在收集 URC/响应头
    InResponse,
    /// 收到 \r，等待 \n
    AfterCR,
}

/// AT 命令检测器
pub struct ATDetector {
    state: ATState,
    is_command: bool, // true = AT command, false = response
}

impl ATDetector {
    pub fn new() -> Self {
        Self {
            state: ATState::Idle,
            is_command: false,
        }
    }

    fn matched(&self) -> Detection {
        Detection::Matched(ProtocolType::AT, 0)
    }

    fn handle_cr(&mut self, next_state: ATState) -> Detection {
        self.state = next_state;
        Detection::NeedMore
    }

    fn handle_lf(&mut self) -> Detection {
        self.matched()
    }

    fn reject(&mut self) -> Detection {
        self.state = ATState::Idle;
        Detection::Rejected
    }
}

impl ProtocolDetector for ATDetector {
    fn feed(&mut self, byte: u8) -> Detection {
        self.state = match self.state {
            ATState::Idle => match byte {
                b'A' | b'a' => ATState::AfterA,
                b'O' | b'o' => ATState::AfterO,
                b'E' | b'e' => ATState::AfterE,
                b'+' => ATState::InResponse,
                _ => return self.reject(),
            },
            ATState::AfterA => match byte {
                b'T' | b't' => {
                    self.is_command = true;
                    ATState::InCommand
                }
                _ => return self.reject(),
            },
            ATState::InCommand => match byte {
                b'\r' => return self.handle_cr(ATState::AfterCR),
                _ => ATState::InCommand,
            },
            ATState::AfterO => match byte {
                b'K' | b'k' => {
                    self.is_command = false;
                    ATState::AfterOK
                }
                _ => return self.reject(),
            },
            ATState::AfterOK => match byte {
                b'\r' => return self.handle_cr(ATState::AfterCR),
                // "OK" 后跟其他字符（如 "OK!") 仍算作有效响应的一部分
                _ => {
                    self.is_command = false;
                    ATState::InResponse
                }
            },
            ATState::AfterE => match byte {
                b'R' | b'r' => ATState::AfterER,
                _ => return self.reject(),
            },
            ATState::AfterER => match byte {
                b'R' | b'r' => ATState::AfterERR,
                _ => return self.reject(),
            },
            ATState::AfterERR => match byte {
                b'O' | b'o' => ATState::AfterERRO,
                _ => return self.reject(),
            },
            ATState::AfterERRO => match byte {
                b'R' | b'r' => {
                    self.is_command = false;
                    ATState::AfterERROR
                }
                _ => return self.reject(),
            },
            ATState::AfterERROR => match byte {
                b'\r' => return self.handle_cr(ATState::AfterCR),
                _ => {
                    self.is_command = false;
                    ATState::InResponse
                }
            },
            ATState::InResponse => match byte {
                b'\r' => return self.handle_cr(ATState::AfterCR),
                _ => ATState::InResponse,
            },
            ATState::AfterCR => match byte {
                b'\n' => return self.handle_lf(),
                b'\r' => ATState::AfterCR,
                _ => {
                    // \r 后不是 \n，恢复到对应状态
                    if self.is_command {
                        ATState::InCommand
                    } else {
                        ATState::InResponse
                    }
                }
            },
        };

        Detection::NeedMore
    }

    fn reset(&mut self) {
        self.state = ATState::Idle;
        self.is_command = false;
    }

    fn protocol_name(&self) -> ProtocolType {
        ProtocolType::AT
    }
}

/// AT 命令解析器
pub struct ATParser;

impl ProtocolParser for ATParser {
    fn protocol(&self) -> ProtocolType {
        ProtocolType::AT
    }

    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        let text = String::from_utf8_lossy(data);
        let trimmed = text.trim();

        let upper = trimmed.to_uppercase();

        if upper.starts_with("AT") {
            // AT 命令
            let body = trimmed.trim_start_matches(|c: char| c == 'A' || c == 'a' || c == 'T' || c == 't');

            let (command, params) = if body.starts_with('+') {
                let rest = &body[1..];
                if let Some(eq_pos) = rest.find('=') {
                    (format!("+{}", &rest[..eq_pos]), Some(rest[eq_pos + 1..].to_string()))
                } else if rest.ends_with('?') {
                    let name = &rest[..rest.len() - 1];
                    (format!("+{}", name), Some("?".to_string()))
                } else {
                    (format!("+{}", rest), None)
                }
            } else if body.is_empty() {
                ("AT".to_string(), None)
            } else {
                // 扩展命令如 ATE0, ATS0=1, AT&W
                let cmd: String = body.chars().take_while(|c| c.is_alphabetic()).collect();
                let rest = &body[cmd.len()..];
                if rest.is_empty() {
                    (format!("AT{}", cmd), None)
                } else {
                    (format!("AT{}", cmd), Some(rest.to_string()))
                }
            };

            Ok(ParsedData::AT(ATData {
                command,
                is_response: false,
                params,
            }))
        } else {
            // AT 响应
            let (command, params) = if upper == "OK" || upper == "ERROR" {
                (trimmed.to_string(), None)
            } else if trimmed.starts_with('+') {
                if let Some(colon_pos) = trimmed.find(':') {
                    let cmd = trimmed[..colon_pos].to_string();
                    let param_str = trimmed[colon_pos + 1..].trim().to_string();
                    (cmd, if param_str.is_empty() { None } else { Some(param_str) })
                } else {
                    (trimmed.to_string(), None)
                }
            } else {
                (trimmed.to_string(), None)
            };

            Ok(ParsedData::AT(ATData {
                command,
                is_response: true,
                params,
            }))
        }
    }

    fn format(&self, parsed: &ParsedData) -> String {
        match parsed {
            ParsedData::AT(data) => {
                if data.is_response {
                    match &data.params {
                        Some(p) => format!("AT Response ← {} : {}", data.command, p),
                        None => format!("AT Response ← {}", data.command),
                    }
                } else {
                    match &data.params {
                        Some(p) => format!("AT Command → {}={}", data.command, p),
                        None => format!("AT Command → {}", data.command),
                    }
                }
            }
            _ => String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // === Detector 测试 ===

    #[test]
    fn test_at_detector_basic_command() {
        let mut det = ATDetector::new();
        for &b in b"AT\r\n" {
            match det.feed(b) {
                Detection::Matched(_, _) => return,
                Detection::Rejected => panic!("Rejected at byte {}", b),
                Detection::NeedMore => {}
            }
        }
        panic!("Should have matched AT command");
    }

    #[test]
    fn test_at_detector_command_with_params() {
        let mut det = ATDetector::new();
        for &b in b"AT+RST\r\n" {
            match det.feed(b) {
                Detection::Matched(_, _) => return,
                Detection::Rejected => panic!("Rejected"),
                Detection::NeedMore => {}
            }
        }
        panic!("Should have matched");
    }

    #[test]
    fn test_at_detector_ok_response() {
        let mut det = ATDetector::new();
        for &b in b"OK\r\n" {
            match det.feed(b) {
                Detection::Matched(_, _) => return,
                Detection::Rejected => panic!("Rejected"),
                Detection::NeedMore => {}
            }
        }
        panic!("Should have matched OK");
    }

    #[test]
    fn test_at_detector_error_response() {
        let mut det = ATDetector::new();
        for &b in b"ERROR\r\n" {
            match det.feed(b) {
                Detection::Matched(_, _) => return,
                Detection::Rejected => panic!("Rejected"),
                Detection::NeedMore => {}
            }
        }
        panic!("Should have matched ERROR");
    }

    #[test]
    fn test_at_detector_plus_response() {
        let mut det = ATDetector::new();
        for &b in b"+CWJAP:\"MyWiFi\"\r\n" {
            match det.feed(b) {
                Detection::Matched(_, _) => return,
                Detection::Rejected => panic!("Rejected"),
                Detection::NeedMore => {}
            }
        }
        panic!("Should have matched +response");
    }

    #[test]
    fn test_at_detector_rejected_non_at() {
        let mut det = ATDetector::new();
        assert_eq!(det.feed(b'X'), Detection::Rejected);
    }

    #[test]
    fn test_at_detector_reset() {
        let mut det = ATDetector::new();
        let _ = det.feed(b'A');
        det.reset();
        assert_eq!(det.feed(b'X'), Detection::Rejected);
    }

    #[test]
    fn test_at_detector_protocol_name() {
        let det = ATDetector::new();
        assert_eq!(det.protocol_name(), ProtocolType::AT);
    }

    // === Parser 测试 ===

    #[test]
    fn test_at_parser_test_command() {
        let parser = ATParser;
        let result = parser.parse(b"AT\r\n").unwrap();
        match result {
            ParsedData::AT(data) => {
                assert_eq!(data.command, "AT");
                assert!(!data.is_response);
                assert!(data.params.is_none());
            }
            _ => panic!("Expected AT variant"),
        }
    }

    #[test]
    fn test_at_parser_command_with_params() {
        let parser = ATParser;
        let result = parser.parse(b"AT+RST\r\n").unwrap();
        match result {
            ParsedData::AT(data) => {
                assert_eq!(data.command, "+RST");
                assert!(!data.is_response);
                assert!(data.params.is_none());
            }
            _ => panic!("Expected AT variant"),
        }
    }

    #[test]
    fn test_at_parser_command_with_value() {
        let parser = ATParser;
        let result = parser.parse(b"AT+UART=9600,8,1,0,0\r\n").unwrap();
        match result {
            ParsedData::AT(data) => {
                assert_eq!(data.command, "+UART");
                assert!(!data.is_response);
                assert_eq!(data.params.as_deref(), Some("9600,8,1,0,0"));
            }
            _ => panic!("Expected AT variant"),
        }
    }

    #[test]
    fn test_at_parser_query_command() {
        let parser = ATParser;
        let result = parser.parse(b"AT+GMR?\r\n").unwrap();
        match result {
            ParsedData::AT(data) => {
                assert_eq!(data.command, "+GMR");
                assert!(!data.is_response);
                assert_eq!(data.params.as_deref(), Some("?"));
            }
            _ => panic!("Expected AT variant"),
        }
    }

    #[test]
    fn test_at_parser_ok_response() {
        let parser = ATParser;
        let result = parser.parse(b"OK\r\n").unwrap();
        match result {
            ParsedData::AT(data) => {
                assert_eq!(data.command, "OK");
                assert!(data.is_response);
            }
            _ => panic!("Expected AT variant"),
        }
    }

    #[test]
    fn test_at_parser_plus_response() {
        let parser = ATParser;
        let result = parser.parse(b"+CWLAP:\"MyWiFi\",-50,1:aa:bb:cc:dd:ee:ff,6\r\n").unwrap();
        match result {
            ParsedData::AT(data) => {
                assert_eq!(data.command, "+CWLAP");
                assert!(data.is_response);
                assert!(data.params.is_some());
            }
            _ => panic!("Expected AT variant"),
        }
    }

    #[test]
    fn test_at_parser_format_command() {
        let parser = ATParser;
        let parsed = parser.parse(b"AT+RST\r\n").unwrap();
        let formatted = parser.format(&parsed);
        assert_eq!(formatted, "AT Command → +RST");
    }

    #[test]
    fn test_at_parser_format_response() {
        let parser = ATParser;
        let parsed = parser.parse(b"OK\r\n").unwrap();
        let formatted = parser.format(&parsed);
        assert_eq!(formatted, "AT Response ← OK");
    }

    #[test]
    fn test_at_parser_format_response_with_data() {
        let parser = ATParser;
        let parsed = parser.parse(b"+RST:ready\r\n").unwrap();
        let formatted = parser.format(&parsed);
        assert_eq!(formatted, "AT Response ← +RST : ready");
    }

    #[test]
    fn test_at_parser_extended_command() {
        let parser = ATParser;
        let result = parser.parse(b"ATE0\r\n").unwrap();
        match result {
            ParsedData::AT(data) => {
                assert_eq!(data.command, "ATE");
                assert!(!data.is_response);
                assert_eq!(data.params.as_deref(), Some("0"));
            }
            _ => panic!("Expected AT variant"),
        }
    }
}
