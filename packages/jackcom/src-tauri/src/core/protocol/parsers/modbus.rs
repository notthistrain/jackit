use crate::core::protocol::error::ParseError;
use crate::core::protocol::frame::ParsedData;
use crate::core::protocol::traits::ProtocolParser;
use crate::core::protocol::types::{ModbusData, ProtocolType};

/// Modbus RTU 解析器
pub struct ModbusParser;

/// Modbus CRC-16 查表法
const CRC_TABLE: [u16; 256] = {
    let mut table = [0u16; 256];
    let mut i = 0;
    while i < 256 {
        let mut crc = i as u16;
        let mut j = 0;
        while j < 8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
            j += 1;
        }
        table[i] = crc;
        i += 1;
    }
    table
};

fn crc16(data: &[u8]) -> u16 {
    let mut crc = 0xFFFFu16;
    for &byte in data {
        let index = ((crc ^ byte as u16) & 0xFF) as usize;
        crc = (crc >> 8) ^ CRC_TABLE[index];
    }
    crc
}

impl ModbusParser {
    /// 验证帧完整性：最小长度 + CRC
    fn validate_frame<'a>(&self, data: &'a [u8]) -> Result<(u8, u8, &'a [u8]), ParseError> {
        if data.len() < 4 {
            return Err(ParseError::InsufficientLength {
                expected: 4,
                actual: data.len(),
            });
        }
        // CRC 校验：计算除最后 2 字节外的 CRC
        let payload = &data[..data.len() - 2];
        let crc_received = u16::from_le_bytes([data[data.len() - 2], data[data.len() - 1]]);
        let crc_computed = crc16(payload);
        if crc_received != crc_computed {
            return Err(ParseError::CrcMismatch);
        }
        let slave = data[0];
        let func = data[1];
        let payload = &data[2..data.len() - 2];
        Ok((slave, func, payload))
    }

    fn decode_read(&self, slave: u8, func: u8, payload: &[u8]) -> Result<ParsedData, ParseError> {
        let function_name = match func {
            0x01 => "Read Coils",
            0x02 => "Read Discrete Inputs",
            0x03 => "Read Holding Registers",
            0x04 => "Read Input Registers",
            _ => "Read",
        };

        if payload.is_empty() {
            return Err(ParseError::InvalidFrame("Read 响应无数据".into()));
        }

        let byte_count = payload[0] as usize;
        if payload.len() < 1 + byte_count {
            return Err(ParseError::InsufficientLength {
                expected: 1 + byte_count,
                actual: payload.len(),
            });
        }

        let data_bytes = &payload[1..=byte_count];
        let values: Vec<u16> = if func == 0x01 || func == 0x02 {
            // 按位解码
            data_bytes.iter()
                .flat_map(|&byte| (0..8).map(move |i| ((byte >> i) & 1) as u16))
                .collect()
        } else {
            // 按寄存器解码（每 2 字节一个寄存器）
            data_bytes.chunks(2)
                .map(|chunk| u16::from_be_bytes([chunk[0], chunk.get(1).copied().unwrap_or(0)]))
                .collect()
        };

        Ok(ParsedData::Modbus(ModbusData {
            slave,
            function: function_name.to_string(),
            start_reg: 0,
            count: values.len() as u16,
            values,
            crc_valid: true,
        }))
    }

    fn decode_single_coil(&self, slave: u8, payload: &[u8]) -> Result<ParsedData, ParseError> {
        if payload.len() < 4 {
            return Err(ParseError::InsufficientLength {
                expected: 4,
                actual: payload.len(),
            });
        }
        let start_reg = u16::from_be_bytes([payload[0], payload[1]]);
        let value = u16::from_be_bytes([payload[2], payload[3]]);

        Ok(ParsedData::Modbus(ModbusData {
            slave,
            function: "Write Single Coil".to_string(),
            start_reg,
            count: 1,
            values: vec![value],
            crc_valid: true,
        }))
    }

    fn decode_single_register(&self, slave: u8, payload: &[u8]) -> Result<ParsedData, ParseError> {
        if payload.len() < 4 {
            return Err(ParseError::InsufficientLength {
                expected: 4,
                actual: payload.len(),
            });
        }
        let start_reg = u16::from_be_bytes([payload[0], payload[1]]);
        let value = u16::from_be_bytes([payload[2], payload[3]]);

        Ok(ParsedData::Modbus(ModbusData {
            slave,
            function: "Write Single Register".to_string(),
            start_reg,
            count: 1,
            values: vec![value],
            crc_valid: true,
        }))
    }

    fn decode_write_coils(&self, slave: u8, payload: &[u8]) -> Result<ParsedData, ParseError> {
        if payload.len() < 4 {
            return Err(ParseError::InsufficientLength {
                expected: 4,
                actual: payload.len(),
            });
        }
        let start_reg = u16::from_be_bytes([payload[0], payload[1]]);
        let count = u16::from_be_bytes([payload[2], payload[3]]);

        Ok(ParsedData::Modbus(ModbusData {
            slave,
            function: "Write Multiple Coils".to_string(),
            start_reg,
            count,
            values: vec![],
            crc_valid: true,
        }))
    }

    fn decode_write_registers(&self, slave: u8, payload: &[u8]) -> Result<ParsedData, ParseError> {
        if payload.len() < 4 {
            return Err(ParseError::InsufficientLength {
                expected: 4,
                actual: payload.len(),
            });
        }
        let start_reg = u16::from_be_bytes([payload[0], payload[1]]);
        let count = u16::from_be_bytes([payload[2], payload[3]]);

        Ok(ParsedData::Modbus(ModbusData {
            slave,
            function: "Write Multiple Registers".to_string(),
            start_reg,
            count,
            values: vec![],
            crc_valid: true,
        }))
    }

    fn decode_exception(&self, slave: u8, func: u8, _payload: &[u8]) -> Result<ParsedData, ParseError> {
        let base_func = func & 0x7F;
        Ok(ParsedData::Modbus(ModbusData {
            slave,
            function: format!("Exception (0x{:02X})", base_func),
            start_reg: 0,
            count: 0,
            values: vec![],
            crc_valid: true,
        }))
    }
}

impl ProtocolParser for ModbusParser {
    fn protocol(&self) -> ProtocolType {
        ProtocolType::Modbus
    }

    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        let (addr, func, payload) = self.validate_frame(data)?;
        if func >= 0x80 {
            return self.decode_exception(addr, func, payload);
        }
        match func {
            0x01..=0x04 => self.decode_read(addr, func, payload),
            0x05 => self.decode_single_coil(addr, payload),
            0x06 => self.decode_single_register(addr, payload),
            0x0F => self.decode_write_coils(addr, payload),
            0x10 => self.decode_write_registers(addr, payload),
            _ => Err(ParseError::InvalidFunctionCode(func)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 构建带 CRC 的 Modbus 帧
    fn build_frame(slave: u8, func: u8, data: &[u8]) -> Vec<u8> {
        let mut frame = vec![slave, func];
        frame.extend_from_slice(data);
        let crc = crc16(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());
        frame
    }

    #[test]
    fn modbus_read_holding_registers() {
        // 从站 1, 功能码 03, 4 字节数据 (2 个寄存器: 0x0001, 0x0002)
        let data = &[0x04, 0x00, 0x01, 0x00, 0x02]; // byte_count=4, reg1=0x0001, reg2=0x0002
        let frame = build_frame(0x01, 0x03, data);
        let parser = ModbusParser;
        let result = parser.parse(&frame).unwrap();
        if let ParsedData::Modbus(m) = result {
            assert_eq!(m.slave, 1);
            assert_eq!(m.function, "Read Holding Registers");
            assert_eq!(m.values, vec![1, 2]);
            assert!(m.crc_valid);
        } else {
            panic!("Expected Modbus variant");
        }
    }

    #[test]
    fn modbus_crc_mismatch() {
        let frame = build_frame(0x01, 0x03, &[0x02, 0x00, 0x01]);
        // 破坏 CRC
        let mut bad_frame = frame;
        if let Some(last) = bad_frame.last_mut() {
            *last = last.wrapping_add(1);
        }
        let parser = ModbusParser;
        assert!(matches!(parser.parse(&bad_frame), Err(ParseError::CrcMismatch)));
    }

    #[test]
    fn modbus_too_short() {
        let parser = ModbusParser;
        assert!(matches!(
            parser.parse(&[0x01, 0x03]),
            Err(ParseError::InsufficientLength { .. })
        ));
    }

    #[test]
    fn modbus_exception_response() {
        let frame = build_frame(0x01, 0x83, &[0x02]); // 异常码 02
        let parser = ModbusParser;
        let result = parser.parse(&frame).unwrap();
        if let ParsedData::Modbus(m) = result {
            assert!(m.function.contains("Exception"));
        } else {
            panic!("Expected Modbus variant");
        }
    }

    #[test]
    fn modbus_write_single_register() {
        let frame = build_frame(0x01, 0x06, &[0x00, 0x01, 0x00, 0x03]);
        let parser = ModbusParser;
        let result = parser.parse(&frame).unwrap();
        if let ParsedData::Modbus(m) = result {
            assert_eq!(m.function, "Write Single Register");
            assert_eq!(m.start_reg, 1);
            assert_eq!(m.values, vec![3]);
        } else {
            panic!("Expected Modbus variant");
        }
    }
}
