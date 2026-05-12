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
        // CRC of [0x00] = 0x40BF (calculated)
        assert_eq!(crc16_modbus(b"\x00"), 0x40BF);
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
                Detection::Matched(_, _) => {
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
                Detection::Matched(_, _) => {
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
                Detection::Matched(_, _) => {
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
