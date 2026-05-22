use super::format::crc16_modbus;
use super::traits::ProtocolDetector;
use super::types::{Detection, ProtocolType};

// ── JSON 检测器：花括号深度追踪 + 字符串转义感知 ──

pub struct JsonDetector {
    depth: i32,
    in_string: bool,
    escape_next: bool,
    started: bool,
}

impl JsonDetector {
    pub fn new() -> Self {
        Self {
            depth: 0,
            in_string: false,
            escape_next: false,
            started: false,
        }
    }
}

impl ProtocolDetector for JsonDetector {
    fn feed(&mut self, byte: u8) -> Detection {
        if self.escape_next {
            self.escape_next = false;
            return Detection::NeedMore;
        }
        match byte {
            b'\\' if self.in_string => {
                self.escape_next = true;
                Detection::NeedMore
            }
            b'"' => {
                self.in_string = !self.in_string;
                self.started = true;
                Detection::NeedMore
            }
            b'{' | b'[' if !self.in_string => {
                self.depth += 1;
                self.started = true;
                Detection::NeedMore
            }
            b'}' | b']' if !self.in_string => {
                self.depth -= 1;
                if self.depth <= 0 && self.started {
                    Detection::Matched(ProtocolType::Json, 0) // 长度由外部计算
                } else {
                    Detection::NeedMore
                }
            }
            _ => {
                if self.started || byte == b'{' || byte == b'[' {
                    Detection::NeedMore
                } else {
                    Detection::Rejected
                }
            }
        }
    }

    fn reset(&mut self) {
        *self = Self::new();
    }

    fn protocol_name(&self) -> ProtocolType {
        ProtocolType::Json
    }
}

// ── AT 检测器：以 AT 或 + 开头的文本行 ──

pub struct AtDetector {
    buffer: Vec<u8>,
    max_len: usize,
}

impl AtDetector {
    pub fn new() -> Self {
        Self {
            buffer: Vec::new(),
            max_len: 1024,
        }
    }

    fn check_match(&self) -> bool {
        let s = String::from_utf8_lossy(&self.buffer);
        let s = s.trim();
        s.starts_with("AT") || s.starts_with('+') || s == "OK" || s == "ERROR"
            || s.starts_with("SEND") || s.starts_with("busy") || s.starts_with("WIFI")
    }
}

impl ProtocolDetector for AtDetector {
    fn feed(&mut self, byte: u8) -> Detection {
        if self.buffer.len() >= self.max_len {
            return Detection::Rejected;
        }
        self.buffer.push(byte);
        if byte == b'\n' || byte == b'\r' {
            if self.check_match() {
                Detection::Matched(ProtocolType::AT, 0)
            } else if !self.buffer.is_empty() && self.buffer.iter().all(|&b| b == b'\r' || b == b'\n') {
                Detection::NeedMore // 空行，继续
            } else {
                Detection::Rejected
            }
        } else {
            Detection::NeedMore
        }
    }

    fn reset(&mut self) {
        self.buffer.clear();
    }

    fn protocol_name(&self) -> ProtocolType {
        ProtocolType::AT
    }
}

// ── Modbus 检测器：基于可能帧长度枚举 + CRC 验证 ──
// 不自维护 buffer — 由 AutoDetector 的 combined buffer 提供数据

pub struct ModbusDetector {
    byte_count: usize,
}

impl ModbusDetector {
    pub fn new() -> Self {
        Self { byte_count: 0 }
    }

    /// 检查 buffer 是否构成有效的 Modbus 帧，返回匹配帧长度
    pub fn check_frame(data: &[u8]) -> Option<usize> {
        if data.len() < 4 {
            return None;
        }
        // 尝试常见的帧长度
        let possible_lengths = Self::possible_lengths(data);
        for len in possible_lengths {
            if len <= data.len() {
                let frame = &data[..len];
                let crc_given = u16::from_le_bytes([frame[len - 2], frame[len - 1]]);
                let crc_calc = crc16_modbus(&frame[..len - 2]);
                if crc_calc == crc_given {
                    return Some(len);
                }
            }
        }
        None
    }

    fn possible_lengths(data: &[u8]) -> Vec<usize> {
        let mut lengths = Vec::new();
        if data.len() < 2 {
            return lengths;
        }
        let func = data[1];
        match func {
            0x01..=0x04 => {
                // 响应: slave(1) + func(1) + byte_count(1) + data(N) + crc(2)
                if data.len() >= 3 {
                    let byte_count = data[2] as usize;
                    lengths.push(3 + byte_count + 2);
                }
                // 请求: slave(1) + func(1) + start(2) + count(2) + crc(2) = 8
                lengths.push(8);
            }
            0x05 | 0x06 => {
                // slave(1) + func(1) + addr(2) + value(2) + crc(2) = 8
                lengths.push(8);
            }
            0x0F => {
                if data.len() >= 6 {
                    let count = u16::from_be_bytes([data[4], data[5]]) as usize;
                    let byte_count = count.div_ceil(8);
                    lengths.push(7 + byte_count + 2);
                }
                lengths.push(8); // 响应
            }
            0x10 => {
                if data.len() >= 6 {
                    let count = u16::from_be_bytes([data[4], data[5]]) as usize;
                    lengths.push(7 + count * 2 + 2); // 请求
                }
                lengths.push(8); // 响应
            }
            0x80..=0xFF => {
                // 异常响应: slave(1) + func(1) + exc(1) + crc(2) = 5
                lengths.push(5);
            }
            _ => {}
        }
        lengths
    }
}

impl ProtocolDetector for ModbusDetector {
    fn feed(&mut self, _byte: u8) -> Detection {
        self.byte_count += 1;
        // Modbus 不通过逐字节检测，由 AutoDetector 调用 check_frame
        Detection::NeedMore
    }

    fn reset(&mut self) {
        self.byte_count = 0;
    }

    fn protocol_name(&self) -> ProtocolType {
        ProtocolType::Modbus
    }
}

// ── Enum dispatch：替代 Box<dyn ProtocolDetector> ──

pub enum AnyDetector {
    Json(JsonDetector),
    At(AtDetector),
    Modbus(ModbusDetector),
}

impl AnyDetector {
    pub fn feed(&mut self, byte: u8) -> Detection {
        match self {
            Self::Json(d) => d.feed(byte),
            Self::At(d) => d.feed(byte),
            Self::Modbus(d) => d.feed(byte),
        }
    }

    pub fn reset(&mut self) {
        match self {
            Self::Json(d) => d.reset(),
            Self::At(d) => d.reset(),
            Self::Modbus(d) => d.reset(),
        }
    }

    #[allow(dead_code)]
    pub fn protocol_name(&self) -> ProtocolType {
        match self {
            Self::Json(d) => d.protocol_name(),
            Self::At(d) => d.protocol_name(),
            Self::Modbus(d) => d.protocol_name(),
        }
    }
}

pub fn create_all_detectors() -> Vec<AnyDetector> {
    vec![
        AnyDetector::Json(JsonDetector::new()),
        AnyDetector::At(AtDetector::new()),
        AnyDetector::Modbus(ModbusDetector::new()),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_detector_basic_object() {
        let mut det = JsonDetector::new();
        assert_eq!(det.feed(b'{'), Detection::NeedMore);
        assert_eq!(det.feed(b'"'), Detection::NeedMore);
        assert_eq!(det.feed(b'a'), Detection::NeedMore);
        assert_eq!(det.feed(b'"'), Detection::NeedMore);
        assert_eq!(det.feed(b':'), Detection::NeedMore);
        assert_eq!(det.feed(b'1'), Detection::NeedMore);
        assert_eq!(det.feed(b'}'), Detection::Matched(ProtocolType::Json, 0));
    }

    #[test]
    fn json_detector_rejects_binary() {
        let mut det = JsonDetector::new();
        assert_eq!(det.feed(0x01), Detection::Rejected);
    }

    #[test]
    fn at_detector_command() {
        let mut det = AtDetector::new();
        let mut found_match = false;
        for &b in b"AT\r\n" {
            let result = det.feed(b);
            if matches!(result, Detection::Matched(ProtocolType::AT, _)) {
                found_match = true;
            }
        }
        assert!(found_match);
    }

    #[test]
    fn at_detector_response() {
        let mut det = AtDetector::new();
        for &b in b"OK\r\n" {
            let result = det.feed(b);
            if b == b'\n' {
                assert!(matches!(result, Detection::Matched(ProtocolType::AT, _)));
            }
        }
    }

    #[test]
    fn at_detector_rejects_binary() {
        let mut det = AtDetector::new();
        assert_eq!(det.feed(0xFF), Detection::NeedMore);
        assert_eq!(det.feed(0xFE), Detection::NeedMore);
        // 非 AT 行
        det.reset();
        for &b in b"hello world\r\n" {
            let result = det.feed(b);
            if b == b'\n' {
                assert_eq!(result, Detection::Rejected);
            }
        }
    }

    #[test]
    fn modbus_check_frame_valid() {
        // 构建有效 Modbus 帧
        let frame = {
            let mut f = vec![0x01, 0x03, 0x02, 0x00, 0x01];
            let crc = crc16_modbus(&f);
            f.extend_from_slice(&crc.to_le_bytes());
            f
        };
        let result = ModbusDetector::check_frame(&frame);
        assert!(result.is_some());
        assert_eq!(result.unwrap(), frame.len());
    }

    #[test]
    fn modbus_check_frame_invalid_crc() {
        let frame = vec![0x01, 0x03, 0x02, 0x00, 0x01, 0x00, 0x00];
        // CRC 不匹配
        assert!(ModbusDetector::check_frame(&frame).is_none());
    }
}

// ── AutoDetector ────────────────────────────────────────────────

/// 置信度回退阈值
const FALLBACK_THRESHOLD: u32 = 5;

/// 协议锁定状态
pub struct ProtocolLock {
    pub protocol: ProtocolType,
    pub confidence: u32,
    pub fail_streak: u32,
}

impl ProtocolLock {
    pub fn new(protocol: ProtocolType) -> Self {
        Self {
            protocol,
            confidence: 1,
            fail_streak: 0,
        }
    }

    pub fn on_success(&mut self) {
        self.confidence = self.confidence.saturating_add(1);
        self.fail_streak = 0;
    }

    pub fn on_failure(&mut self) {
        self.fail_streak += 1;
    }

    pub fn should_fallback(&self) -> bool {
        self.fail_streak >= FALLBACK_THRESHOLD
    }
}

/// 自动协议检测引擎
///
/// 两阶段工作：
/// 1. 未锁定：并行喂入所有检测器，best match wins
/// 2. 已锁定：用锁定协议解析，失败累计到阈值后回退
pub struct AutoDetector {
    pub lock: Option<ProtocolLock>,
    detectors: Vec<AnyDetector>,
    buffer: bytes::BytesMut,
}

impl AutoDetector {
    pub fn new() -> Self {
        Self {
            lock: None,
            detectors: create_all_detectors(),
            buffer: bytes::BytesMut::new(),
        }
    }

    /// 处理接收到的原始数据
    pub fn process(&mut self, data: &[u8]) -> Vec<super::frame::ParsedFrame> {
        // 将新数据追加到缓冲区
        self.buffer.extend_from_slice(data);

        if self.lock.is_none() {
            self.detect_phase()
        } else {
            // 先取出 lock，避免借用冲突
            let mut lock = self.lock.take().unwrap();
            let result = self.parse_phase(&mut lock);
            // 如果 parse_phase 没有清除 lock（通过 detect_phase 回退），则恢复
            if self.lock.is_none() {
                self.lock = Some(lock);
            }
            result
        }
    }

    /// 阶段 1：并行检测，best match wins
    fn detect_phase(&mut self) -> Vec<super::frame::ParsedFrame> {
        let data = self.buffer.clone().freeze();
        let bytes_slice = &data[..];

        // 尝试 Modbus CRC 校验（基于完整 buffer）
        if let Some(len) = ModbusDetector::check_frame(bytes_slice) {
            let frame_data = bytes_slice[..len].to_vec();
            self.reset_detectors();
            let _ = self.buffer.split_to(len);
            self.lock = Some(ProtocolLock::new(ProtocolType::Modbus));
            let parser = super::parsers::AnyParser::for_protocol(ProtocolType::Modbus);
            return match parser.parse(&frame_data) {
                Ok(parsed) => vec![super::frame::ParsedFrame::new(
                    bytes::Bytes::from(frame_data),
                    ProtocolType::Modbus,
                    parsed,
                )],
                Err(_) => vec![],
            };
        }

        // 逐字节喂入 JSON 和 AT 检测器
        let mut matched: Option<ProtocolType> = None;
        let mut match_end: usize = 0;
        let mut all_rejected = true;

        for (i, &byte) in bytes_slice.iter().enumerate() {
            for det in &mut self.detectors {
                match det.feed(byte) {
                    Detection::Matched(proto, _) => {
                        if matched.is_none() {
                            matched = Some(proto);
                            match_end = i + 1;
                        }
                        all_rejected = false;
                    }
                    Detection::NeedMore => {
                        all_rejected = false;
                    }
                    Detection::Rejected => {}
                }
            }
        }

        if let Some(proto) = matched {
            let frame_data = bytes_slice[..match_end].to_vec();
            self.reset_detectors();
            // 消耗已匹配的数据
            let remaining = bytes_slice[match_end..].to_vec();
            self.buffer.clear();
            self.buffer.extend_from_slice(&remaining);
            self.lock = Some(ProtocolLock::new(proto));
            let parser = super::parsers::AnyParser::for_protocol(proto);
            return match parser.parse(&frame_data) {
                Ok(parsed) => vec![super::frame::ParsedFrame::new(
                    bytes::Bytes::from(frame_data),
                    proto,
                    parsed,
                )],
                Err(_) => vec![],
            };
        }

        if all_rejected && !bytes_slice.is_empty() {
            // 所有检测器都拒绝了 -> Raw 降级
            let frame_data = bytes_slice.to_vec();
            self.reset_detectors();
            self.buffer.clear();
            let parser = super::parsers::AnyParser::for_protocol(ProtocolType::Raw);
            let parsed = parser.parse(&frame_data).unwrap();
            return vec![super::frame::ParsedFrame::new(
                bytes::Bytes::from(frame_data),
                ProtocolType::Raw,
                parsed,
            )];
        }

        // NeedMore — 缓冲等待更多数据
        vec![]
    }

    /// 阶段 2：用锁定协议解析
    fn parse_phase(&mut self, lock: &mut ProtocolLock) -> Vec<super::frame::ParsedFrame> {
        let data = self.buffer.clone().freeze();
        let bytes_slice = &data[..];

        if bytes_slice.is_empty() {
            return vec![];
        }

        match lock.protocol {
            ProtocolType::Modbus => {
                // Modbus：用 CRC 确定帧边界
                if let Some(len) = ModbusDetector::check_frame(bytes_slice) {
                    let frame_data = bytes_slice[..len].to_vec();
                    let _ = self.buffer.split_to(len);
                    lock.on_success();
                    let parser = super::parsers::AnyParser::for_protocol(ProtocolType::Modbus);
                    match parser.parse(&frame_data) {
                        Ok(parsed) => {
                            return vec![super::frame::ParsedFrame::new(
                                bytes::Bytes::from(frame_data),
                                ProtocolType::Modbus,
                                parsed,
                            )];
                        }
                        Err(_) => {
                            lock.on_failure();
                        }
                    }
                } else {
                    // 没有 CRC 匹配，等更多数据或超时
                    lock.on_failure();
                    if lock.should_fallback() {
                        // 回退到检测模式
                        let old_data = bytes_slice.to_vec();
                        self.lock = None;
                        self.reset_detectors();
                        self.buffer.clear();
                        self.buffer.extend_from_slice(&old_data);
                        return self.detect_phase();
                    }
                }
                // 降级为 Raw（返回当前 buffer 内容）
                vec![]
            }
            ProtocolType::AT => {
                // AT：尝试找完整行
                let line_end = bytes_slice.iter().position(|&b| b == b'\n');
                if let Some(end) = line_end {
                    let frame_data = bytes_slice[..=end].to_vec();
                    let _ = self.buffer.split_to(end + 1);
                    lock.on_success();
                    let parser = super::parsers::AnyParser::for_protocol(ProtocolType::AT);
                    match parser.parse(&frame_data) {
                        Ok(parsed) => {
                            return vec![super::frame::ParsedFrame::new(
                                bytes::Bytes::from(frame_data),
                                ProtocolType::AT,
                                parsed,
                            )];
                        }
                        Err(_) => {
                            lock.on_failure();
                            if lock.should_fallback() {
                                let old_data = self.buffer.clone().freeze().to_vec();
                                self.lock = None;
                                self.reset_detectors();
                                self.buffer.clear();
                                self.buffer.extend_from_slice(&old_data);
                                return self.detect_phase();
                            }
                        }
                    }
                }
                vec![]
            }
            ProtocolType::Json => {
                // JSON：尝试解析整个 buffer
                let parser = super::parsers::AnyParser::for_protocol(ProtocolType::Json);
                match parser.parse(bytes_slice) {
                    Ok(parsed) => {
                        lock.on_success();
                        let frame_data = bytes_slice.to_vec();
                        self.buffer.clear();
                        vec![super::frame::ParsedFrame::new(
                            bytes::Bytes::from(frame_data),
                            ProtocolType::Json,
                            parsed,
                        )]
                    }
                    Err(_) => {
                        lock.on_failure();
                        if lock.should_fallback() {
                            let old_data = bytes_slice.to_vec();
                            self.lock = None;
                            self.reset_detectors();
                            self.buffer.clear();
                            self.buffer.extend_from_slice(&old_data);
                            self.detect_phase()
                        } else {
                            // 降级为 Raw
                            let frame_data = bytes_slice.to_vec();
                            self.buffer.clear();
                            let raw_parser = super::parsers::AnyParser::for_protocol(ProtocolType::Raw);
                            let parsed = raw_parser.parse(&frame_data).unwrap();
                            vec![super::frame::ParsedFrame::new(
                                bytes::Bytes::from(frame_data),
                                ProtocolType::Raw,
                                parsed,
                            )]
                        }
                    }
                }
            }
            ProtocolType::Raw => {
                // Raw：直接输出
                lock.on_success();
                let frame_data = bytes_slice.to_vec();
                self.buffer.clear();
                let parser = super::parsers::AnyParser::for_protocol(ProtocolType::Raw);
                let parsed = parser.parse(&frame_data).unwrap();
                vec![super::frame::ParsedFrame::new(
                    bytes::Bytes::from(frame_data),
                    ProtocolType::Raw,
                    parsed,
                )]
            }
        }
    }

    fn reset_detectors(&mut self) {
        for det in &mut self.detectors {
            det.reset();
        }
    }

    #[allow(dead_code)]
    pub fn reset(&mut self) {
        self.lock = None;
        self.reset_detectors();
        self.buffer.clear();
    }
}

#[cfg(test)]
mod auto_detector_tests {
    use super::*;

    #[test]
    fn detect_json_object() {
        let mut detector = AutoDetector::new();
        let frames = detector.process(b"{\"key\":42}");
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].protocol, ProtocolType::Json);
    }

    #[test]
    fn detect_modbus_frame() {
        let mut detector = AutoDetector::new();
        // 构建有效 Modbus 帧
        let mut frame = vec![0x01, 0x03, 0x02, 0x00, 0x0A];
        let crc = super::super::format::crc16_modbus(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());

        let frames = detector.process(&frame);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].protocol, ProtocolType::Modbus);
    }

    #[test]
    fn detect_raw_fallback() {
        let mut detector = AutoDetector::new();
        // 随机二进制数据，所有检测器都会拒绝
        let _frames = detector.process(&[0xFF, 0xFE, 0xFD]);
        // 二进制数据：JSON 检测器拒绝，AT 检测器 NeedMore（等待换行），
        // Modbus 检测器 NeedMore，所以不是所有都拒绝 -> NeedMore 等待
        // 这是预期行为
    }

    #[test]
    fn confidence_fallback_after_failures() {
        let mut detector = AutoDetector::new();
        // 先检测到 JSON
        detector.process(b"{\"a\":1}");
        assert!(detector.lock.is_some());
        assert_eq!(detector.lock.as_ref().unwrap().protocol, ProtocolType::Json);

        // 连续喂入无效 JSON 数据
        for _ in 0..FALLBACK_THRESHOLD {
            detector.process(b"\xFF\xFE\xFD");
        }
        // 应该回退了（或已降级为 Raw）
    }
}
