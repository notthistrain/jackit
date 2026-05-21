use anyhow::{Context, Result};
use sqlx::SqlitePool;

use crate::core::serial::types::{Direction, SessionId};

/// DB 中的帧行
#[derive(Debug, Clone)]
pub struct FrameRow {
    pub session_id: i64,
    pub direction: String,
    pub raw_data: Vec<u8>,
    pub protocol: String,
    pub formatted: String,
    pub summary: String,
}

impl FrameRow {
    pub fn new(
        session_id: Option<SessionId>,
        protocol: &str,
        raw_hex: &str,
        direction: Direction,
        formatted: &str,
        summary: &str,
    ) -> Self {
        Self {
            session_id: session_id.map(|s| s.value()).unwrap_or(0),
            direction: direction.to_string(),
            raw_data: hex_to_bytes(raw_hex),
            protocol: protocol.to_string(),
            formatted: formatted.to_string(),
            summary: summary.to_string(),
        }
    }
}

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    hex.split_whitespace()
        .filter_map(|s| u8::from_str_radix(s, 16).ok())
        .collect()
}

/// 批量插入帧（事务）
pub async fn insert_frames_batch(pool: &SqlitePool, rows: &[FrameRow]) -> Result<()> {
    if rows.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await.context("开始事务失败")?;
    for row in rows {
        sqlx::query(
            "INSERT INTO frames (session_id, direction, raw_data, protocol, formatted, summary) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(row.session_id)
        .bind(&row.direction)
        .bind(&row.raw_data)
        .bind(&row.protocol)
        .bind(&row.formatted)
        .bind(&row.summary)
        .execute(&mut *tx)
        .await
        .context("插入 frame 失败")?;
    }
    tx.commit().await.context("提交事务失败")?;
    Ok(())
}

/// 查询条件
pub struct FrameQuery {
    pub session_id: Option<i64>,
    pub direction: Option<String>,
    pub protocol: Option<String>,
    pub limit: i64,
    pub offset: i64,
}

/// 查询结果帧
#[derive(Debug, Clone)]
pub struct FrameRecord {
    pub id: i64,
    #[allow(dead_code)]
    pub session_id: i64,
    pub timestamp: String,
    pub direction: String,
    pub raw_data: Vec<u8>,
    pub protocol: String,
    pub formatted: String,
    pub summary: String,
}

/// 分页查询帧
pub async fn query_frames(pool: &SqlitePool, query: &FrameQuery) -> Result<(Vec<FrameRecord>, i64)> {
    // 构建 WHERE 子句
    let mut conditions = Vec::new();
    let mut param_count = 0u8;

    if query.session_id.is_some() {
        conditions.push(format!("session_id = ?{}", param_count + 1));
        param_count += 1;
    }
    if query.direction.is_some() {
        conditions.push(format!("direction = ?{}", param_count + 1));
        param_count += 1;
    }
    if query.protocol.is_some() {
        conditions.push(format!("protocol = ?{}", param_count + 1));
        param_count += 1;
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // 计数
    let count_sql = format!("SELECT COUNT(*) FROM frames {where_clause}");
    let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
    if let Some(sid) = query.session_id { count_query = count_query.bind(sid); }
    if let Some(ref d) = query.direction { count_query = count_query.bind(d); }
    if let Some(ref p) = query.protocol { count_query = count_query.bind(p); }
    let total = count_query.fetch_one(pool).await.context("查询 frame 计数失败")?;

    // 查询
    let data_sql = format!(
        "SELECT id, session_id, timestamp, direction, raw_data, protocol, formatted, summary FROM frames {where_clause} ORDER BY timestamp DESC LIMIT ?{} OFFSET ?{}",
        param_count + 1, param_count + 2
    );
    let mut data_query = sqlx::query_as::<_, (i64, i64, String, String, Vec<u8>, String, String, String)>(&data_sql);
    if let Some(sid) = query.session_id { data_query = data_query.bind(sid); }
    if let Some(ref d) = query.direction { data_query = data_query.bind(d); }
    if let Some(ref p) = query.protocol { data_query = data_query.bind(p); }
    data_query = data_query.bind(query.limit).bind(query.offset);

    let rows = data_query.fetch_all(pool).await.context("查询 frames 失败")?;

    let records = rows.into_iter().map(|(id, session_id, timestamp, direction, raw_data, protocol, formatted, summary)| {
        FrameRecord { id, session_id, timestamp, direction, raw_data, protocol, formatted, summary }
    }).collect();

    Ok((records, total))
}

/// 分页查询帧 ID（用于流式导出）
pub async fn query_frames_paginated(
    pool: &SqlitePool,
    session_id: Option<i64>,
    limit: i64,
    offset: i64,
) -> Result<Vec<FrameRecord>> {
    let sql = match session_id {
        Some(_) => {
            "SELECT id, session_id, timestamp, direction, raw_data, protocol, formatted, summary FROM frames WHERE session_id = ?1 ORDER BY timestamp ASC LIMIT ?2 OFFSET ?3"
        }
        None => {
            "SELECT id, session_id, timestamp, direction, raw_data, protocol, formatted, summary FROM frames ORDER BY timestamp ASC LIMIT ?1 OFFSET ?2"
        }
    };

    let mut q = sqlx::query_as::<_, (i64, i64, String, String, Vec<u8>, String, String, String)>(sql);
    if let Some(sid) = session_id {
        q = q.bind(sid);
    }
    q = q.bind(limit).bind(offset);

    let rows = q.fetch_all(pool).await.context("分页查询 frames 失败")?;
    Ok(rows.into_iter().map(|(id, session_id, timestamp, direction, raw_data, protocol, formatted, summary)| {
        FrameRecord { id, session_id, timestamp, direction, raw_data, protocol, formatted, summary }
    }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::serial::types::PortName;
    use crate::infra::db::session_repo;

    async fn setup_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(include_str!("migrations/001_init.sql"))
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    #[tokio::test]
    async fn insert_and_query_frames() {
        let pool = setup_db().await;
        let sid = session_repo::create_session(&pool, &PortName::new("COM_TEST"), 9600).await.unwrap();

        let rows = vec![
            FrameRow::new(Some(sid), "raw", "01 03 FF", Direction::Rx, "HEX: 01 03 FF", "Raw 3 bytes"),
            FrameRow::new(Some(sid), "raw", "AA BB", Direction::Tx, "HEX: AA BB", "Raw 2 bytes"),
        ];
        insert_frames_batch(&pool, &rows).await.unwrap();

        let query = FrameQuery {
            session_id: Some(sid.value()),
            direction: None,
            protocol: None,
            limit: 10,
            offset: 0,
        };
        let (records, total) = query_frames(&pool, &query).await.unwrap();
        assert_eq!(total, 2);
        assert_eq!(records.len(), 2);
    }
}
