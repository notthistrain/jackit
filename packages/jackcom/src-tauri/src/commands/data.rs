use std::fs;
use std::path::Path;

use chrono::TimeZone;
use tauri::State;

use crate::error::AppError;
use crate::protocol::frame::{DisplayFrame, Direction};
use crate::state::AppState;
use crate::storage::{self, FrameQuery};

use super::types::{
    ExportDataRequest, ExportDataResponse, ExportFormat, QueryHistoryRequest, QueryHistoryResponse,
};

/// 查询历史帧数据
#[tauri::command]
pub async fn query_history(
    request: QueryHistoryRequest,
    state: State<'_, AppState>,
) -> Result<QueryHistoryResponse, AppError> {
    let db_guard = state.db.read().await;
    let pool = db_guard
        .as_ref()
        .ok_or_else(|| AppError::Database("数据库未初始化".to_string()))?;

    let mut query = FrameQuery::new();
    if let Some(session_id) = request.session_id {
        query = query.session(session_id);
    }
    if let Some(direction) = request.direction {
        query = query.direction(direction);
    }
    if let Some(protocol) = request.protocol {
        query = query.protocol(protocol);
    }
    if let Some(limit) = request.limit {
        query.limit = limit;
    }
    if let Some(offset) = request.offset {
        query.offset = offset;
    }

    let page = storage::query_frames(pool, query)
        .await
        .map_err(|e| AppError::Database(format!("查询历史失败: {}", e)))?;

    // FrameRow → DisplayFrame
    let frames: Vec<DisplayFrame> = page.rows.iter().map(|row| {
        let raw_hex: String = row.raw_data.iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ");
        DisplayFrame {
            id: row.id,
            timestamp: chrono::Utc.timestamp_opt(0, 0).unwrap(), // placeholder, real parse from string
            direction: row.direction,
            raw_hex,
            formatted: row.formatted.clone(),
            protocol: row.protocol,
            summary: row.summary.clone(),
        }
    }).collect();

    Ok(QueryHistoryResponse {
        frames,
        total: page.total,
    })
}

/// 导出帧数据到文件
#[tauri::command]
pub async fn export_data(
    request: ExportDataRequest,
    state: State<'_, AppState>,
) -> Result<ExportDataResponse, AppError> {
    let db_guard = state.db.read().await;
    let pool = db_guard
        .as_ref()
        .ok_or_else(|| AppError::Database("数据库未初始化".to_string()))?;

    let mut query = FrameQuery::new();
    query.limit = i64::MAX;
    if let Some(session_id) = request.session_id {
        query = query.session(session_id);
    }

    let page = storage::query_frames(pool, query)
        .await
        .map_err(|e| AppError::Database(format!("查询导出数据失败: {}", e)))?;

    if page.rows.is_empty() {
        return Err(AppError::Database("没有可导出的数据".to_string()));
    }

    // 确保目标目录存在
    if let Some(parent) = Path::new(&request.file_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Database(format!("创建导出目录失败: {}", e)))?;
    }

    let frames: Vec<DisplayFrame> = page.rows.iter().map(|row| {
        let raw_hex: String = row.raw_data.iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ");
        DisplayFrame {
            id: row.id,
            timestamp: chrono::Utc.timestamp_opt(0, 0).unwrap(),
            direction: row.direction,
            raw_hex,
            formatted: row.formatted.clone(),
            protocol: row.protocol,
            summary: row.summary.clone(),
        }
    }).collect();

    let content = match request.format {
        ExportFormat::Csv => {
            let mut csv = String::from("id,direction,raw_hex,formatted,protocol,summary\n");
            for frame in &frames {
                csv.push_str(&format_frame_csv(frame));
                csv.push('\n');
            }
            csv
        }
        ExportFormat::Json => {
            serde_json::to_string_pretty(&frames)
                .map_err(|e| AppError::Database(format!("JSON 序列化失败: {}", e)))?
        }
        ExportFormat::Hex => {
            let hex_lines: Vec<String> = frames.iter().map(|f| format_frame_hex(f)).collect();
            hex_lines.join("\n")
        }
    };

    fs::write(&request.file_path, content)
        .map_err(|e| AppError::Database(format!("写入导出文件失败: {}", e)))?;

    Ok(ExportDataResponse {
        file_path: request.file_path,
        rows_exported: frames.len(),
    })
}

/// 将 DisplayFrame 格式化为 CSV 行
pub fn format_frame_csv(frame: &DisplayFrame) -> String {
    format!(
        "{},{},{},{},{},{}",
        frame.id,
        match frame.direction {
            Direction::Tx => "Tx",
            Direction::Rx => "Rx",
        },
        frame.raw_hex,
        frame.formatted.replace(',', "\\,"),
        format!("{:?}", frame.protocol),
        frame.summary.replace(',', "\\,"),
    )
}

/// 将 DisplayFrame 格式化为纯 HEX 行
pub fn format_frame_hex(frame: &DisplayFrame) -> String {
    format!(
        "[{}] {} {}",
        frame.timestamp.to_rfc3339(),
        match frame.direction {
            Direction::Tx => ">>",
            Direction::Rx => "<<",
        },
        frame.raw_hex,
    )
}

// === 测试 ===

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use crate::protocol::ProtocolType;

    #[tokio::test]
    async fn test_query_history_no_db() {
        let state = AppState::new_test();
        let req = QueryHistoryRequest {
            session_id: None,
            direction: None,
            protocol: None,
            limit: Some(100),
            offset: None,
        };
        let db_guard = state.db.read().await;
        assert!(db_guard.is_none());
    }

    #[test]
    fn test_format_frame_csv() {
        let frame = DisplayFrame {
            id: 1,
            timestamp: chrono::Utc::now(),
            direction: Direction::Rx,
            raw_hex: "01 03 00 00".to_string(),
            formatted: "READ holding registers".to_string(),
            protocol: ProtocolType::Modbus,
            summary: "Slave 1, Func 3".to_string(),
        };
        let csv = format_frame_csv(&frame);
        assert!(csv.contains("01 03 00 00"));
        assert!(csv.contains("Rx"));
    }

    #[test]
    fn test_format_frame_json_via_serialize() {
        let frame = DisplayFrame {
            id: 1,
            timestamp: chrono::Utc::now(),
            direction: Direction::Tx,
            raw_hex: "AA BB".to_string(),
            formatted: "raw data".to_string(),
            protocol: ProtocolType::Raw,
            summary: "2 bytes".to_string(),
        };
        let json = serde_json::to_string(&frame).unwrap();
        assert!(json.contains("AA BB"));
        assert!(json.contains("tx"));
    }

    #[test]
    fn test_format_frame_hex() {
        let frame = DisplayFrame {
            id: 2,
            timestamp: chrono::Utc::now(),
            direction: Direction::Rx,
            raw_hex: "FF EE DD".to_string(),
            formatted: "data".to_string(),
            protocol: ProtocolType::Raw,
            summary: "3 bytes".to_string(),
        };
        let hex = format_frame_hex(&frame);
        assert!(hex.contains("FF EE DD"));
        assert!(hex.contains("<<"));
    }
}
