use tauri::State;

use crate::core::serial::config::SerialConfig;
use crate::core::serial::types::PortName;
use crate::services::serial_service::SerialService;
use crate::services::serial_state::SerialState;
use crate::services::storage_state::StorageState;
use crate::commands::types::*;

#[tauri::command]
pub fn enumerate_ports() -> Result<Vec<PortInfo>, String> {
    let ports = serialport::available_ports()
        .map_err(|e| format!("枚举端口失败: {e}"))?;
    Ok(ports.into_iter().map(|p| {
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
        };
        PortInfo {
            name: p.port_name,
            manufacturer,
            product,
            serial_number,
            port_type,
        }
    }).collect())
}

#[tauri::command]
pub async fn open_port(
    request: OpenPortRequest,
    serial_state: State<'_, SerialState>,
    storage_state: State<'_, StorageState>,
) -> Result<OpenPortResponse, String> {
    let config = SerialConfig {
        port_name: request.port_name.clone(),
        baud_rate: request.baud_rate,
        data_bits: request.data_bits,
        stop_bits: request.stop_bits,
        parity: request.parity,
        flow_control: request.flow_control,
    };
    SerialService::open(&serial_state, storage_state.pool(), &config)
        .await
        .map(|_| OpenPortResponse {
            port_name: request.port_name,
            is_open: true,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_port(
    request: ClosePortRequest,
    serial_state: State<'_, SerialState>,
    storage_state: State<'_, StorageState>,
) -> Result<ClosePortResponse, String> {
    let port_name = PortName::new(&request.port_name);
    SerialService::close(&serial_state, storage_state.pool(), &port_name)
        .await
        .map(|_| ClosePortResponse {
            port_name: request.port_name,
            is_closed: true,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn send_data(
    request: SendDataRequest,
    serial_state: State<'_, SerialState>,
) -> Result<SendDataResponse, String> {
    let port_name = PortName::new(&request.port_name);
    let data = hex_to_bytes(&request.hex_data)
        .map_err(|e| format!("十六进制解析失败: {e}"))?;
    let bytes_sent = SerialService::send(&serial_state, &port_name, data)
        .map_err(|e| e.to_string())?;
    Ok(SendDataResponse {
        port_name: request.port_name,
        bytes_sent,
    })
}

#[tauri::command]
pub async fn close_all(
    serial_state: State<'_, SerialState>,
    storage_state: State<'_, StorageState>,
) -> Result<CloseAllResponse, String> {
    let closed = SerialService::close_all(&serial_state, storage_state.pool()).await;
    Ok(CloseAllResponse {
        closed_ports: closed.into_iter().map(|p| p.to_string()).collect(),
    })
}

fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    hex.split_whitespace()
        .map(|s| u8::from_str_radix(s, 16).map_err(|e| format!("{s}: {e}")))
        .collect()
}
