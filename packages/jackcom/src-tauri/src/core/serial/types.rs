use serde::{Deserialize, Serialize};

/// 端口名 (newtype — 防止与其他 String 混淆)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PortName(pub String);

impl PortName {
    pub fn new(name: impl Into<String>) -> Self {
        Self(name.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for PortName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for PortName {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&str> for PortName {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl AsRef<str> for PortName {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

/// 会话 ID (newtype)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SessionId(pub i64);

impl SessionId {
    pub fn new(id: i64) -> Self {
        Self(id)
    }

    pub fn value(&self) -> i64 {
        self.0
    }
}

impl From<i64> for SessionId {
    fn from(id: i64) -> Self {
        Self(id)
    }
}

/// 数据方向
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Tx,
    Rx,
}

impl std::fmt::Display for Direction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Direction::Tx => write!(f, "tx"),
            Direction::Rx => write!(f, "rx"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_name_newtype() {
        let name = PortName::new("COM3");
        assert_eq!(name.as_str(), "COM3");
        assert_eq!(format!("{name}"), "COM3");
        let from_str: PortName = "COM5".into();
        assert_eq!(from_str, PortName::new("COM5"));
    }

    #[test]
    fn port_name_serde_roundtrip() {
        let name = PortName::new("COM3");
        let json = serde_json::to_string(&name).unwrap();
        assert_eq!(json, "\"COM3\"");
        let back: PortName = serde_json::from_str(&json).unwrap();
        assert_eq!(back, name);
    }

    #[test]
    fn session_id_newtype() {
        let id = SessionId::new(42);
        assert_eq!(id.value(), 42);
        let from_i64: SessionId = 42i64.into();
        assert_eq!(from_i64, id);
    }

    #[test]
    fn direction_serde_lowercase() {
        let json = serde_json::to_string(&Direction::Tx).unwrap();
        assert_eq!(json, "\"tx\"");
        let json = serde_json::to_string(&Direction::Rx).unwrap();
        assert_eq!(json, "\"rx\"");
        // roundtrip
        let back: Direction = serde_json::from_str("\"tx\"").unwrap();
        assert_eq!(back, Direction::Tx);
    }

    #[test]
    fn direction_display() {
        assert_eq!(format!("{}", Direction::Tx), "tx");
        assert_eq!(format!("{}", Direction::Rx), "rx");
    }
}
