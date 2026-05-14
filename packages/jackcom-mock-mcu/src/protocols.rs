/// 独立实现的 CRC-16/Modbus
pub fn crc16_modbus(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 0x0001 != 0 {
                crc >>= 1;
                crc ^= 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    crc
}

/// 构建 Modbus RTU 读保持寄存器响应帧
///
/// slave: 从站地址
/// values: 寄存器值列表
pub fn build_modbus_response(slave: u8, values: &[u16]) -> Vec<u8> {
    let byte_count = (values.len() * 2) as u8;
    let mut data = vec![
        slave,               // 从站地址
        0x03,                // 功能码：读保持寄存器
        byte_count,          // 字节数
    ];
    for &val in values {
        data.push((val >> 8) as u8); // 高字节
        data.push((val & 0xFF) as u8); // 低字节
    }
    let crc = crc16_modbus(&data);
    data.push((crc & 0xFF) as u8);    // CRC 低字节
    data.push((crc >> 8) as u8);      // CRC 高字节
    data
}

/// 构建 AT 命令响应
///
/// command: AT 命令字符串（如 "AT"、"AT+RST"）
pub fn build_at_response(command: &str) -> Vec<u8> {
    match command {
        "AT" => b"\r\nOK\r\n".to_vec(),
        "AT+RST" => b"\r\nOK\r\n\r\nready\r\n".to_vec(),
        "AT+GMR" => b"\r\nAT version:2.0.0\r\nSDK version:v4.0\r\nOK\r\n".to_vec(),
        "AT+CIFSR" => b"\r\n+CIFSR:STAIP,\"192.168.1.100\"\r\nOK\r\n".to_vec(),
        _ => b"\r\nERROR\r\n".to_vec(),
    }
}

/// 构建 JSON 传感器数据
pub fn build_json_payload(temp: f64, hum: f64, pressure: f64) -> Vec<u8> {
    let json = serde_json::json!({
        "temp": (temp * 10.0).round() / 10.0,
        "hum": (hum * 10.0).round() / 10.0,
        "press": (pressure * 10.0).round() / 10.0,
    });
    format!("{}\n", serde_json::to_string(&json).unwrap()).into_bytes()
}

/// 构建随机二进制数据
pub fn build_raw_random(len: usize) -> Vec<u8> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..len).map(|_| rng.gen()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crc16_modbus_known_value() {
        // Modbus CRC-16 标准测试向量
        let data: Vec<u8> = vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A];
        let crc = crc16_modbus(&data);
        // 预期值：0xC5CD（与 jackcom 协议解析器兼容）
        assert_eq!(crc, 0xC5CD);
    }

    #[test]
    fn test_modbus_response_format() {
        let frame = build_modbus_response(1, &[0x001E, 0x001F]);
        // slave=1, func=3, byte_count=4, data=[00,1E,00,1F], CRC(2 bytes)
        assert_eq!(frame.len(), 9); // 3 header + 4 data + 2 CRC
        assert_eq!(frame[0], 1);    // slave
        assert_eq!(frame[1], 0x03); // func
        assert_eq!(frame[2], 4);    // byte count
    }

    #[test]
    fn test_modbus_response_crc_valid() {
        let frame = build_modbus_response(1, &[30, 31, 32]);
        let data = &frame[..frame.len() - 2];
        let crc_bytes = &frame[frame.len() - 2..];
        let expected_crc = crc16_modbus(data);
        let actual_crc = crc_bytes[0] as u16 | ((crc_bytes[1] as u16) << 8);
        assert_eq!(expected_crc, actual_crc);
    }

    #[test]
    fn test_at_response_ok() {
        let resp = build_at_response("AT");
        let s = String::from_utf8_lossy(&resp);
        assert!(s.contains("OK"));
    }

    #[test]
    fn test_at_response_rst() {
        let resp = build_at_response("AT+RST");
        let s = String::from_utf8_lossy(&resp);
        assert!(s.contains("OK"));
        assert!(s.contains("ready"));
    }

    #[test]
    fn test_at_response_unknown() {
        let resp = build_at_response("AT+UNKNOWN");
        let s = String::from_utf8_lossy(&resp);
        assert!(s.contains("ERROR"));
    }

    #[test]
    fn test_json_payload() {
        let payload = build_json_payload(25.6, 60.1, 1013.0);
        let s = String::from_utf8(payload).unwrap();
        let v: serde_json::Value = serde_json::from_str(s.trim()).unwrap();
        assert_eq!(v["temp"], 25.6);
        assert_eq!(v["hum"], 60.1);
    }

    #[test]
    fn test_raw_random_length() {
        let data = build_raw_random(42);
        assert_eq!(data.len(), 42);
    }
}
