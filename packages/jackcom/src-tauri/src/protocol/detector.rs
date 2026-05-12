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
        let locked = self.locked_protocol.unwrap();
        let parser = match self.parsers.get(&locked) {
            Some(p) => p,
            None => self.parsers.get(&ProtocolType::Raw).unwrap(),
        };

        match parser.parse(&raw_frame.data) {
            Ok(parsed) => {
                let formatted = parser.format(&parsed);
                vec![ParsedFrame {
                    raw: raw_frame.clone(),
                    protocol: locked,
                    parsed,
                    formatted,
                }]
            }
            Err(_) => {
                // 解析失败，降级为 Raw
                let raw_parser = self.parsers.get(&ProtocolType::Raw).unwrap();
                let parsed = raw_parser.parse(&raw_frame.data).unwrap_or(ParsedData::Raw {
                    hex: String::new(),
                    ascii: String::new(),
                });
                let formatted = raw_parser.format(&parsed);
                vec![ParsedFrame {
                    raw: raw_frame.clone(),
                    protocol: ProtocolType::Raw,
                    parsed,
                    formatted,
                }]
            }
        }
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
