use crate::core::serial::config::SerialConfig;
use crate::commands::types::*;

#[tauri::command]
pub fn get_config() -> Result<GetConfigResponse, String> {
    // 前端使用 localStorage，后端保持空壳
    Ok(GetConfigResponse {
        config: SerialConfig::default(),
    })
}

#[tauri::command]
pub fn save_config(request: SaveConfigRequest) -> Result<SaveConfigResponse, String> {
    // 前端使用 localStorage，后端保持空壳
    let _ = request;
    Ok(SaveConfigResponse { saved: true })
}

#[tauri::command]
pub async fn list_recent_sessions(
    request: ListRecentSessionsRequest,
    storage_state: tauri::State<'_, crate::services::storage_state::StorageState>,
) -> Result<ListRecentSessionsResponse, String> {
    let sessions = crate::services::storage_service::list_recent_sessions(
        storage_state.pool(),
        request.limit.unwrap_or(20),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(ListRecentSessionsResponse {
        sessions: sessions.into_iter().map(|s| SessionInfo {
            id: s.id,
            port_name: s.port_name,
            baud_rate: s.baud_rate,
            created_at: s.created_at,
        }).collect(),
    })
}
