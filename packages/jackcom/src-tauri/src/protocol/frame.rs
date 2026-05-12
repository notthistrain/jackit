use bytes::Bytes;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::{ParsedData, ProtocolType};

/// 数据方向
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Tx,
    Rx,
}

/// 原始帧：串口读到的最小单位
#[derive(Debug, Clone)]
pub struct RawFrame {
    pub port_id: String,
    pub timestamp: DateTime<Utc>,
    pub data: Bytes,
    pub direction: Direction,
}

/// 解析帧：经 Parser 处理后的结构化数据
#[derive(Debug, Clone)]
pub struct ParsedFrame {
    pub raw: RawFrame,
    pub protocol: ProtocolType,
    pub parsed: ParsedData,
    pub formatted: String,
}

/// 前端展示帧：发给 React 的最小子集
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayFrame {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub direction: Direction,
    pub raw_hex: String,
    pub formatted: String,
    pub protocol: ProtocolType,
    pub summary: String,
}

/// 将字节数组格式化为 HEX 字符串
pub fn bytes_to_hex(data: &[u8]) -> String {
    data.iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ")
}

/// 将字节数组格式化为 ASCII（不可见字符用 . 替代）
pub fn bytes_to_ascii(data: &[u8]) -> String {
    data.iter()
        .map(|&b| if b >= 0x20 && b < 0x7F { b as char } else { '.' })
        .collect()
}
