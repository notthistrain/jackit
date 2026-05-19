use std::collections::HashMap;

use bytes::Bytes;
use chrono::Utc;

use crate::protocol::parsers::{all_parsers, at_cmd::ATDetector, json_frame::JSONDetector, modbus::ModbusDetector};
use crate::protocol::frame::{Direction, ParsedFrame, RawFrame};
use crate::protocol::{Detection, ParsedData, ProtocolDetector, ProtocolParser, ProtocolType};

/// 最大缓冲字节数：超过此限制时强制刷新为 Raw
const MAX_BUFFER_SIZE: usize = 4096;

/// 判断数据是否全部是空白字符（帧间分隔符）
fn is_all_whitespace(data: &[u8]) -> bool {
    data.iter().all(|&b| matches!(b, b' ' | b'\t' | b'\r' | b'\n'))
}

/// 剥离帧数据的前导和尾随空白字符
/// 返回 (start, end) 切片范围，使 data[start..end] 为干净数据
fn trim_whitespace_range(data: &[u8]) -> (usize, usize) {
    let start = data.iter()
        .position(|&b| !matches!(b, b' ' | b'\t' | b'\r' | b'\n'))
        .unwrap_or(data.len());
    let end = data.iter()
        .rposition(|&b| !matches!(b, b' ' | b'\t' | b'\r' | b'\n'))
        .map(|i| i + 1)
        .unwrap_or(start);
    (start, end.max(start))
}

/// 自动协议检测编排器
///
/// 逐字节喂入多个 Detector，首次匹配后锁定协议。
/// 所有 Detector 拒绝时降级为 Raw。
/// 跨 RawFrame 缓冲未完成的检测数据，避免分片丢失。
pub struct AutoDetector {
    detectors: Vec<Box<dyn ProtocolDetector>>,
    parsers: HashMap<ProtocolType, Box<dyn ProtocolParser>>,
    locked_protocol: Option<ProtocolType>,
    /// 跨帧缓冲：上一次检测未完成时暂存的数据
    buffer: Vec<u8>,
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
            buffer: Vec::new(),
        }
    }

    /// 处理一个 RawFrame，返回解析后的帧列表
    ///
    /// 逐字节检测协议。首次匹配后锁定，后续数据用锁定协议解析。
    /// 如果所有检测器都拒绝，降级为 Raw。
    /// 如果检测器仍在等待更多数据，暂存到 buffer 等待下一次调用。
    pub fn process(&mut self, raw_frame: &RawFrame) -> Vec<ParsedFrame> {
        if self.locked_protocol.is_some() {
            return self.process_locked(raw_frame);
        }
        self.process_with_detection(raw_frame)
    }

    /// 重置检测状态（清除协议锁定，重置所有检测器，清空缓冲）
    pub fn reset(&mut self) {
        self.locked_protocol = None;
        self.buffer.clear();
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

    /// 锁定模式：用锁定的 Parser 解析数据
    ///
    /// 解析失败时缓冲数据等待下一次调用（处理跨帧分片），
    /// 但纯空白数据（帧间分隔符）不缓冲，直接刷新为 Raw。
    /// 解析成功时剥离尾随空白，避免帧间 `\n` 污染 raw data。
    fn process_locked(&mut self, raw_frame: &RawFrame) -> Vec<ParsedFrame> {
        let locked = self.locked_protocol.unwrap();
        let parser = match self.parsers.get(&locked) {
            Some(p) => p,
            None => self.parsers.get(&ProtocolType::Raw).unwrap(),
        };

        // 拼接缓冲数据 + 新数据
        let combined: Vec<u8> = if self.buffer.is_empty() {
            raw_frame.data.to_vec()
        } else {
            let mut v = std::mem::take(&mut self.buffer);
            v.extend_from_slice(&raw_frame.data);
            v
        };

        // 纯空白数据 = 帧间分隔符，静默丢弃，不产生帧
        if is_all_whitespace(&combined) {
            self.buffer.clear();
            return vec![];
        }

        match parser.parse(&combined) {
            Ok(parsed) => {
                // 剥离前导和尾随空白（帧间分隔符 \n 不应出现在帧数据中）
                let (ws_start, ws_end) = trim_whitespace_range(&combined);
                let frame_data = &combined[ws_start..ws_end];
                // 前导和尾随空白保留为缓冲（供下一轮处理或丢弃）
                let mut trailing_buf = Vec::new();
                if ws_start > 0 {
                    // 前导空白丢弃（帧间分隔符）
                }
                if ws_end < combined.len() {
                    trailing_buf.extend_from_slice(&combined[ws_end..]);
                }
                self.buffer = trailing_buf;

                let formatted = parser.format(&parsed);
                vec![ParsedFrame {
                    raw: RawFrame {
                        port_id: raw_frame.port_id.clone(),
                        timestamp: raw_frame.timestamp,
                        data: Bytes::copy_from_slice(frame_data),
                        direction: raw_frame.direction,
                    },
                    protocol: locked,
                    parsed,
                    formatted,
                }]
            }
            Err(_) => {
                // 解析失败 → 缓冲等待更多数据
                if combined.len() <= MAX_BUFFER_SIZE {
                    self.buffer = combined;
                    vec![]
                } else {
                    // 缓冲区超限，强制刷新为 Raw
                    self.buffer.clear();
                    vec![self.make_raw_frame(raw_frame, &combined)]
                }
            }
        }
    }

    /// 检测模式：逐字节喂入所有检测器
    ///
    /// 如果有上一次未完成的缓冲数据，先拼接到本次数据前面再检测。
    /// 如果检测未完成（有活跃检测器仍在 NeedMore），将数据暂存到 buffer。
    fn process_with_detection(&mut self, raw_frame: &RawFrame) -> Vec<ParsedFrame> {
        // 拼接缓冲数据 + 新数据
        let combined: Vec<u8> = if self.buffer.is_empty() {
            raw_frame.data.to_vec()
        } else {
            let mut v = std::mem::take(&mut self.buffer);
            v.extend_from_slice(&raw_frame.data);
            v
        };

        let data = &combined[..];
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
            let mut data_exhausted = true; // 数据是否自然耗尽（非拒绝/非匹配导致退出）

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
                    data_exhausted = false;
                    break;
                }

                if new_active.is_empty() {
                    // 所有检测器都拒绝，Raw 降级
                    data_exhausted = false;
                    frame_end = data.len();
                    break;
                }

                active = new_active;
            }

            // 如果没有匹配且数据自然耗尽（有检测器仍在 NeedMore），缓冲等待更多数据
            if matched.is_none() && data_exhausted {
                let remaining = &data[offset..];
                if is_all_whitespace(remaining) {
                    // 纯空白 = 帧间分隔符，静默丢弃，不缓冲也不产生帧
                } else if remaining.len() <= MAX_BUFFER_SIZE {
                    self.buffer.extend_from_slice(remaining);
                } else {
                    // 缓冲区超限，强制刷新为 Raw
                    frames.push(self.make_raw_frame(raw_frame, remaining));
                }
                break;
            }

            let frame_data = &data[offset..frame_end];

            if let Some(protocol) = matched {
                // 剥离前导和尾随空白（帧间分隔符不应出现在帧数据中）
                let (ws_start, ws_end) = trim_whitespace_range(frame_data);
                let clean_data = &frame_data[ws_start..ws_end];

                if let Some(parser) = self.parsers.get(&protocol) {
                    match parser.parse(clean_data) {
                        Ok(parsed) => {
                            let formatted = parser.format(&parsed);
                            frames.push(ParsedFrame {
                                raw: RawFrame {
                                    port_id: raw_frame.port_id.clone(),
                                    timestamp: raw_frame.timestamp,
                                    data: Bytes::copy_from_slice(clean_data),
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
                            frames.push(self.make_raw_frame(raw_frame, clean_data));
                        }
                    }
                } else {
                    frames.push(self.make_raw_frame(raw_frame, clean_data));
                }
            } else {
                // 所有检测器拒绝
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
        // Modbus 解析失败 → 数据被缓冲等待更多输入（可能是不完整帧）
        assert!(frames.is_empty());
        assert!(!det.buffer.is_empty());

        // 重置后可以恢复正常检测
        det.reset();
        let raw2 = make_raw_frame(br#"{"key":1}"#);
        let frames2 = det.process(&raw2);
        assert_eq!(frames2[0].protocol, ProtocolType::Json);
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
        // 以非协议字节开头，ModbusDetector 可能认为是合法地址，数据会被缓冲
        let raw = make_raw_frame(b"\x00\x01\x02");
        let frames = det.process(&raw);
        // ModbusDetector 仍在 NeedMore，数据被缓冲等待更多输入
        assert!(frames.is_empty());
        assert!(!det.buffer.is_empty());
    }

    #[test]
    fn test_auto_detector_noise_all_rejected() {
        let mut det = AutoDetector::new();
        // 发送足够多的噪声数据，所有检测器都会拒绝
        // 使用 ModbusDetector 不可能接受的字节序列
        let raw = make_raw_frame(b"\xFF\xFF\xFF\xFF\xFF\xFF");
        let frames = det.process(&raw);
        // 所有检测器都拒绝 → Raw 降级
        assert_eq!(frames.len(), 1);
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

    #[test]
    fn test_auto_detector_json_split_across_frames() {
        let mut det = AutoDetector::new();

        // 第一个 chunk: 只有 `{`
        let raw1 = make_raw_frame(b"{");
        let frames1 = det.process(&raw1);
        // 不完整 JSON 应被缓冲，不产生帧
        assert!(frames1.is_empty());

        // 第二个 chunk: `"hum":49.0,"temp":29.0}`
        let raw2 = make_raw_frame(br#""hum":49.0,"temp":29.0}"#);
        let frames2 = det.process(&raw2);
        // 合并后应被检测为完整 JSON
        assert_eq!(frames2.len(), 1);
        assert_eq!(frames2[0].protocol, ProtocolType::Json);
        // 验证 raw_hex 包含完整的 `{...}`
        let raw_hex = crate::protocol::frame::bytes_to_hex(&frames2[0].raw.data);
        assert!(raw_hex.starts_with("7B")); // 0x7B = '{'
    }

    #[test]
    fn test_auto_detector_json_three_way_split() {
        let mut det = AutoDetector::new();

        let raw1 = make_raw_frame(b"{");
        assert!(det.process(&raw1).is_empty());

        let raw2 = make_raw_frame(br#""hum":49.0,"#);
        assert!(det.process(&raw2).is_empty());

        let raw3 = make_raw_frame(br#""temp":29.0}"#);
        let frames = det.process(&raw3);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].protocol, ProtocolType::Json);
    }

    #[test]
    fn test_auto_detector_reset_clears_buffer() {
        let mut det = AutoDetector::new();

        let raw1 = make_raw_frame(b"{");
        assert!(det.process(&raw1).is_empty());

        det.reset();
        assert!(det.buffer.is_empty());

        // 重置后新数据不拼接旧缓冲
        let raw2 = make_raw_frame(br#""hum":49.0}"#);
        let frames = det.process(&raw2);
        // 缺少 `{` 开头，JSONDetector 拒绝 → Raw
        assert_eq!(frames[0].protocol, ProtocolType::Raw);
    }

    /// 模拟用户真实场景：连续多条 JSON 消息，每条都被 OS 分片
    #[test]
    fn test_auto_detector_consecutive_json_messages_split() {
        let mut det = AutoDetector::new();

        // === 第一条 JSON 消息 ===
        // chunk 1: `{`
        let raw1 = make_raw_frame(b"{");
        assert!(det.process(&raw1).is_empty());
        // chunk 2: 完成第一条
        let raw2 = make_raw_frame(br#""temp":25.0,"hum":60.0}"#);
        let frames1 = det.process(&raw2);
        assert_eq!(frames1.len(), 1);
        assert_eq!(frames1[0].protocol, ProtocolType::Json);
        assert!(det.locked_protocol() == Some(ProtocolType::Json));

        // === 第二条 JSON 消息（锁定模式下分片） ===
        // chunk 3: `{` → process_locked → JSONParser 失败 → 应缓冲
        let raw3 = make_raw_frame(b"{");
        let frames_partial = det.process(&raw3);
        assert!(frames_partial.is_empty(), "locked mode should buffer incomplete data");

        // chunk 4: 完成第二条
        let raw4 = make_raw_frame(br#""hum":44.0,"press":1004.0,"temp":24.0}"#);
        let frames2 = det.process(&raw4);
        assert_eq!(frames2.len(), 1);
        assert_eq!(frames2[0].protocol, ProtocolType::Json);
        // 验证完整的 `{...}` 都在
        let raw_hex = crate::protocol::frame::bytes_to_hex(&frames2[0].raw.data);
        assert!(raw_hex.starts_with("7B"), "should contain opening brace: got {}", raw_hex);
        assert!(raw_hex.contains("7D"), "should contain closing brace");
    }

    /// 锁定模式下连续三条 JSON 消息都分片
    #[test]
    fn test_auto_detector_locked_json_repeated_splits() {
        let mut det = AutoDetector::new();

        // 先让协议锁定
        let raw = make_raw_frame(br#"{"a":1}"#);
        let _ = det.process(&raw);
        assert_eq!(det.locked_protocol(), Some(ProtocolType::Json));

        // 第二条：分两片
        assert!(det.process(&make_raw_frame(b"{")).is_empty());
        let f2 = det.process(&make_raw_frame(br#""b":2}"#));
        assert_eq!(f2.len(), 1);
        assert_eq!(f2[0].protocol, ProtocolType::Json);

        // 第三条：分两片
        assert!(det.process(&make_raw_frame(b"{")).is_empty());
        let f3 = det.process(&make_raw_frame(br#""c":3}"#));
        assert_eq!(f3.len(), 1);
        assert_eq!(f3[0].protocol, ProtocolType::Json);
    }

    /// 模拟真实场景：连续 JSON 消息以 \n 分隔
    /// 每条消息后跟着 \n，不应污染下一帧的 raw data
    #[test]
    fn test_auto_detector_json_with_newline_separators() {
        let mut det = AutoDetector::new();

        // 第一条完整 JSON（process_with_detection）
        let f1 = det.process(&make_raw_frame(br#"{"hum":41.0}"#));
        assert_eq!(f1.len(), 1);
        assert_eq!(f1[0].protocol, ProtocolType::Json);
        // raw data 不应包含多余的 \n
        let hex1 = crate::protocol::frame::bytes_to_hex(&f1[0].raw.data);
        assert!(hex1.ends_with("7D"), "should end with }}: got {}", hex1);
        assert!(!hex1.contains("0A"), "should not contain \\n: got {}", hex1);

        // 协议已锁定
        assert_eq!(det.locked_protocol(), Some(ProtocolType::Json));

        // 帧间 \n → 应被静默丢弃（不产生帧）
        let sep = det.process(&make_raw_frame(b"\n"));
        assert!(sep.is_empty(), "whitespace should be silently discarded, got {} frames", sep.len());

        // 第二条 JSON：干净的，无前导 .
        let f2 = det.process(&make_raw_frame(br#"{"hum":42.0}"#));
        assert_eq!(f2.len(), 1);
        assert_eq!(f2[0].protocol, ProtocolType::Json);
        let hex2 = crate::protocol::frame::bytes_to_hex(&f2[0].raw.data);
        assert!(hex2.starts_with("7B"), "should start with {{: got {}", hex2);
        assert!(hex2.ends_with("7D"), "should end with }}: got {}", hex2);
        assert!(!hex2.contains("0A"), "should not contain \\n: got {}", hex2);

        // 再来 \n + 第三条
        let sep2 = det.process(&make_raw_frame(b"\n"));
        assert!(sep2.is_empty(), "whitespace should be silently discarded");

        let f3 = det.process(&make_raw_frame(br#"{"hum":43.0}"#));
        let hex3 = crate::protocol::frame::bytes_to_hex(&f3[0].raw.data);
        assert!(!hex3.contains("0A"), "frame 3 should not contain \\n");
    }

    /// 锁定模式下，尾随 \n 应被剥离不污染 raw data
    #[test]
    fn test_auto_detector_locked_json_trailing_newline_stripped() {
        let mut det = AutoDetector::new();

        // 先锁定协议
        let _ = det.process(&make_raw_frame(br#"{"a":1}"#));
        assert_eq!(det.locked_protocol(), Some(ProtocolType::Json));

        // 锁定模式下收到带尾随 \n 的数据
        let data = b"{\"b\":2}\n";
        let f = det.process(&make_raw_frame(data));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].protocol, ProtocolType::Json);
        let hex = crate::protocol::frame::bytes_to_hex(&f[0].raw.data);
        assert!(!hex.contains("0A"), "trailing \\n should be stripped: got {}", hex);
    }

    /// process_with_detection 阶段：前导 \n 不应被缓冲到第一帧
    #[test]
    fn test_auto_detector_detection_mode_leading_newline_not_buffered() {
        let mut det = AutoDetector::new();

        // 第一个 chunk: \n（帧前空白）→ 应被静默丢弃，不缓冲不产生帧
        let sep = det.process(&make_raw_frame(b"\n"));
        assert!(sep.is_empty(), "whitespace should be silently discarded, not buffered");
        assert!(det.buffer.is_empty(), "buffer should be empty after whitespace discard");

        // 第二个 chunk: JSON 数据
        let f = det.process(&make_raw_frame(br#"{"hum":44.0,"temp":24.0}"#));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].protocol, ProtocolType::Json);
        let hex = crate::protocol::frame::bytes_to_hex(&f[0].raw.data);
        assert!(hex.starts_with("7B"), "should start with {{, got: {}", hex);
        assert!(!hex.contains("0A"), "should not contain \\n, got: {}", hex);
    }

    /// 关键场景：\n 和 JSON 在同一个 chunk 中到达
    /// 帧数据应被剥离前导/尾随空白，尾随 \n 作为独立 Raw 帧
    #[test]
    fn test_auto_detector_newline_and_json_in_same_chunk_detection_mode() {
        let mut det = AutoDetector::new();

        // OS 将 \n{"hum":44.0,...}\n 作为一个 chunk 交付
        let raw = make_raw_frame(b"\n{\"hum\":44.0,\"temp\":24.0}\n");
        let frames = det.process(&raw);
        // 2 帧：JSON（干净）+ 尾随 \n（Raw）
        assert!(frames.len() >= 1, "should have at least 1 frame");
        assert_eq!(frames[0].protocol, ProtocolType::Json);
        let hex = crate::protocol::frame::bytes_to_hex(&frames[0].raw.data);
        assert!(hex.starts_with("7B"), "should start with {{ after trim, got: {}", hex);
        assert!(hex.ends_with("7D"), "should end with }} after trim, got: {}", hex);
        assert!(!hex.contains("0A"), "should not contain \\n after trim, got: {}", hex);
    }

    /// 锁定模式下：\n 和 JSON 在同一个 chunk 中到达
    #[test]
    fn test_auto_detector_newline_and_json_in_same_chunk_locked_mode() {
        let mut det = AutoDetector::new();

        // 先锁定协议
        let _ = det.process(&make_raw_frame(br#"{"a":1}"#));
        assert_eq!(det.locked_protocol(), Some(ProtocolType::Json));

        // \n{"hum":44.0,...}\n 作为一个 chunk
        let raw = make_raw_frame(b"\n{\"hum\":44.0,\"temp\":24.0}\n");
        let frames = det.process(&raw);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].protocol, ProtocolType::Json);
        let hex = crate::protocol::frame::bytes_to_hex(&frames[0].raw.data);
        assert!(hex.starts_with("7B"), "should start with {{ after trim, got: {}", hex);
        assert!(!hex.contains("0A"), "should not contain \\n, got: {}", hex);
    }
}
