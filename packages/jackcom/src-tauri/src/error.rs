use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("串口错误: {0}")]
    Serial(String),
    #[error("协议解析错误: {0}")]
    Protocol(String),
    #[error("数据库错误: {0}")]
    Database(String),
    #[error("端口不存在: {0}")]
    PortNotFound(String),
    #[error("端口已被占用: {0}")]
    PortInUse(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
