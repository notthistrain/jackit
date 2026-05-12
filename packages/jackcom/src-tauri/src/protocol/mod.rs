use serde::{Deserialize, Serialize};

/// 支持的协议类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProtocolType {
    Raw,
    Modbus,
    AT,
    Json,
}

/// 检测结果
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Detection {
    NeedMore,
    Matched(ProtocolType, usize),
    Rejected,
}

/// 协议检测器 trait
pub trait ProtocolDetector: Send {
    fn feed(&mut self, byte: u8) -> Detection;
    fn reset(&mut self);
    fn protocol_name(&self) -> ProtocolType;
}

/// 解析后的数据（按协议分发）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ParsedData {
    Raw { hex: String, ascii: String },
    Modbus(ModbusData),
    AT(ATData),
    Json(serde_json::Value),
}

/// Modbus 解析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusData {
    pub slave: u8,
    pub function: String,
    pub start_reg: u16,
    pub count: u16,
    pub values: Vec<u16>,
    pub crc_valid: bool,
}

/// AT 命令解析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ATData {
    pub command: String,
    pub is_response: bool,
    pub params: Option<String>,
}

/// 解析错误
#[derive(Debug, Clone, thiserror::Error)]
pub enum ParseError {
    #[error("CRC 校验失败")]
    CrcMismatch,
    #[error("帧长度不足: 期望 {expected}, 实际 {actual}")]
    InsufficientLength { expected: usize, actual: usize },
    #[error("无效的功能码: 0x{0:02X}")]
    InvalidFunctionCode(u8),
    #[error("JSON 解析失败: {0}")]
    JsonError(String),
    #[error("未知协议")]
    UnknownProtocol,
}

/// 协议解析器 trait
pub trait ProtocolParser: Send {
    fn protocol(&self) -> ProtocolType;
    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError>;
    fn format(&self, parsed: &ParsedData) -> String;
}
