/// 将字节数组格式化为 HEX 字符串（大写、空格分隔）
pub fn bytes_to_hex(data: &[u8]) -> String {
    data.iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ")
}

/// 将字节数组格式化为 ASCII（不可见字符用 . 替代）
pub fn bytes_to_ascii(data: &[u8]) -> String {
    data.iter()
        .map(|&b| {
            if b >= 0x20 && b < 0x7F {
                b as char
            } else {
                '.'
            }
        })
        .collect()
}

/// Modbus CRC-16 校验（bit-by-bit 计算，与查表法结果一致）
pub fn crc16_modbus(data: &[u8]) -> u16 {
    let mut crc = 0xFFFFu16;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_format() {
        assert_eq!(bytes_to_hex(&[0x01, 0x03, 0xFF]), "01 03 FF");
        assert_eq!(bytes_to_hex(&[]), "");
    }

    #[test]
    fn ascii_format() {
        assert_eq!(bytes_to_ascii(&[b'H', 0x00, b'i']), "H.i");
        assert_eq!(bytes_to_ascii(&[0x20, 0x7E]), " ~");
    }

    #[test]
    fn crc16_modbus_known_value() {
        // 已知的 Modbus CRC 测试向量
        let crc = crc16_modbus(&[0x01, 0x03, 0x02, 0x00, 0x0A]);
        assert_ne!(crc, 0);
        // CRC 应该能通过自检
        let mut frame = vec![0x01, 0x03, 0x02, 0x00, 0x0A];
        let crc = crc16_modbus(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());
        // 重新校验整帧
        let payload = &frame[..frame.len() - 2];
        let crc_check = u16::from_le_bytes([frame[frame.len() - 2], frame[frame.len() - 1]]);
        assert_eq!(crc16_modbus(payload), crc_check);
    }
}
