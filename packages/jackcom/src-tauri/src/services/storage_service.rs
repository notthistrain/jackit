use anyhow::{Context, Result};
use sqlx::SqlitePool;

use crate::core::serial::types::Direction;
use crate::infra::db::frame_repo::{self, FrameQuery, FrameRecord};
use crate::infra::db::session_repo;

/// 查询历史帧
pub async fn query_history(
    pool: &SqlitePool,
    session_id: Option<i64>,
    direction: Option<Direction>,
    protocol: Option<String>,
    limit: i64,
    offset: i64,
) -> Result<(Vec<FrameRecord>, i64)> {
    let query = FrameQuery {
        session_id,
        direction: direction.map(|d| d.to_string()),
        protocol,
        limit,
        offset,
    };
    frame_repo::query_frames(pool, &query).await
}

/// 流式导出
pub async fn export_streaming(
    pool: &SqlitePool,
    session_id: Option<i64>,
    format: &str,
    file_path: &str,
) -> Result<usize> {
    use tokio::io::AsyncWriteExt;

    let mut file = tokio::fs::File::create(file_path)
        .await
        .context("创建导出文件失败")?;
    let mut offset = 0i64;
    let page_size = 1000i64;
    let mut total = 0usize;

    loop {
        let rows = frame_repo::query_frames_paginated(pool, session_id, page_size, offset).await?;
        if rows.is_empty() {
            break;
        }
        for row in &rows {
            let line = format_row(row, format);
            file.write_all(line.as_bytes()).await?;
            file.write_all(b"\n").await?;
            total += 1;
        }
        offset += page_size;
    }
    file.flush().await?;
    Ok(total)
}

fn format_row(row: &FrameRecord, format: &str) -> String {
    let hex: String = row
        .raw_data
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ");

    match format {
        "csv" => format!(
            "{},{},{},{},{}",
            row.timestamp, row.direction, row.protocol, hex, row.summary
        ),
        "json" => serde_json::json!({
            "timestamp": row.timestamp,
            "direction": row.direction,
            "protocol": row.protocol,
            "raw_data": hex,
            "summary": row.summary,
        })
        .to_string(),
        "hex" => hex,
        _ => hex,
    }
}

/// 查询最近会话
pub async fn list_recent_sessions(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<session_repo::SessionInfo>> {
    session_repo::list_recent_sessions(pool, limit).await
}
