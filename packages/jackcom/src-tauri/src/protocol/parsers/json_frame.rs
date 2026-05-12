use crate::protocol::{Detection, ParsedData, ParseError, ProtocolDetector, ProtocolParser, ProtocolType};

/// JSON 帧检测器：通过花括号匹配检测完整 JSON 对象
pub struct JSONDetector {
    depth: i32,
    in_string: bool,
    escape_next: bool,
    started: bool,
}

impl JSONDetector {
    pub fn new() -> Self {
        Self {
            depth: 0,
            in_string: false,
            escape_next: false,
            started: false,
        }
    }
}

impl ProtocolDetector for JSONDetector {
    fn feed(&mut self, byte: u8) -> Detection {
        if !self.started {
            match byte {
                b'{' => {
                    self.started = true;
                    self.depth = 1;
                    Detection::NeedMore
                }
                b' ' | b'\t' | b'\r' | b'\n' => Detection::NeedMore,
                _ => Detection::Rejected,
            }
        } else if self.in_string {
            if self.escape_next {
                self.escape_next = false;
                Detection::NeedMore
            } else {
                match byte {
                    b'\\' => {
                        self.escape_next = true;
                        Detection::NeedMore
                    }
                    b'"' => {
                        self.in_string = false;
                        Detection::NeedMore
                    }
                    _ => Detection::NeedMore,
                }
            }
        } else {
            match byte {
                b'"' => {
                    self.in_string = true;
                    Detection::NeedMore
                }
                b'{' => {
                    self.depth += 1;
                    Detection::NeedMore
                }
                b'}' => {
                    self.depth -= 1;
                    if self.depth == 0 {
                        Detection::Matched(ProtocolType::Json, 0)
                    } else {
                        Detection::NeedMore
                    }
                }
                _ => Detection::NeedMore,
            }
        }
    }

    fn reset(&mut self) {
        self.depth = 0;
        self.in_string = false;
        self.escape_next = false;
        self.started = false;
    }

    fn protocol_name(&self) -> ProtocolType {
        ProtocolType::Json
    }
}

/// JSON 帧解析器
pub struct JSONParser;

impl ProtocolParser for JSONParser {
    fn protocol(&self) -> ProtocolType {
        ProtocolType::Json
    }

    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        let text = std::str::from_utf8(data)
            .map_err(|e| ParseError::JsonError(e.to_string()))?;
        let value: serde_json::Value = serde_json::from_str(text)
            .map_err(|e| ParseError::JsonError(e.to_string()))?;
        Ok(ParsedData::Json(value))
    }

    fn format(&self, parsed: &ParsedData) -> String {
        match parsed {
            ParsedData::Json(value) => {
                format!("JSON → {}", serde_json::to_string(value).unwrap_or_default())
            }
            _ => String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_json_detector_simple_object() {
        let mut det = JSONDetector::new();
        assert_eq!(det.feed(b'{'), Detection::NeedMore);
        assert_eq!(det.feed(b'"'), Detection::NeedMore);
        assert_eq!(det.feed(b'k'), Detection::NeedMore);
        assert_eq!(det.feed(b'"'), Detection::NeedMore);
        assert_eq!(det.feed(b':'), Detection::NeedMore);
        assert_eq!(det.feed(b'1'), Detection::NeedMore);
        assert_eq!(det.feed(b'}'), Detection::Matched(ProtocolType::Json, 0));
    }

    #[test]
    fn test_json_detector_nested_object() {
        let mut det = JSONDetector::new();
        for &b in b"{\"a\":{\"b\":1}}" {
            match det.feed(b) {
                Detection::Matched(_, _) => return,
                Detection::Rejected => panic!("Should not reject"),
                Detection::NeedMore => {}
            }
        }
        panic!("Should have matched before end of input");
    }

    #[test]
    fn test_json_detector_rejected_non_json() {
        let mut det = JSONDetector::new();
        assert_eq!(det.feed(b'X'), Detection::Rejected);
    }

    #[test]
    fn test_json_detector_braces_inside_string() {
        let mut det = JSONDetector::new();
        for &b in br#"{"key":"value with { brace }"}"# {
            match det.feed(b) {
                Detection::Matched(_, _) => return,
                Detection::Rejected => panic!("Should not reject, got rejected at byte {}", b),
                Detection::NeedMore => {}
            }
        }
        panic!("Should have matched");
    }

    #[test]
    fn test_json_detector_escaped_quotes() {
        let mut det = JSONDetector::new();
        for &b in br#"{"key":"val\"ue"}"# {
            match det.feed(b) {
                Detection::Matched(_, _) => return,
                Detection::Rejected => panic!("Should not reject"),
                Detection::NeedMore => {}
            }
        }
        panic!("Should have matched");
    }

    #[test]
    fn test_json_detector_reset() {
        let mut det = JSONDetector::new();
        let _ = det.feed(b'{');
        det.reset();
        assert_eq!(det.feed(b'X'), Detection::Rejected);
    }

    #[test]
    fn test_json_parser_valid() {
        let parser = JSONParser;
        let result = parser.parse(br#"{"temp": 25.6, "hum": 60}"#).unwrap();
        match result {
            ParsedData::Json(val) => {
                assert_eq!(val["temp"], 25.6);
                assert_eq!(val["hum"], 60);
            }
            _ => panic!("Expected Json variant"),
        }
    }

    #[test]
    fn test_json_parser_invalid() {
        let parser = JSONParser;
        let result = parser.parse(br#"not json"#);
        assert!(result.is_err());
    }

    #[test]
    fn test_json_parser_format() {
        let parser = JSONParser;
        let parsed = parser.parse(br#"{"key":"val"}"#).unwrap();
        let formatted = parser.format(&parsed);
        assert!(formatted.starts_with("JSON →"));
        assert!(formatted.contains("key"));
    }

    #[test]
    fn test_json_parser_protocol() {
        assert_eq!(JSONParser.protocol(), ProtocolType::Json);
    }

    #[test]
    fn test_json_detector_allows_leading_whitespace() {
        let mut det = JSONDetector::new();
        assert_eq!(det.feed(b' '), Detection::NeedMore);
        assert_eq!(det.feed(b'\n'), Detection::NeedMore);
        assert_eq!(det.feed(b'{'), Detection::NeedMore);
        assert_eq!(det.feed(b'}'), Detection::Matched(ProtocolType::Json, 0));
    }
}
