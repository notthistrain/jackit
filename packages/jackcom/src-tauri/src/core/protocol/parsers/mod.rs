pub mod at_cmd;
pub mod modbus;
pub mod raw;

use crate::core::protocol::error::ParseError;
use crate::core::protocol::frame::ParsedData;
use crate::core::protocol::traits::ProtocolParser;
use crate::core::protocol::types::ProtocolType;

pub use raw::RawParser;

/// Enum dispatch：替代 Box<dyn ProtocolParser>，零运行时开销
pub enum AnyParser {
    Raw(RawParser),
}

impl AnyParser {
    pub fn for_protocol(protocol: ProtocolType) -> Self {
        match protocol {
            ProtocolType::Raw => Self::Raw(RawParser),
            // 其他协议在后续任务中添加
            _ => Self::Raw(RawParser),
        }
    }

    pub fn protocol(&self) -> ProtocolType {
        match self {
            Self::Raw(p) => p.protocol(),
        }
    }

    pub fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        match self {
            Self::Raw(p) => p.parse(data),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn any_parser_raw_dispatch() {
        let raw = AnyParser::for_protocol(ProtocolType::Raw);
        assert_eq!(raw.protocol(), ProtocolType::Raw);
    }
}
