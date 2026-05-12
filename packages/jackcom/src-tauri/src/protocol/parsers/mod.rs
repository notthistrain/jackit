pub mod raw;

use std::collections::HashMap;

use crate::protocol::{ProtocolParser, ProtocolType};

/// 创建所有协议解析器的注册表
/// 后续任务添加新 Parser 后在此函数中注册
pub fn all_parsers() -> HashMap<ProtocolType, Box<dyn ProtocolParser>> {
    let mut parsers: HashMap<ProtocolType, Box<dyn ProtocolParser>> = HashMap::new();
    parsers.insert(ProtocolType::Raw, Box::new(raw::RawParser));
    parsers
}
