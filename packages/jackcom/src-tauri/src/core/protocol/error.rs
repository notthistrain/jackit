/// 协议解析错误
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum ParseError {
    CrcMismatch,
    InsufficientLength { expected: usize, actual: usize },
    InvalidFunctionCode(u8),
    JsonError(String),
    UnknownProtocol,
    InvalidFrame(String),
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::CrcMismatch => write!(f, "CRC 校验失败"),
            ParseError::InsufficientLength { expected, actual } => {
                write!(f, "帧长度不足: 期望 {expected}, 实际 {actual}")
            }
            ParseError::InvalidFunctionCode(code) => {
                write!(f, "无效的功能码: 0x{code:02X}")
            }
            ParseError::JsonError(msg) => write!(f, "JSON 解析失败: {msg}"),
            ParseError::UnknownProtocol => write!(f, "未知协议"),
            ParseError::InvalidFrame(msg) => write!(f, "无效帧: {msg}"),
        }
    }
}

impl std::error::Error for ParseError {}

/// 协议检测错误
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum DetectError {
    NoMatch,
    Ambiguous(Vec<String>),
}

impl std::fmt::Display for DetectError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DetectError::NoMatch => write!(f, "无协议匹配"),
            DetectError::Ambiguous(protocols) => {
                write!(f, "多个协议匹配: {}", protocols.join(", "))
            }
        }
    }
}

impl std::error::Error for DetectError {}
