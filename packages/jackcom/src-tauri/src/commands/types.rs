use serde::{Deserialize, Serialize};

use crate::protocol::ProtocolType;
use crate::protocol::frame::Direction;
use crate::serial::config::{DataBits, FlowControl, Parity, StopBits};

// ── 枚举端口 ──

/// `enumerate_ports` 返回的单个端口信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub name: String,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
    pub port_type: String,
}

// ── 打开端口 ──

/// `open_port` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPortRequest {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub stop_bits: StopBits,
    pub parity: Parity,
    pub flow_control: FlowControl,
}

/// `open_port` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPortResponse {
    pub port_name: String,
    pub is_open: bool,
}

// ── 关闭端口 ──

/// `close_port` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosePortRequest {
    pub port_name: String,
}

/// `close_port` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosePortResponse {
    pub port_name: String,
    pub is_closed: bool,
}

// ── 关闭所有端口 ──

/// `close_all` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseAllResponse {
    pub closed_ports: Vec<String>,
}

// ── 发送数据 ──

/// `send_data` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendDataRequest {
    pub port_name: String,
    /// 十六进制字符串，例如 "01 03 00 00 00 0A C5 CD"
    pub hex_data: String,
    /// 发送使用的协议
    pub protocol: ProtocolType,
}

/// `send_data` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendDataResponse {
    pub port_name: String,
    pub bytes_sent: usize,
}

// ── 查询历史 ──

/// `query_history` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryRequest {
    pub session_id: Option<i64>,
    pub direction: Option<Direction>,
    pub protocol: Option<ProtocolType>,
    /// 限制返回条数
    pub limit: Option<i64>,
    /// 偏移量
    pub offset: Option<i64>,
}

/// `query_history` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryResponse {
    pub frames: Vec<crate::protocol::frame::DisplayFrame>,
    pub total: i64,
}

// ── 导出数据 ──

/// `export_data` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDataRequest {
    pub session_id: Option<i64>,
    /// 导出格式：csv / json / hex
    pub format: ExportFormat,
    pub file_path: String,
}

/// 导出格式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
    Hex,
}

/// `export_data` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDataResponse {
    pub file_path: String,
    pub rows_exported: usize,
}

// ── 获取配置 ──

/// `get_config` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetConfigResponse {
    pub config: crate::serial::config::SerialConfig,
}

// ── 保存配置 ──

/// `save_config` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveConfigRequest {
    pub config: crate::serial::config::SerialConfig,
}

/// `save_config` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveConfigResponse {
    pub saved: bool,
}

// ── 最近会话 ──

/// `list_recent_sessions` 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRecentSessionsRequest {
    pub limit: Option<i64>,
}

/// `list_recent_sessions` 响应中的单个会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: i64,
    pub port_name: String,
    pub baud_rate: u32,
    pub created_at: String,
}

/// `list_recent_sessions` 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRecentSessionsResponse {
    pub sessions: Vec<SessionInfo>,
}
