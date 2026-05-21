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
}
