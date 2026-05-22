use serde::{Deserialize, Serialize};

// 直接使用 serialport 的枚举类型，消除映射层
pub use serialport::{DataBits, FlowControl, Parity, StopBits};

/// 串口配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialConfig {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub stop_bits: StopBits,
    pub parity: Parity,
    pub flow_control: FlowControl,
}

/// 常用波特率预设
#[allow(dead_code)]
pub const BAUD_RATES: &[u32] = &[
    1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
];

impl Default for SerialConfig {
    fn default() -> Self {
        Self {
            port_name: String::new(),
            baud_rate: 115200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
        }
    }
}

/// 连接关闭原因
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseReason {
    Disconnected,
    Error,
    Removed,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serial_config_default() {
        let config = SerialConfig::default();
        assert_eq!(config.baud_rate, 115200);
        assert_eq!(config.data_bits, DataBits::Eight);
    }

    #[test]
    fn data_bits_serde() {
        let json = serde_json::to_string(&DataBits::Eight).unwrap();
        assert_eq!(json, "\"Eight\"");
        let back: DataBits = serde_json::from_str("\"Eight\"").unwrap();
        assert_eq!(back, DataBits::Eight);
    }

    #[test]
    fn close_reason_serde() {
        let json = serde_json::to_string(&CloseReason::Disconnected).unwrap();
        assert_eq!(json, "\"disconnected\"");
    }
}
