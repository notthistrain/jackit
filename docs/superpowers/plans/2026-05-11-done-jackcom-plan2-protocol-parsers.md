# Plan 2: JackCom 协议检测器 + 解析器

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**前置依赖：** Plan 1（项目骨架 + 基础类型）已完成

**目标：** TDD 实现 4 种协议的 Detector + Parser（Raw / JSON / AT Command / Modbus RTU）以及 AutoDetector 编排器，完成协议层的全部核心逻辑

**架构：**
- 每种协议有独立的 Detector（有状态，逐字节检测协议边界）和 Parser（无状态，已知协议后完整解析帧内容）
- AutoDetector 编排多个 Detector 实例，逐字节喂入，首次匹配后锁定协议并委托给对应 Parser
- 所有 Detector 都拒绝时降级为 Raw（兜底）
- Modbus RTU 需要独立的 CRC-16/Modbus 校验实现

**技术栈：** Rust、bytes、serde_json、chrono

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 修改 | `protocol/frame.rs` | ParsedFrame 添加 `parsed: ParsedData` 字段 |
| 创建 | `protocol/parsers/mod.rs` | Parser 注册表 + `all_parsers()` 工厂函数 |
| 创建 | `protocol/parsers/raw.rs` | RawDetector + RawParser |
| 创建 | `protocol/parsers/json_frame.rs` | JSONDetector + JSONParser |
| 创建 | `protocol/parsers/at_cmd.rs` | ATDetector + ATParser |
| 创建 | `protocol/parsers/modbus.rs` | ModbusDetector + ModbusParser + crc16_modbus() + ModbusFunction |
| 创建 | `protocol/detector.rs` | AutoDetector 编排器 |
| 修改 | `protocol/mod.rs` | 注册 parsers 子模块 + detector 子模块 |

---

### 任务 1：Raw Detector + Parser + ParsedFrame 更新

**文件：**
- 修改：`packages/jackcom/src-tauri/src/protocol/frame.rs`
- 创建：`packages/jackcom/src-tauri/src/protocol/parsers/mod.rs`
- 创建：`packages/jackcom/src-tauri/src/protocol/parsers/raw.rs`
- 修改：`packages/jackcom/src-tauri/src/protocol/mod.rs`

- [ ] **步骤 1：更新 ParsedFrame — 添加 parsed 字段**

修改 `protocol/frame.rs`，在 ParsedFrame 中添加 `parsed` 字段：

```rust
// 在 ParsedFrame 结构体中添加 parsed 字段
// 同时确保 use 引用正确

use super::{ParsedData, ProtocolType};

/// 解析帧：经 Parser 处理后的结构化数据
#[derive(Debug, Clone)]
pub struct ParsedFrame {
    pub raw: RawFrame,
    pub protocol: ProtocolType,
    pub parsed: ParsedData,
    pub formatted: String,
}
```

- [ ] **步骤 2：创建 parsers/mod.rs 框架**

```rust
pub mod raw;
// 后续任务逐步添加：
// pub mod json_frame;
// pub mod at_cmd;
// pub mod modbus;

use std::collections::HashMap;

use crate::protocol::{ProtocolParser, ProtocolType};

/// 创建所有协议解析器的注册表
/// 后续任务添加新 Parser 后在此函数中注册
pub fn all_parsers() -> HashMap<ProtocolType, Box<dyn ProtocolParser>> {
    let mut parsers: HashMap<ProtocolType, Box<dyn ProtocolParser>> = HashMap::new();
    parsers.insert(ProtocolType::Raw, Box::new(raw::RawParser));
    parsers
}
```

- [ ] **步骤 3：编写 RawDetector + RawParser 及测试**

创建 `protocol/parsers/raw.rs`：

```rust
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
```

- [ ] **步骤 4：在 protocol/mod.rs 注册 parsers 模块**

在 `protocol/mod.rs` 底部追加：

```rust
pub mod parsers;
```

注意：`detector` 模块在任务 5 创建，暂不添加。

- [ ] **步骤 5：运行测试**

```bash
cd packages/jackcom/src-tauri && cargo test protocol::parsers::raw --lib
```

预期：8 个测试全部 PASS。

- [ ] **步骤 6：验证编译**

```bash
cd packages/jackcom/src-tauri && cargo check
```

- [ ] **步骤 7：Commit**

```bash
git add packages/jackcom/src-tauri/src/protocol/
git commit -m "feat(jackcom): implement RawDetector + RawParser with ParsedFrame update"
```

---

### 任务 2：JSON Detector + Parser

**文件：**
- 创建：`packages/jackcom/src-tauri/src/protocol/parsers/json_frame.rs`
- 修改：`packages/jackcom/src-tauri/src/protocol/parsers/mod.rs`

- [ ] **步骤 1：编写 JSONDetector + JSONParser 及测试**

创建 `protocol/parsers/json_frame.rs`：

```rust
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
                        Detection::Matched(ProtocolType::Json, 0) // consumed 由调用方跟踪
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
        // {"a":{"b":1}}
        for &b in b"{\"a\":{\"b\":1}}" {
            match det.feed(b) {
                Detection::Matched(ProtocolType::Json, _) => return,
                Detection::Rejected => panic!("Should not reject"),
                Detection::NeedMore => {}
            }
        }
        // 应该在最后一个 } 时匹配
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
        // {"key":"value with { brace }"}
        for &b in br#"{"key":"value with { brace }"}"# {
            match det.feed(b) {
                Detection::Matched(ProtocolType::Json, _) => return,
                Detection::Rejected => panic!("Should not reject, got rejected at byte {}", b),
                Detection::NeedMore => {}
            }
        }
        panic!("Should have matched");
    }

    #[test]
    fn test_json_detector_escaped_quotes() {
        let mut det = JSONDetector::new();
        // {"key":"val\"ue"}
        for &b in br#"{"key":"val\"ue"}"# {
            match det.feed(b) {
                Detection::Matched(ProtocolType::Json, _) => return,
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
```

- [ ] **步骤 2：更新 parsers/mod.rs 注册 json_frame**

```rust
pub mod raw;
pub mod json_frame;

use std::collections::HashMap;

use crate::protocol::{ProtocolParser, ProtocolType};

pub fn all_parsers() -> HashMap<ProtocolType, Box<dyn ProtocolParser>> {
    let mut parsers: HashMap<ProtocolType, Box<dyn ProtocolParser>> = HashMap::new();
    parsers.insert(ProtocolType::Raw, Box::new(raw::RawParser));
    parsers.insert(ProtocolType::Json, Box::new(json_frame::JSONParser));
    parsers
}
```

- [ ] **步骤 3：运行测试**

```bash
cd packages/jackcom/src-tauri && cargo test protocol::parsers::json_frame --lib
```

预期：10 个测试全部 PASS。

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/src/protocol/parsers/
git commit -m "feat(jackcom): implement JSONDetector + JSONParser with brace depth tracking"
```

---

### 任务 3：AT Command Detector + Parser

**文件：**
- 创建：`packages/jackcom/src-tauri/src/protocol/parsers/at_cmd.rs`
- 修改：`packages/jackcom/src-tauri/src/protocol/parsers/mod.rs`

- [ ] **步骤 1：编写 ATDetector + ATParser 及测试**

创建 `protocol/parsers/at_cmd.rs`：

```rust
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
                Detection::Matched(ProtocolType::AT, _) => return,
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
                Detection::Matched(ProtocolType::AT, _) => return,
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
                Detection::Matched(ProtocolType::AT, _) => return,
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
                Detection::Matched(ProtocolType::AT, _) => return,
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
                Detection::Matched(ProtocolType::AT, _) => return,
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
```

- [ ] **步骤 2：更新 parsers/mod.rs 注册 at_cmd**

在 `parsers/mod.rs` 中追加 `pub mod at_cmd;` 并在 `all_parsers()` 中注册：

```rust
pub mod raw;
pub mod json_frame;
pub mod at_cmd;

use std::collections::HashMap;

use crate::protocol::{ProtocolParser, ProtocolType};

pub fn all_parsers() -> HashMap<ProtocolType, Box<dyn ProtocolParser>> {
    let mut parsers: HashMap<ProtocolType, Box<dyn ProtocolParser>> = HashMap::new();
    parsers.insert(ProtocolType::Raw, Box::new(raw::RawParser));
    parsers.insert(ProtocolType::Json, Box::new(json_frame::JSONParser));
    parsers.insert(ProtocolType::AT, Box::new(at_cmd::ATParser));
    parsers
}
```

- [ ] **步骤 3：运行测试**

```bash
cd packages/jackcom/src-tauri && cargo test protocol::parsers::at_cmd --lib
```

预期：18 个测试全部 PASS。

- [ ] **步骤 4：Commit**

```bash
git add packages/jackcom/src-tauri/src/protocol/parsers/
git commit -m "feat(jackcom): implement ATDetector + ATParser with state machine"
```

---

### 任务 4：Modbus RTU Detector + Parser + CRC-16

**文件：**
- 创建：`packages/jackcom/src-tauri/src/protocol/parsers/modbus.rs`
- 修改：`packages/jackcom/src-tauri/src/protocol/parsers/mod.rs`

- [ ] **步骤 1：编写 CRC-16/Modbus + ModbusFunction + ModbusDetector + ModbusParser 及测试**

创建 `protocol/parsers/modbus.rs`：

```rust
use serde::{Deserialize, Serialize};

use crate::protocol::{Detection, ParsedData, ParseError, ProtocolDetector, ProtocolParser, ProtocolType};
use crate::protocol::ModbusData;

/// CRC-16/Modbus 校验
/// 多项式: 0xA001（反转的 0x8005）
/// 初始值: 0xFFFF
pub fn crc16_modbus(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    crc
}

/// 验证 Modbus RTU 帧 CRC
fn verify_crc(data: &[u8]) -> bool {
    if data.len() < 4 {
        return false;
    }
    let payload = &data[..data.len() - 2];
    let crc_bytes = &data[data.len() - 2..];
    let expected = u16::from_le_bytes([crc_bytes[0], crc_bytes[1]]);
    crc16_modbus(payload) == expected
}

/// Modbus 功能码枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModbusFunction {
    ReadCoils,
    ReadDiscreteInputs,
    ReadHoldingRegisters,
    ReadInputRegisters,
    WriteSingleCoil,
    WriteSingleRegister,
    WriteMultipleCoils,
    WriteMultipleRegisters,
    Unknown(u8),
}

impl ModbusFunction {
    pub fn from_code(code: u8) -> Self {
        match code {
            0x01 => Self::ReadCoils,
            0x02 => Self::ReadDiscreteInputs,
            0x03 => Self::ReadHoldingRegisters,
            0x04 => Self::ReadInputRegisters,
            0x05 => Self::WriteSingleCoil,
            0x06 => Self::WriteSingleRegister,
            0x0F => Self::WriteMultipleCoils,
            0x10 => Self::WriteMultipleRegisters,
            other => Self::Unknown(other),
        }
    }

    pub fn code(&self) -> u8 {
        match self {
            Self::ReadCoils => 0x01,
            Self::ReadDiscreteInputs => 0x02,
            Self::ReadHoldingRegisters => 0x03,
            Self::ReadInputRegisters => 0x04,
            Self::WriteSingleCoil => 0x05,
            Self::WriteSingleRegister => 0x06,
            Self::WriteMultipleCoils => 0x0F,
            Self::WriteMultipleRegisters => 0x10,
            Self::Unknown(code) => *code,
        }
    }

    pub fn name(&self) -> &str {
        match self {
            Self::ReadCoils => "ReadCoils",
            Self::ReadDiscreteInputs => "ReadDiscreteInputs",
            Self::ReadHoldingRegisters => "ReadHolding",
            Self::ReadInputRegisters => "ReadInput",
            Self::WriteSingleCoil => "WriteSingleCoil",
            Self::WriteSingleRegister => "WriteSingleReg",
            Self::WriteMultipleCoils => "WriteMultiCoils",
            Self::WriteMultipleRegisters => "WriteMultiRegs",
            Self::Unknown(_) => "Unknown",
        }
    }
}

/// 计算 Modbus RTU 帧的可能长度
/// 返回值中包含所有可能的帧长度（请求和响应长度不同）
fn possible_frame_lengths(buffer: &[u8]) -> Vec<usize> {
    if buffer.len() < 2 {
        return vec![];
    }

    let fc = buffer[1];
    let is_exception = fc >= 0x80;
    let actual_fc = fc & 0x7F;

    if is_exception {
        return vec![5]; // addr(1) + fc(1) + ex_code(1) + crc(2)
    }

    match actual_fc {
        0x01..=0x04 => {
            let mut lengths = vec![8]; // 请求: addr(1) + fc(1) + start(2) + count(2) + crc(2)
            if buffer.len() >= 3 {
                let byte_count = buffer[2] as usize;
                if byte_count > 0 && byte_count <= 250 {
                    // 响应: addr(1) + fc(1) + byte_count(1) + data(N) + crc(2)
                    lengths.push(byte_count + 5);
                }
            }
            lengths.sort();
            lengths.dedup();
            lengths
        }
        0x05 | 0x06 => vec![8], // addr(1) + fc(1) + addr(2) + value(2) + crc(2)
        0x0F | 0x10 => {
            let mut lengths = vec![8]; // 响应: addr(1) + fc(1) + start(2) + count(2) + crc(2)
            if buffer.len() >= 7 {
                let byte_count = buffer[6] as usize;
                if byte_count <= 250 {
                    // 请求: addr(1) + fc(1) + start(2) + count(2) + byte_count(1) + data(N) + crc(2)
                    lengths.push(byte_count + 9);
                }
            }
            lengths.sort();
            lengths.dedup();
            lengths
        }
        _ => vec![],
    }
}

/// Modbus RTU 帧检测器
pub struct ModbusDetector {
    buffer: Vec<u8>,
}

/// Modbus RTU 最大帧长度
const MAX_MODBUS_FRAME: usize = 260;

impl ModbusDetector {
    pub fn new() -> Self {
        Self { buffer: Vec::new() }
    }
}

impl ProtocolDetector for ModbusDetector {
    fn feed(&mut self, byte: u8) -> Detection {
        self.buffer.push(byte);

        // 第 1 字节：从站地址有效性检查（0x00-0xF7）
        if self.buffer.len() == 1 {
            if self.buffer[0] > 0xF7 {
                return Detection::Rejected;
            }
            return Detection::NeedMore;
        }

        // 第 2 字节：功能码有效性检查
        if self.buffer.len() == 2 {
            let actual_fc = self.buffer[1] & 0x7F;
            return match actual_fc {
                0x01..=0x06 | 0x0F | 0x10 => Detection::NeedMore,
                _ => Detection::Rejected,
            };
        }

        // 检查当前 buffer 长度是否匹配任何可能的帧长度
        let lengths = possible_frame_lengths(&self.buffer);
        for len in &lengths {
            if self.buffer.len() == *len {
                if verify_crc(&self.buffer) {
                    return Detection::Matched(ProtocolType::Modbus, 0);
                }
                // CRC 不匹配，继续累积（可能是另一个长度）
            }
        }

        // 超过最大帧长度，拒绝
        if self.buffer.len() > MAX_MODBUS_FRAME {
            return Detection::Rejected;
        }

        Detection::NeedMore
    }

    fn reset(&mut self) {
        self.buffer.clear();
    }

    fn protocol_name(&self) -> ProtocolType {
        ProtocolType::Modbus
    }
}

/// Modbus RTU 帧解析器
pub struct ModbusParser;

impl ModbusParser {
    /// 构造 Modbus RTU 请求帧（测试辅助）
    pub fn build_request(slave: u8, func: ModbusFunction, start: u16, count: u16) -> Vec<u8> {
        let mut frame = vec![slave, func.code()];
        frame.extend_from_slice(&start.to_be_bytes());
        frame.extend_from_slice(&count.to_be_bytes());
        let crc = crc16_modbus(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());
        frame
    }

    /// 构造 Modbus RTU 读寄存器响应帧（测试辅助）
    pub fn build_read_response(slave: u8, func: ModbusFunction, values: &[u16]) -> Vec<u8> {
        let byte_count = (values.len() * 2) as u8;
        let mut frame = vec![slave, func.code(), byte_count];
        for &val in values {
            frame.extend_from_slice(&val.to_be_bytes());
        }
        let crc = crc16_modbus(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());
        frame
    }
}

impl ProtocolParser for ModbusParser {
    fn protocol(&self) -> ProtocolType {
        ProtocolType::Modbus
    }

    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        if data.len() < 4 {
            return Err(ParseError::InsufficientLength {
                expected: 4,
                actual: data.len(),
            });
        }

        let crc_valid = verify_crc(data);
        if !crc_valid {
            return Err(ParseError::CrcMismatch);
        }

        let payload = &data[..data.len() - 2];
        let slave = payload[0];
        let fc_raw = payload[1];
        let func = ModbusFunction::from_code(fc_raw);
        let is_exception = fc_raw >= 0x80;

        if is_exception {
            let exception_code = payload.get(2).copied().unwrap_or(0);
            return Ok(ParsedData::Modbus(ModbusData {
                slave,
                function: format!("{} Exception(0x{:02X})", func.name(), exception_code),
                start_reg: 0,
                count: 0,
                values: vec![],
                crc_valid: true,
            }));
        }

        match func {
            ModbusFunction::ReadHoldingRegisters | ModbusFunction::ReadInputRegisters => {
                if payload.len() == 6 {
                    // 请求: slave(1) + fc(1) + start(2) + count(2)
                    let start_reg = u16::from_be_bytes([payload[2], payload[3]]);
                    let count = u16::from_be_bytes([payload[4], payload[5]]);
                    Ok(ParsedData::Modbus(ModbusData {
                        slave,
                        function: func.name().to_string(),
                        start_reg,
                        count,
                        values: vec![],
                        crc_valid: true,
                    }))
                } else if payload.len() >= 3 {
                    // 响应: slave(1) + fc(1) + byte_count(1) + data(N*2)
                    let byte_count = payload[2] as usize;
                    let mut values = Vec::with_capacity(byte_count / 2);
                    for i in 0..byte_count / 2 {
                        let hi = payload.get(3 + i * 2).copied().unwrap_or(0);
                        let lo = payload.get(3 + i * 2 + 1).copied().unwrap_or(0);
                        values.push(u16::from_be_bytes([hi, lo]));
                    }
                    Ok(ParsedData::Modbus(ModbusData {
                        slave,
                        function: func.name().to_string(),
                        start_reg: 0,
                        count: values.len() as u16,
                        values,
                        crc_valid: true,
                    }))
                } else {
                    Err(ParseError::InsufficientLength {
                        expected: 3,
                        actual: payload.len(),
                    })
                }
            }
            ModbusFunction::ReadCoils | ModbusFunction::ReadDiscreteInputs => {
                if payload.len() == 6 {
                    // 请求
                    let start_reg = u16::from_be_bytes([payload[2], payload[3]]);
                    let count = u16::from_be_bytes([payload[4], payload[5]]);
                    Ok(ParsedData::Modbus(ModbusData {
                        slave,
                        function: func.name().to_string(),
                        start_reg,
                        count,
                        values: vec![],
                        crc_valid: true,
                    }))
                } else if payload.len() >= 3 {
                    // 响应: 打包位数据，每个字节代表 8 个线圈/输入
                    let byte_count = payload[2] as usize;
                    let values: Vec<u16> = payload[3..3 + byte_count]
                        .iter()
                        .map(|&b| b as u16)
                        .collect();
                    Ok(ParsedData::Modbus(ModbusData {
                        slave,
                        function: func.name().to_string(),
                        start_reg: 0,
                        count: values.len() as u16,
                        values,
                        crc_valid: true,
                    }))
                } else {
                    Err(ParseError::InsufficientLength {
                        expected: 3,
                        actual: payload.len(),
                    })
                }
            }
            ModbusFunction::WriteSingleCoil | ModbusFunction::WriteSingleRegister => {
                if payload.len() < 5 {
                    return Err(ParseError::InsufficientLength {
                        expected: 5,
                        actual: payload.len(),
                    });
                }
                let address = u16::from_be_bytes([payload[2], payload[3]]);
                let value = u16::from_be_bytes([payload[4], payload[5]]);
                Ok(ParsedData::Modbus(ModbusData {
                    slave,
                    function: func.name().to_string(),
                    start_reg: address,
                    count: 1,
                    values: vec![value],
                    crc_valid: true,
                }))
            }
            ModbusFunction::WriteMultipleCoils | ModbusFunction::WriteMultipleRegisters => {
                if payload.len() == 6 {
                    // 响应: slave(1) + fc(1) + start(2) + count(2)
                    let start_reg = u16::from_be_bytes([payload[2], payload[3]]);
                    let count = u16::from_be_bytes([payload[4], payload[5]]);
                    Ok(ParsedData::Modbus(ModbusData {
                        slave,
                        function: func.name().to_string(),
                        start_reg,
                        count,
                        values: vec![],
                        crc_valid: true,
                    }))
                } else if payload.len() >= 7 {
                    // 请求: slave(1) + fc(1) + start(2) + count(2) + byte_count(1) + data(N)
                    let start_reg = u16::from_be_bytes([payload[2], payload[3]]);
                    let count = u16::from_be_bytes([payload[4], payload[5]]);
                    Ok(ParsedData::Modbus(ModbusData {
                        slave,
                        function: func.name().to_string(),
                        start_reg,
                        count,
                        values: vec![],
                        crc_valid: true,
                    }))
                } else {
                    Err(ParseError::InsufficientLength {
                        expected: 6,
                        actual: payload.len(),
                    })
                }
            }
            ModbusFunction::Unknown(code) => {
                Err(ParseError::InvalidFunctionCode(code))
            }
        }
    }

    fn format(&self, parsed: &ParsedData) -> String {
        match parsed {
            ParsedData::Modbus(data) => {
                if data.values.is_empty() {
                    // 请求或无数据的响应
                    if data.count > 0 {
                        format!(
                            "Modbus RTU → Slave#{} {}(0x{:04X}, {})",
                            data.slave, data.function, data.start_reg, data.count
                        )
                    } else {
                        format!(
                            "Modbus RTU ← Slave#{} {}",
                            data.slave, data.function
                        )
                    }
                } else {
                    // 响应：有数据
                    let vals: Vec<String> = data.values.iter().map(|v| v.to_string()).collect();
                    format!(
                        "Modbus RTU ← Slave#{} {} [{}]",
                        data.slave,
                        data.function,
                        vals.join(",")
                    )
                }
            }
            _ => String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // === CRC-16 测试 ===

    #[test]
    fn test_crc16_known_vector() {
        // 标准测试向量："123456789" → CRC-16/Modbus = 0x4B37
        let data = b"123456789";
        assert_eq!(crc16_modbus(data), 0x4B37);
    }

    #[test]
    fn test_crc16_empty() {
        assert_eq!(crc16_modbus(b""), 0xFFFF);
    }

    #[test]
    fn test_crc16_single_byte() {
        // CRC of [0x00] = 0x40EF (known value)
        assert_eq!(crc16_modbus(b"\x00"), 0x40EF);
    }

    #[test]
    fn test_verify_crc_valid() {
        let mut frame = vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A];
        let crc = crc16_modbus(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());
        assert!(verify_crc(&frame));
    }

    #[test]
    fn test_verify_crc_invalid() {
        let frame = vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xFF, 0xFF]; // wrong CRC
        assert!(!verify_crc(&frame));
    }

    #[test]
    fn test_verify_crc_too_short() {
        assert!(!verify_crc(&[0x01, 0x03]));
        assert!(!verify_crc(&[0x01]));
    }

    // === Detector 测试 ===

    #[test]
    fn test_modbus_detector_read_holding_request() {
        let frame = ModbusParser::build_request(0x01, ModbusFunction::ReadHoldingRegisters, 0x0000, 0x000A);
        let mut det = ModbusDetector::new();
        let mut matched = false;
        for &b in &frame {
            match det.feed(b) {
                Detection::Matched(ProtocolType::Modbus, _) => {
                    matched = true;
                    break;
                }
                Detection::Rejected => panic!("Should not reject"),
                Detection::NeedMore => {}
            }
        }
        assert!(matched, "Should detect Modbus frame");
    }

    #[test]
    fn test_modbus_detector_read_holding_response() {
        let frame = ModbusParser::build_read_response(
            0x01,
            ModbusFunction::ReadHoldingRegisters,
            &[30, 31, 32, 33, 34, 35, 36, 37, 38, 39],
        );
        let mut det = ModbusDetector::new();
        let mut matched = false;
        for &b in &frame {
            match det.feed(b) {
                Detection::Matched(ProtocolType::Modbus, _) => {
                    matched = true;
                    break;
                }
                Detection::Rejected => panic!("Should not reject"),
                Detection::NeedMore => {}
            }
        }
        assert!(matched, "Should detect Modbus response");
    }

    #[test]
    fn test_modbus_detector_invalid_address() {
        let mut det = ModbusDetector::new();
        // 地址 0xF8 无效（最大有效地址 0xF7）
        assert_eq!(det.feed(0xF8), Detection::Rejected);
    }

    #[test]
    fn test_modbus_detector_broadcast_address() {
        let mut det = ModbusDetector::new();
        // 广播地址 0x00 有效
        assert_eq!(det.feed(0x00), Detection::NeedMore);
    }

    #[test]
    fn test_modbus_detector_invalid_function_code() {
        let mut det = ModbusDetector::new();
        assert_eq!(det.feed(0x01), Detection::NeedMore); // valid address
        assert_eq!(det.feed(0x08), Detection::Rejected); // unsupported FC
    }

    #[test]
    fn test_modbus_detector_reset() {
        let mut det = ModbusDetector::new();
        let _ = det.feed(0x01);
        det.reset();
        // 重置后应该能重新开始检测
        assert_eq!(det.feed(0x01), Detection::NeedMore);
    }

    #[test]
    fn test_modbus_detector_protocol_name() {
        let det = ModbusDetector::new();
        assert_eq!(det.protocol_name(), ProtocolType::Modbus);
    }

    #[test]
    fn test_modbus_detector_write_single_reg() {
        let mut frame = vec![0x01, 0x06, 0x00, 0x01, 0x00, 0x03];
        let crc = crc16_modbus(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());

        let mut det = ModbusDetector::new();
        let mut matched = false;
        for &b in &frame {
            match det.feed(b) {
                Detection::Matched(ProtocolType::Modbus, _) => {
                    matched = true;
                    break;
                }
                Detection::Rejected => panic!("Should not reject"),
                Detection::NeedMore => {}
            }
        }
        assert!(matched);
    }

    // === Parser 测试 ===

    #[test]
    fn test_modbus_parser_read_holding_request() {
        let frame = ModbusParser::build_request(0x01, ModbusFunction::ReadHoldingRegisters, 0x0000, 0x000A);
        let parser = ModbusParser;
        let result = parser.parse(&frame).unwrap();
        match result {
            ParsedData::Modbus(data) => {
                assert_eq!(data.slave, 1);
                assert_eq!(data.function, "ReadHolding");
                assert_eq!(data.start_reg, 0);
                assert_eq!(data.count, 10);
                assert!(data.values.is_empty());
                assert!(data.crc_valid);
            }
            _ => panic!("Expected Modbus variant"),
        }
    }

    #[test]
    fn test_modbus_parser_read_holding_response() {
        let values = vec![30, 31, 32, 33, 34, 35, 36, 37, 38, 39];
        let frame = ModbusParser::build_read_response(
            0x01,
            ModbusFunction::ReadHoldingRegisters,
            &values,
        );
        let parser = ModbusParser;
        let result = parser.parse(&frame).unwrap();
        match result {
            ParsedData::Modbus(data) => {
                assert_eq!(data.slave, 1);
                assert_eq!(data.function, "ReadHolding");
                assert_eq!(data.values, values);
                assert!(data.crc_valid);
            }
            _ => panic!("Expected Modbus variant"),
        }
    }

    #[test]
    fn test_modbus_parser_crc_error() {
        let frame = vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xFF, 0xFF];
        let parser = ModbusParser;
        let result = parser.parse(&frame);
        assert!(matches!(result, Err(ParseError::CrcMismatch)));
    }

    #[test]
    fn test_modbus_parser_too_short() {
        let parser = ModbusParser;
        let result = parser.parse(&[0x01, 0x03]);
        assert!(matches!(result, Err(ParseError::InsufficientLength { .. })));
    }

    #[test]
    fn test_modbus_parser_write_single_register() {
        let mut frame = vec![0x01, 0x06, 0x00, 0x01, 0x00, 0x03];
        let crc = crc16_modbus(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());

        let parser = ModbusParser;
        let result = parser.parse(&frame).unwrap();
        match result {
            ParsedData::Modbus(data) => {
                assert_eq!(data.slave, 1);
                assert_eq!(data.function, "WriteSingleReg");
                assert_eq!(data.start_reg, 1);
                assert_eq!(data.values, vec![3]);
                assert!(data.crc_valid);
            }
            _ => panic!("Expected Modbus variant"),
        }
    }

    #[test]
    fn test_modbus_parser_exception_response() {
        // 异常响应: slave=1, FC=0x83 (0x03|0x80), exception=0x02
        let mut frame = vec![0x01, 0x83, 0x02];
        let crc = crc16_modbus(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());

        let parser = ModbusParser;
        let result = parser.parse(&frame).unwrap();
        match result {
            ParsedData::Modbus(data) => {
                assert_eq!(data.slave, 1);
                assert!(data.function.contains("Exception"));
                assert!(data.function.contains("0x02"));
                assert!(data.crc_valid);
            }
            _ => panic!("Expected Modbus variant"),
        }
    }

    #[test]
    fn test_modbus_parser_format_request() {
        let frame = ModbusParser::build_request(0x01, ModbusFunction::ReadHoldingRegisters, 0x0000, 0x000A);
        let parser = ModbusParser;
        let parsed = parser.parse(&frame).unwrap();
        let formatted = parser.format(&parsed);
        assert_eq!(formatted, "Modbus RTU → Slave#1 ReadHolding(0x0000, 10)");
    }

    #[test]
    fn test_modbus_parser_format_response() {
        let values = vec![30, 31, 32, 33, 34, 35, 36, 37, 38, 39];
        let frame = ModbusParser::build_read_response(
            0x01,
            ModbusFunction::ReadHoldingRegisters,
            &values,
        );
        let parser = ModbusParser;
        let parsed = parser.parse(&frame).unwrap();
        let formatted = parser.format(&parsed);
        assert_eq!(
            formatted,
            "Modbus RTU ← Slave#1 ReadHolding [30,31,32,33,34,35,36,37,38,39]"
        );
    }

    #[test]
    fn test_modbus_parser_broadcast_request() {
        let frame = ModbusParser::build_request(0x00, ModbusFunction::ReadHoldingRegisters, 0x0000, 0x0001);
        let parser = ModbusParser;
        let result = parser.parse(&frame).unwrap();
        match result {
            ParsedData::Modbus(data) => {
                assert_eq!(data.slave, 0);
            }
            _ => panic!("Expected Modbus variant"),
        }
    }

    #[test]
    fn test_modbus_parser_invalid_function_code() {
        let mut frame = vec![0x01, 0x07]; // FC 0x07 不在已知列表中
        let crc = crc16_modbus(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());
        let parser = ModbusParser;
        let result = parser.parse(&frame);
        assert!(matches!(result, Err(ParseError::InvalidFunctionCode(0x07))));
    }
}
```

- [ ] **步骤 2：更新 parsers/mod.rs 注册 modbus**

```rust
pub mod raw;
pub mod json_frame;
pub mod at_cmd;
pub mod modbus;

use std::collections::HashMap;

use crate::protocol::{ProtocolParser, ProtocolType};

pub fn all_parsers() -> HashMap<ProtocolType, Box<dyn ProtocolParser>> {
    let mut parsers: HashMap<ProtocolType, Box<dyn ProtocolParser>> = HashMap::new();
    parsers.insert(ProtocolType::Raw, Box::new(raw::RawParser));
    parsers.insert(ProtocolType::Json, Box::new(json_frame::JSONParser));
    parsers.insert(ProtocolType::AT, Box::new(at_cmd::ATParser));
    parsers.insert(ProtocolType::Modbus, Box::new(modbus::ModbusParser));
    parsers
}
```

- [ ] **步骤 3：运行测试**

```bash
cd packages/jackcom/src-tauri && cargo test protocol::parsers::modbus --lib
```

预期：22 个测试全部 PASS（包含 CRC、Detector、Parser 三组）。

- [ ] **步骤 4：运行全部解析器测试**

```bash
cd packages/jackcom/src-tauri && cargo test protocol::parsers --lib
```

预期：所有解析器测试通过。

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src-tauri/src/protocol/parsers/
git commit -m "feat(jackcom): implement ModbusDetector + ModbusParser with CRC-16"
```

---

### 任务 5：AutoDetector 编排器 + 集成测试

**文件：**
- 创建：`packages/jackcom/src-tauri/src/protocol/detector.rs`
- 修改：`packages/jackcom/src-tauri/src/protocol/mod.rs`

- [ ] **步骤 1：编写 AutoDetector 及测试**

创建 `protocol/detector.rs`：

```rust
use std::collections::HashMap;

use bytes::Bytes;
use chrono::Utc;

use crate::protocol::parsers::{all_parsers, at_cmd::ATDetector, json_frame::JSONDetector, modbus::ModbusDetector};
use crate::protocol::frame::{Direction, ParsedFrame, RawFrame};
use crate::protocol::{Detection, ParsedData, ProtocolDetector, ProtocolParser, ProtocolType};

/// 自动协议检测编排器
///
/// 逐字节喂入多个 Detector，首次匹配后锁定协议。
/// 所有 Detector 拒绝时降级为 Raw。
pub struct AutoDetector {
    detectors: Vec<Box<dyn ProtocolDetector>>,
    parsers: HashMap<ProtocolType, Box<dyn ProtocolParser>>,
    locked_protocol: Option<ProtocolType>,
}

impl AutoDetector {
    pub fn new() -> Self {
        let detectors: Vec<Box<dyn ProtocolDetector>> = vec![
            Box::new(JSONDetector::new()),
            Box::new(ATDetector::new()),
            Box::new(ModbusDetector::new()),
        ];
        Self {
            detectors,
            parsers: all_parsers(),
            locked_protocol: None,
        }
    }

    /// 处理一个 RawFrame，返回解析后的帧列表
    ///
    /// 逐字节检测协议。首次匹配后锁定，后续数据用锁定协议解析。
    /// 如果所有检测器都拒绝，降级为 Raw。
    pub fn process(&mut self, raw_frame: &RawFrame) -> Vec<ParsedFrame> {
        if self.locked_protocol.is_some() {
            return self.process_locked(raw_frame);
        }
        self.process_with_detection(raw_frame)
    }

    /// 重置检测状态（清除协议锁定，重置所有检测器）
    pub fn reset(&mut self) {
        self.locked_protocol = None;
        for det in &mut self.detectors {
            det.reset();
        }
    }

    /// 手动锁定到指定协议
    pub fn lock_protocol(&mut self, protocol: ProtocolType) {
        self.locked_protocol = Some(protocol);
    }

    /// 获取当前锁定的协议
    pub fn locked_protocol(&self) -> Option<ProtocolType> {
        self.locked_protocol
    }

    /// 锁定模式：直接用锁定的 Parser 解析整个数据
    fn process_locked(&self, raw_frame: &RawFrame) -> Vec<ParsedFrame> {
        let protocol = self.locked_protocol.unwrap();
        let parser = match self.parsers.get(&protocol) {
            Some(p) => p,
            None => self.parsers.get(&ProtocolType::Raw).unwrap(),
        };

        let parsed = parser.parse(&raw_frame.data).unwrap_or_else(|_| {
            self.parsers
                .get(&ProtocolType::Raw)
                .unwrap()
                .parse(&raw_frame.data)
                .unwrap_or(ParsedData::Raw {
                    hex: String::new(),
                    ascii: String::new(),
                })
        });
        let formatted = parser.format(&parsed);

        vec![ParsedFrame {
            raw: raw_frame.clone(),
            protocol,
            parsed,
            formatted,
        }]
    }

    /// 检测模式：逐字节喂入所有检测器
    fn process_with_detection(&mut self, raw_frame: &RawFrame) -> Vec<ParsedFrame> {
        let data = &raw_frame.data;
        let mut frames = Vec::new();
        let mut offset = 0;

        while offset < data.len() {
            // 重置所有检测器
            for det in &mut self.detectors {
                det.reset();
            }
            let mut active: Vec<usize> = (0..self.detectors.len()).collect();

            let mut matched = None;
            let mut frame_end = data.len(); // 默认消费到末尾

            for i in offset..data.len() {
                let byte = data[i];
                let mut new_active = Vec::new();

                for &idx in &active {
                    match self.detectors[idx].feed(byte) {
                        Detection::NeedMore => new_active.push(idx),
                        Detection::Matched(protocol, _) => {
                            matched = Some(protocol);
                            frame_end = i + 1;
                            break;
                        }
                        Detection::Rejected => {}
                    }
                }

                if matched.is_some() {
                    break;
                }

                if new_active.is_empty() {
                    // 所有检测器都拒绝，Raw 降级
                    frame_end = data.len();
                    break;
                }

                active = new_active;
            }

            let frame_data = &data[offset..frame_end];

            if let Some(protocol) = matched {
                if let Some(parser) = self.parsers.get(&protocol) {
                    match parser.parse(frame_data) {
                        Ok(parsed) => {
                            let formatted = parser.format(&parsed);
                            frames.push(ParsedFrame {
                                raw: RawFrame {
                                    port_id: raw_frame.port_id.clone(),
                                    timestamp: raw_frame.timestamp,
                                    data: Bytes::copy_from_slice(frame_data),
                                    direction: raw_frame.direction,
                                },
                                protocol,
                                parsed,
                                formatted,
                            });
                            self.locked_protocol = Some(protocol);
                        }
                        Err(_) => {
                            // Parser 失败，降级 Raw
                            frames.push(self.make_raw_frame(raw_frame, frame_data));
                        }
                    }
                } else {
                    frames.push(self.make_raw_frame(raw_frame, frame_data));
                }
            } else {
                // 所有检测器拒绝或数据耗尽
                frames.push(self.make_raw_frame(raw_frame, frame_data));
            }

            offset = frame_end;
        }

        frames
    }

    /// 创建 Raw 降级帧
    fn make_raw_frame(&self, raw_frame: &RawFrame, data: &[u8]) -> ParsedFrame {
        let parser = self.parsers.get(&ProtocolType::Raw).unwrap();
        let parsed = parser.parse(data).unwrap();
        let formatted = parser.format(&parsed);
        ParsedFrame {
            raw: RawFrame {
                port_id: raw_frame.port_id.clone(),
                timestamp: raw_frame.timestamp,
                data: Bytes::copy_from_slice(data),
                direction: raw_frame.direction,
            },
            protocol: ProtocolType::Raw,
            parsed,
            formatted,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::parsers::modbus::{ModbusParser, ModbusFunction};

    fn make_raw_frame(data: &[u8]) -> RawFrame {
        RawFrame {
            port_id: "COM3".to_string(),
            timestamp: Utc::now(),
            data: Bytes::copy_from_slice(data),
            direction: Direction::Rx,
        }
    }

    #[test]
    fn test_auto_detector_detect_json() {
        let mut det = AutoDetector::new();
        let raw = make_raw_frame(br#"{"temp": 25.6, "hum": 60.1}"#);
        let frames = det.process(&raw);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].protocol, ProtocolType::Json);
        assert!(frames[0].formatted.contains("JSON"));
    }

    #[test]
    fn test_auto_detector_detect_at_command() {
        let mut det = AutoDetector::new();
        let raw = make_raw_frame(b"AT+RST\r\n");
        let frames = det.process(&raw);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].protocol, ProtocolType::AT);
        assert!(frames[0].formatted.contains("AT Command"));
    }

    #[test]
    fn test_auto_detector_detect_modbus() {
        let mut det = AutoDetector::new();
        let frame_bytes = ModbusParser::build_request(0x01, ModbusFunction::ReadHoldingRegisters, 0x0000, 0x000A);
        let raw = make_raw_frame(&frame_bytes);
        let frames = det.process(&raw);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].protocol, ProtocolType::Modbus);
        assert!(frames[0].formatted.contains("Modbus RTU"));
    }

    #[test]
    fn test_auto_detector_fallback_raw() {
        let mut det = AutoDetector::new();
        // 随机数据，不匹配任何协议
        let raw = make_raw_frame(b"\x02\x1A\xFF\x80");
        let frames = det.process(&raw);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].protocol, ProtocolType::Raw);
    }

    #[test]
    fn test_auto_detector_lock_after_first_detection() {
        let mut det = AutoDetector::new();
        // 先检测 JSON
        let raw1 = make_raw_frame(br#"{"key":1}"#);
        let _ = det.process(&raw1);
        assert_eq!(det.locked_protocol(), Some(ProtocolType::Json));

        // 后续数据直接用 JSON 解析
        let raw2 = make_raw_frame(br#"{"key":2}"#);
        let frames = det.process(&raw2);
        assert_eq!(frames[0].protocol, ProtocolType::Json);
    }

    #[test]
    fn test_auto_detector_manual_lock() {
        let mut det = AutoDetector::new();
        det.lock_protocol(ProtocolType::Modbus);
        assert_eq!(det.locked_protocol(), Some(ProtocolType::Modbus));

        // 即使数据看起来像 JSON，也用 Modbus 解析
        let raw = make_raw_frame(br#"{"key":1}"#);
        let frames = det.process(&raw);
        // Modbus 解析 JSON 数据会失败，降级到 Raw
        assert_eq!(frames[0].protocol, ProtocolType::Raw);
    }

    #[test]
    fn test_auto_detector_reset() {
        let mut det = AutoDetector::new();
        let raw = make_raw_frame(br#"{"key":1}"#);
        let _ = det.process(&raw);
        assert!(det.locked_protocol().is_some());

        det.reset();
        assert!(det.locked_protocol().is_none());

        // 重置后可以重新检测
        let raw2 = make_raw_frame(b"AT+RST\r\n");
        let frames = det.process(&raw2);
        assert_eq!(frames[0].protocol, ProtocolType::AT);
    }

    #[test]
    fn test_auto_detector_json_with_prefix_noise() {
        let mut det = AutoDetector::new();
        // 以非协议字节开头，应降级为 Raw
        let raw = make_raw_frame(b"\x00\x01\x02");
        let frames = det.process(&raw);
        assert_eq!(frames[0].protocol, ProtocolType::Raw);
    }

    #[test]
    fn test_auto_detector_ok_response() {
        let mut det = AutoDetector::new();
        let raw = make_raw_frame(b"OK\r\n");
        let frames = det.process(&raw);
        assert_eq!(frames[0].protocol, ProtocolType::AT);
        assert!(frames[0].formatted.contains("Response"));
    }

    #[test]
    fn test_auto_detector_modbus_response() {
        let mut det = AutoDetector::new();
        let frame_bytes = ModbusParser::build_read_response(
            0x01,
            ModbusFunction::ReadHoldingRegisters,
            &[100, 200, 300],
        );
        let raw = make_raw_frame(&frame_bytes);
        let frames = det.process(&raw);
        assert_eq!(frames[0].protocol, ProtocolType::Modbus);
    }
}
```

- [ ] **步骤 2：在 protocol/mod.rs 注册 detector 模块**

在 `protocol/mod.rs` 底部追加（如果之前只添加了 `pub mod parsers;`）：

```rust
pub mod parsers;
pub mod detector;
```

- [ ] **步骤 3：运行全部测试**

```bash
cd packages/jackcom/src-tauri && cargo test protocol --lib
```

预期：所有测试通过，包括 detectors + parsers 的全部测试。

- [ ] **步骤 4：验证编译**

```bash
cd packages/jackcom/src-tauri && cargo check
```

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom/src-tauri/src/protocol/
git commit -m "feat(jackcom): implement AutoDetector orchestrator with multi-protocol detection"
```

---

## 自检

**规格覆盖度：**
- ✅ ProtocolDetector trait 实现：RawDetector / JSONDetector / ATDetector / ModbusDetector
- ✅ ProtocolParser trait 实现：RawParser / JSONParser / ATParser / ModbusParser
- ✅ AutoDetector 编排器：多检测器同时运行，首次匹配锁定，Raw 兜底
- ✅ CRC-16/Modbus 校验：标准算法 + 已知测试向量
- ✅ ModbusFunction 枚举：8 种标准功能码 + Unknown
- ✅ Parser 注册表：all_parsers() 工厂函数
- ✅ ParsedFrame 更新：添加 parsed 字段
- ✅ 各协议 format() 输出与设计规格一致

**占位符扫描：** 无 TODO/TBD/待定，所有步骤有完整代码和测试。

**类型一致性：**
- ParsedData / ProtocolType / ParseError 在 `protocol/mod.rs` 定义
- ParsedFrame 在 `protocol/frame.rs` 更新（添加 parsed: ParsedData）
- ModbusData / ATData 在 `protocol/mod.rs` 定义，各 Parser 引用一致
- RawFrame / Direction 在 `protocol/frame.rs` 定义
- all_parsers() 返回 `HashMap<ProtocolType, Box<dyn ProtocolParser>>` 与后续 Plan 3/4 的使用兼容
- AutoDetector.process() 接收 `&RawFrame`，返回 `Vec<ParsedFrame>`，与 Plan 3 的 Broker 数据流衔接
