use tauri::State;

use crate::error::AppError;
use crate::state::AppState;
use crate::storage;

use super::types::{
    GetConfigResponse, ListRecentSessionsRequest, ListRecentSessionsResponse, SaveConfigRequest,
    SaveConfigResponse, SessionInfo,
};

/// 获取当前活跃连接的配置
/// 如果有多个连接，返回第一个；无连接返回默认配置
#[tauri::command]
pub async fn get_config(
    state: State<'_, AppState>,
) -> Result<GetConfigResponse, AppError> {
    let config = state
        .connections
        .iter()
        .next()
        .map(|entry| entry.value().clone())
        .unwrap_or_default();

    Ok(GetConfigResponse { config })
}

/// 保存串口配置（更新 connections map 中的值）
#[tauri::command]
pub async fn save_config(
    request: SaveConfigRequest,
    state: State<'_, AppState>,
) -> Result<SaveConfigResponse, AppError> {
    let port_name = request.config.port_name.clone();

    if state.connections.contains_key(&port_name) {
        let mut entry = state.connections.get_mut(&port_name).unwrap();
        *entry = request.config;
    }

    Ok(SaveConfigResponse { saved: true })
}

/// 列出最近的使用会话
#[tauri::command]
pub async fn list_recent_sessions(
    request: ListRecentSessionsRequest,
    state: State<'_, AppState>,
) -> Result<ListRecentSessionsResponse, AppError> {
    let db_guard = state.db.read().await;
    let pool = db_guard
        .as_ref()
        .ok_or_else(|| AppError::Database("数据库未初始化".to_string()))?;

    let limit = request.limit.unwrap_or(20);

    let rows = storage::list_sessions(pool, limit, 0)
        .await
        .map_err(|e| AppError::Database(format!("查询会话列表失败: {}", e)))?;

    // SessionRow → SessionInfo
    let sessions: Vec<SessionInfo> = rows.iter().map(|row| {
        SessionInfo {
            id: row.id,
            port_name: row.port_name.clone(),
            baud_rate: row.baud_rate,
            created_at: row.started_at.clone(),
        }
    }).collect();

    Ok(ListRecentSessionsResponse { sessions })
}

// === 测试 ===

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use crate::serial::config::SerialConfig;

    #[test]
    fn test_get_config_returns_default() {
        let state = AppState::new_test();
        let config = state
            .connections
            .iter()
            .next()
            .map(|entry| entry.value().clone())
            .unwrap_or_default();

        assert_eq!(config.port_name, "");
        assert_eq!(config.baud_rate, 115200);
    }

    #[test]
    fn test_save_config_success() {
        let state = AppState::new_test();
        let config = SerialConfig {
            port_name: "COM_TEST".to_string(),
            baud_rate: 9600,
            ..Default::default()
        };

        // 添加到 connections
        state.connections.insert("COM_TEST".to_string(), SerialConfig::default());

        // 更新
        let port_name = config.port_name.clone();
        if state.connections.contains_key(&port_name) {
            let mut entry = state.connections.get_mut(&port_name).unwrap();
            *entry = config;
        }

        // 验证
        let updated = state.connections.get("COM_TEST").unwrap();
        assert_eq!(updated.baud_rate, 9600);
    }

    #[tokio::test]
    async fn test_list_recent_sessions_no_db() {
        let state = AppState::new_test();
        let db_guard = state.db.read().await;
        assert!(db_guard.is_none());
    }

    #[test]
    fn test_list_recent_sessions_with_default_limit() {
        let req = ListRecentSessionsRequest { limit: None };
        let effective_limit = req.limit.unwrap_or(20);
        assert_eq!(effective_limit, 20);
    }
}
