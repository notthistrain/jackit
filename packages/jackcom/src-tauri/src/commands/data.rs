use crate::commands::types::*;
use crate::services::storage_service;
use crate::services::storage_state::StorageState;
use tauri::State;

#[tauri::command]
pub async fn query_history(
    request: QueryHistoryRequest,
    storage_state: State<'_, StorageState>,
) -> Result<QueryHistoryResponse, String> {
    let (records, total) = storage_service::query_history(
        storage_state.pool(),
        request.session_id,
        request.direction,
        request.protocol.map(|p| {
            serde_json::to_string(&p)
                .unwrap_or_default()
                .trim_matches('"')
                .to_string()
        }),
        request.limit.unwrap_or(100),
        request.offset.unwrap_or(0),
    )
    .await
    .map_err(|e| e.to_string())?;

    let frames = records
        .into_iter()
        .map(|r| crate::core::event::display_frame::DisplayFrame {
            id: r.id,
            timestamp: chrono::NaiveDateTime::parse_from_str(&r.timestamp, "%Y-%m-%d %H:%M:%S")
                .map(|dt| dt.and_utc())
                .unwrap_or_else(|_| chrono::Utc::now()),
            direction: match r.direction.as_str() {
                "tx" => crate::core::serial::types::Direction::Tx,
                _ => crate::core::serial::types::Direction::Rx,
            },
            raw_hex: r
                .raw_data
                .iter()
                .map(|b| format!("{:02X}", b))
                .collect::<Vec<_>>()
                .join(" "),
            formatted: r.formatted,
            protocol: match r.protocol.as_str() {
                "modbus" => crate::core::protocol::types::ProtocolType::Modbus,
                "at" => crate::core::protocol::types::ProtocolType::AT,
                "json" => crate::core::protocol::types::ProtocolType::Json,
                _ => crate::core::protocol::types::ProtocolType::Raw,
            },
            summary: r.summary,
        })
        .collect();

    Ok(QueryHistoryResponse { frames, total })
}

#[tauri::command]
pub async fn export_data(
    request: ExportDataRequest,
    storage_state: State<'_, StorageState>,
) -> Result<ExportDataResponse, String> {
    let format_str = match request.format {
        ExportFormat::Csv => "csv",
        ExportFormat::Json => "json",
        ExportFormat::Hex => "hex",
    };
    let rows = storage_service::export_streaming(
        storage_state.pool(),
        request.session_id,
        format_str,
        &request.file_path,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(ExportDataResponse {
        file_path: request.file_path,
        rows_exported: rows,
    })
}
