use serde::{Deserialize, Serialize};

use crate::core::protocol::types::ProtocolType;
use crate::core::serial::config::{DataBits, FlowControl, Parity, StopBits};
use crate::core::serial::types::Direction;

// ── 枚举端口 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub name: String,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
    pub port_type: String,
}

// ── 打开端口 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPortRequest {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub stop_bits: StopBits,
    pub parity: Parity,
    pub flow_control: FlowControl,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPortResponse {
    pub port_name: String,
    pub is_open: bool,
}

// ── 关闭端口 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosePortRequest {
    pub port_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosePortResponse {
    pub port_name: String,
    pub is_closed: bool,
}

// ── 关闭所有端口 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseAllResponse {
    pub closed_ports: Vec<String>,
}

// ── 发送数据 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendDataRequest {
    pub port_name: String,
    pub hex_data: String,
    pub protocol: ProtocolType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendDataResponse {
    pub port_name: String,
    pub bytes_sent: usize,
}

// ── 查询历史 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryRequest {
    pub session_id: Option<i64>,
    pub direction: Option<Direction>,
    pub protocol: Option<ProtocolType>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryResponse {
    pub frames: Vec<crate::core::event::display_frame::DisplayFrame>,
    pub total: i64,
}

// ── 导出数据 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDataRequest {
    pub session_id: Option<i64>,
    pub format: ExportFormat,
    pub file_path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
    Hex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDataResponse {
    pub file_path: String,
    pub rows_exported: usize,
}

// ── 配置 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetConfigResponse {
    pub config: crate::core::serial::config::SerialConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveConfigRequest {
    pub config: crate::core::serial::config::SerialConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveConfigResponse {
    pub saved: bool,
}

// ── 最近会话 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRecentSessionsRequest {
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: i64,
    pub port_name: String,
    pub baud_rate: u32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRecentSessionsResponse {
    pub sessions: Vec<SessionInfo>,
}
