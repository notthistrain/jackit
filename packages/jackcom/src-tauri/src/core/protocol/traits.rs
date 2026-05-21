use super::error::ParseError;
use super::types::ProtocolType;
use super::frame::ParsedData;

/// 协议解析器 trait
pub trait ProtocolParser: Send + Sync {
    fn protocol(&self) -> ProtocolType;
    fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError>;
}

/// 协议检测器 trait（逐字节状态机）
pub trait ProtocolDetector: Send {
    fn feed(&mut self, byte: u8) -> super::types::Detection;
    fn reset(&mut self);
    fn protocol_name(&self) -> ProtocolType;
}
