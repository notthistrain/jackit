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
                    let byte_count = (count + 7) / 8;
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
