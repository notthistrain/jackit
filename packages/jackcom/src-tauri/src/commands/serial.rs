use bytes::Bytes;
use chrono::Utc;
use tauri::State;

use crate::error::AppError;
use crate::protocol::frame::{Direction, ParsedFrame, RawFrame, bytes_to_hex, bytes_to_ascii};
use crate::protocol::ParsedData;
use crate::serial::config::SerialConfig;
use crate::state::AppState;
use crate::storage;

use super::types::{
    CloseAllResponse, ClosePortRequest, ClosePortResponse, OpenPortRequest, OpenPortResponse,
    PortInfo, SendDataRequest, SendDataResponse,
};

/// 枚举系统可用串口
#[tauri::command]
pub async fn enumerate_ports(
    _state: State<'_, AppState>,
) -> Result<Vec<PortInfo>, AppError> {
    let ports = serialport::available_ports()
        .map_err(|e| AppError::Serial(format!("枚举串口失败: {}", e)))?;

    let result: Vec<PortInfo> = ports
        .into_iter()
        .map(|p| {
            let (manufacturer, product, serial_number, port_type) = match &p.port_type {
                serialport::SerialPortType::UsbPort(info) => (
                    info.manufacturer.clone(),
                    info.product.clone(),
                    info.serial_number.clone(),
                    "USB".to_string(),
                ),
                serialport::SerialPortType::BluetoothPort => {
                    (None, None, None, "Bluetooth".to_string())
                }
                serialport::SerialPortType::PciPort => (None, None, None, "PCI".to_string()),
                serialport::SerialPortType::Unknown => (None, None, None, "Unknown".to_string()),
                _ => (None, None, None, "Other".to_string()),
            };
            PortInfo {
                name: p.port_name,
                manufacturer,
                product,
                serial_number,
                port_type,
            }
        })
        .collect();

    Ok(result)
}

/// 打开指定串口
#[tauri::command]
pub async fn open_port(
    request: OpenPortRequest,
    state: State<'_, AppState>,
) -> Result<OpenPortResponse, AppError> {
    if request.port_name.is_empty() {
        return Err(AppError::Serial("端口名不能为空".to_string()));
    }

    // 检查是否已打开
    if state.connections.contains_key(&request.port_name) {
        return Err(AppError::PortInUse(request.port_name));
    }

    // 构建 SerialConfig
    let config = SerialConfig {
        port_name: request.port_name.clone(),
        baud_rate: request.baud_rate,
        data_bits: request.data_bits,
        stop_bits: request.stop_bits,
        parity: request.parity,
        flow_control: request.flow_control,
    };

    // 调用 SerialManager 打开端口（同步方法）
    state
        .serial_manager
        .open_port(config.clone())
        .map_err(|e| AppError::Serial(format!("打开串口失败: {}", e)))?;

    // 记录到 connections map
    state
        .connections
        .insert(request.port_name.clone(), config);

    // 创建数据库 session 记录（失败不影响端口使用）
    {
        let db_guard = state.db.read().await;
        if let Some(pool) = db_guard.as_ref() {
            let config_json = serde_json::to_string(
                state.connections.get(&request.port_name).unwrap().value()
            ).unwrap_or_default();
            match storage::create_session(pool, &request.port_name, request.baud_rate, &config_json).await {
                Ok(session_id) => {
                    log::info!("Session {} created for {}", session_id, request.port_name);
                    state.sessions.insert(request.port_name.clone(), session_id);
                }
                Err(e) => {
                    log::warn!("Failed to create session for {}: {}", request.port_name, e);
                }
            }
        }
    }

    Ok(OpenPortResponse {
        port_name: request.port_name,
        is_open: true,
    })
}

/// 关闭指定串口
#[tauri::command]
pub async fn close_port(
    request: ClosePortRequest,
    state: State<'_, AppState>,
) -> Result<ClosePortResponse, AppError> {
    if !state.connections.contains_key(&request.port_name) {
        return Err(AppError::PortNotFound(request.port_name));
    }

    state
        .serial_manager
        .close_port(&request.port_name)
        .map_err(|e| AppError::Serial(format!("关闭串口失败: {}", e)))?;

    // 结束数据库 session 记录
    if let Some((_, session_id)) = state.sessions.remove(&request.port_name) {
        let db_guard = state.db.read().await;
        if let Some(pool) = db_guard.as_ref() {
            if let Err(e) = storage::end_session(pool, session_id).await {
                log::warn!("Failed to end session {} for {}: {}", session_id, request.port_name, e);
            }
        }
    }

    state.connections.remove(&request.port_name);

    Ok(ClosePortResponse {
        port_name: request.port_name,
        is_closed: true,
    })
}

/// 关闭所有已打开的串口
#[tauri::command]
pub async fn close_all(
    state: State<'_, AppState>,
) -> Result<CloseAllResponse, AppError> {
    let port_names: Vec<String> = state
        .connections
        .iter()
        .map(|entry| entry.key().clone())
        .collect();

    let mut closed = Vec::new();
    for name in &port_names {
        match state.serial_manager.close_port(name) {
            Ok(()) => {
                // 结束 session
                if let Some((_, session_id)) = state.sessions.remove(name) {
                    let db_guard = state.db.read().await;
                    if let Some(pool) = db_guard.as_ref() {
                        if let Err(e) = storage::end_session(pool, session_id).await {
                            log::warn!("Failed to end session {}: {}", session_id, e);
                        }
                    }
                }
                state.connections.remove(name);
                closed.push(name.clone());
            }
            Err(_) => {
                // 即使关闭失败也尝试从 map 中移除
                // 结束 session
                if let Some((_, session_id)) = state.sessions.remove(name) {
                    let db_guard = state.db.read().await;
                    if let Some(pool) = db_guard.as_ref() {
                        if let Err(e) = storage::end_session(pool, session_id).await {
                            log::warn!("Failed to end session {}: {}", session_id, e);
                        }
                    }
                }
                state.connections.remove(name);
                closed.push(name.clone());
            }
        }
    }

    Ok(CloseAllResponse {
        closed_ports: closed,
    })
}

/// 向指定串口发送数据
#[tauri::command]
pub async fn send_data(
    request: SendDataRequest,
    state: State<'_, AppState>,
) -> Result<SendDataResponse, AppError> {
    if !state.connections.contains_key(&request.port_name) {
        return Err(AppError::PortNotFound(request.port_name));
    }

    let bytes = parse_hex_string(&request.hex_data)?;

    if bytes.is_empty() {
        return Err(AppError::Serial("发送数据不能为空".to_string()));
    }

    let len = bytes.len();
    state
        .serial_manager
        .send_data(&request.port_name, bytes.clone())
        .map_err(|e| AppError::Serial(format!("发送数据失败: {}", e)))?;

    // 发布 TX 事件，让前端显示已发送的数据
    let raw_frame = RawFrame {
        port_id: request.port_name.clone(),
        timestamp: Utc::now(),
        data: Bytes::from(bytes),
        direction: Direction::Tx,
    };
    let hex = bytes_to_hex(&raw_frame.data);
    let ascii = bytes_to_ascii(&raw_frame.data);
    let parsed_frame = ParsedFrame {
        raw: raw_frame,
        protocol: request.protocol,
        parsed: ParsedData::Raw { hex: hex.clone(), ascii },
        formatted: hex,
    };
    state.broker_handle.publish_data(&request.port_name, vec![parsed_frame]);

    Ok(SendDataResponse {
        port_name: request.port_name,
        bytes_sent: len,
    })
}

/// 将十六进制字符串解析为字节向量
/// 支持格式："01 03 FF" / "0103FF" / "01,03,FF"
pub fn parse_hex_string(hex: &str) -> Result<Vec<u8>, AppError> {
    if hex.trim().is_empty() {
        return Ok(Vec::new());
    }

    // 统一分隔符：空格、逗号 → 统一按空格分割
    let replaced = hex.replace(',', " ");
    let tokens: Vec<&str> = replaced.split_whitespace().collect();

    let mut bytes = Vec::with_capacity(tokens.len());
    for token in tokens {
        if token.len() == 2 {
            let byte = u8::from_str_radix(token, 16)
                .map_err(|_| AppError::Serial(format!("无法解析十六进制: '{}'", token)))?;
            bytes.push(byte);
        } else if token.len() > 2 && token.len() % 2 == 0 {
            // 连续 hex 字符串如 "0103FF" → 拆分为 01, 03, FF
            for i in (0..token.len()).step_by(2) {
                let byte_str = &token[i..i + 2];
                let byte = u8::from_str_radix(byte_str, 16)
                    .map_err(|_| AppError::Serial(format!("无法解析十六进制: '{}'", byte_str)))?;
                bytes.push(byte);
            }
        } else {
            return Err(AppError::Serial(format!(
                "无效的十六进制字节: '{}'",
                token
            )));
        }
    }

    Ok(bytes)
}

// === 测试 ===

#[cfg(test)]
mod tests {
    use super::*;
    use crate::serial::config::{DataBits, FlowControl, Parity, StopBits};
    use crate::state::AppState;

    #[test]
    fn test_enumerate_ports_no_panic() {
        // 不依赖 tauri::State，直接测试底层功能
        let ports = serialport::available_ports()
            .unwrap_or_default();
        // 验证不会 panic
        println!("Available ports: {:?}", ports.len());
    }

    #[test]
    fn test_open_port_missing_name() {
        let state = AppState::new_test();
        let req = OpenPortRequest {
            port_name: String::new(),
            baud_rate: 115200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
        };
        // 空端口名应返回错误
        assert!(state.connections.contains_key(&req.port_name) == false);
        // 验证 open_port 直接调用会失败
        let config = SerialConfig {
            port_name: String::new(),
            baud_rate: 115200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
        };
        assert!(state.serial_manager.open_port(config).is_err());
    }

    #[test]
    fn test_close_port_not_open() {
        let state = AppState::new_test();
        let result = state.serial_manager.close_port("COM_NONEXISTENT");
        assert!(result.is_err());
    }

    #[test]
    fn test_close_all_when_none_open() {
        let state = AppState::new_test();
        state.serial_manager.close_all();
        assert!(state.connections.is_empty());
    }

    #[test]
    fn test_send_data_port_not_open() {
        let state = AppState::new_test();
        let result = state.serial_manager.send_data("COM_NOT_OPEN", vec![0x01, 0x02]);
        assert!(result.is_err());
    }

    #[test]
    fn test_hex_parsing_valid() {
        let hex = "01 03 00 00 00 0A";
        let bytes = parse_hex_string(hex);
        assert!(bytes.is_ok());
        assert_eq!(bytes.unwrap(), vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A]);
    }

    #[test]
    fn test_hex_parsing_invalid_character() {
        let hex = "01 ZZ 03";
        let bytes = parse_hex_string(hex);
        assert!(bytes.is_err());
    }

    #[test]
    fn test_hex_parsing_empty_string() {
        let hex = "";
        let bytes = parse_hex_string(hex);
        assert!(bytes.is_ok());
        assert!(bytes.unwrap().is_empty());
    }

    #[test]
    fn test_hex_parsing_no_spaces() {
        let hex = "0103FF";
        let bytes = parse_hex_string(hex);
        assert!(bytes.is_ok());
        assert_eq!(bytes.unwrap(), vec![0x01, 0x03, 0xFF]);
    }

    #[test]
    fn test_hex_parsing_comma_separated() {
        let hex = "01,03,FF";
        let bytes = parse_hex_string(hex);
        assert!(bytes.is_ok());
        assert_eq!(bytes.unwrap(), vec![0x01, 0x03, 0xFF]);
    }

    #[test]
    fn test_hex_parsing_too_long_byte() {
        let hex = "001";
        let bytes = parse_hex_string(hex);
        assert!(bytes.is_err());
    }
}
