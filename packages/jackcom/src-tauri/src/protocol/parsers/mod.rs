pub mod raw;
pub mod json_frame;
pub mod at_cmd;
pub mod modbus;

use std::collections::HashMap;

use crate::protocol::{ProtocolParser, ProtocolType};

pub fn all_parsers() -> HashMap<ProtocolType, Box<dyn ProtocolParser>> {
    let mut parsers: HashMap<ProtocolType, Box<dyn ProtocolParser>> = HashMap::new();
    parsers.insert(ProtocolType::Raw, Box::new(raw::RawParser));
    parsers.insert(ProtocolType::Json, Box::new(json_frame::JSONParser));
    parsers.insert(ProtocolType::AT, Box::new(at_cmd::ATParser));
    parsers.insert(ProtocolType::Modbus, Box::new(modbus::ModbusParser));
    parsers
}
