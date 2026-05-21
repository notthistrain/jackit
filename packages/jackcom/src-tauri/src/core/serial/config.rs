use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DataBits {
    Five,
    Six,
    Seven,
    Eight,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StopBits {
    One,
    Two,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Parity {
    None,
    Odd,
    Even,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlowControl {
    None,
    Hardware,
    Software,
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
    fn data_bits_serde_lowercase() {
        let json = serde_json::to_string(&DataBits::Eight).unwrap();
        assert_eq!(json, "\"eight\"");
        let back: DataBits = serde_json::from_str("\"eight\"").unwrap();
        assert_eq!(back, DataBits::Eight);
    }

    #[test]
    fn close_reason_serde() {
        let json = serde_json::to_string(&CloseReason::Disconnected).unwrap();
        assert_eq!(json, "\"disconnected\"");
    }
}
