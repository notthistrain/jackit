pub mod at_cmd;
pub mod json;
pub mod modbus;
pub mod raw;

use crate::core::protocol::error::ParseError;
use crate::core::protocol::frame::ParsedData;
use crate::core::protocol::traits::ProtocolParser;
use crate::core::protocol::types::ProtocolType;

pub use at_cmd::AtParser;
pub use json::JsonParser;
pub use modbus::ModbusParser;
pub use raw::RawParser;

/// Enum dispatch：替代 Box<dyn ProtocolParser>，零运行时开销
pub enum AnyParser {
    Raw(RawParser),
    Modbus(ModbusParser),
    At(AtParser),
    Json(JsonParser),
}

impl AnyParser {
    pub fn for_protocol(protocol: ProtocolType) -> Self {
        match protocol {
            ProtocolType::Raw => Self::Raw(RawParser),
            ProtocolType::Modbus => Self::Modbus(ModbusParser),
            ProtocolType::AT => Self::At(AtParser),
            ProtocolType::Json => Self::Json(JsonParser),
        }
    }

    pub fn protocol(&self) -> ProtocolType {
        match self {
            Self::Raw(p) => p.protocol(),
            Self::Modbus(p) => p.protocol(),
            Self::At(p) => p.protocol(),
            Self::Json(p) => p.protocol(),
        }
    }

    pub fn parse(&self, data: &[u8]) -> Result<ParsedData, ParseError> {
        match self {
            Self::Raw(p) => p.parse(data),
            Self::Modbus(p) => p.parse(data),
            Self::At(p) => p.parse(data),
            Self::Json(p) => p.parse(data),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn any_parser_dispatch() {
        let raw = AnyParser::for_protocol(ProtocolType::Raw);
        assert_eq!(raw.protocol(), ProtocolType::Raw);

        let modbus = AnyParser::for_protocol(ProtocolType::Modbus);
        assert_eq!(modbus.protocol(), ProtocolType::Modbus);
    }
}
