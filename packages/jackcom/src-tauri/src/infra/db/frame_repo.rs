use anyhow::{Context, Result};
use sqlx::{FromRow, QueryBuilder, Row, Sqlite, SqlitePool};

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
pub async fn insert_frames_batch(pool: &SqlitePool, buffer: &[FrameRow]) -> Result<()> {
    if buffer.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await.context("开始事务失败")?;
    for row in buffer {
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

impl FrameQuery {
    /// 将过滤条件追加到 QueryBuilder（含 WHERE）
    pub fn apply_filters<'a>(&'a self, qb: &mut QueryBuilder<'a, Sqlite>) {
        let has_filters =
            self.session_id.is_some() || self.direction.is_some() || self.protocol.is_some();
        if !has_filters {
            return;
        }
        qb.push(" WHERE ");
        let mut sep = qb.separated(" AND ");
        if let Some(sid) = self.session_id {
            sep.push("session_id = ").push_bind_unseparated(sid);
        }
        if let Some(ref d) = self.direction {
            sep.push("direction = ").push_bind_unseparated(d.as_str());
        }
        if let Some(ref p) = self.protocol {
            sep.push("protocol = ").push_bind_unseparated(p.as_str());
        }
    }
}

/// 查询结果帧
#[derive(Debug, Clone, FromRow)]
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

const SELECT_FRAMES: &str =
    "SELECT id, session_id, timestamp, direction, raw_data, protocol, formatted, summary FROM frames";

/// 分页查询帧
pub async fn query_frames(
    pool: &SqlitePool,
    query: &FrameQuery,
) -> Result<(Vec<FrameRecord>, i64)> {
    // 计数
    let mut qb = QueryBuilder::new("SELECT COUNT(*) FROM frames");
    query.apply_filters(&mut qb);
    let total: i64 = qb
        .build()
        .fetch_one(pool)
        .await
        .context("查询 frame 计数失败")?
        .get(0);

    // 数据
    let mut qb = QueryBuilder::new(SELECT_FRAMES);
    query.apply_filters(&mut qb);
    qb.push(" ORDER BY timestamp DESC LIMIT ")
        .push_bind(query.limit)
        .push(" OFFSET ")
        .push_bind(query.offset);
    let rows = qb
        .build()
        .fetch_all(pool)
        .await
        .context("查询 frames 失败")?;
    let records = rows
        .iter()
        .map(|r| FrameRecord::from_row(r).unwrap())
        .collect();

    Ok((records, total))
}

/// 分页查询帧（用于流式导出）
pub async fn query_frames_paginated(
    pool: &SqlitePool,
    session_id: Option<i64>,
    limit: i64,
    offset: i64,
) -> Result<Vec<FrameRecord>> {
    let mut qb = QueryBuilder::new(SELECT_FRAMES);
    if let Some(sid) = session_id {
        qb.push(" WHERE session_id = ").push_bind(sid);
    }
    qb.push(" ORDER BY timestamp ASC LIMIT ")
        .push_bind(limit)
        .push(" OFFSET ")
        .push_bind(offset);

    let rows = qb
        .build()
        .fetch_all(pool)
        .await
        .context("分页查询 frames 失败")?;
    Ok(rows
        .iter()
        .map(|r| FrameRecord::from_row(r).unwrap())
        .collect())
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
        let sid = session_repo::create_session(&pool, &PortName::new("COM_TEST"), 9600)
            .await
            .unwrap();

        let rows = vec![
            FrameRow::new(
                Some(sid),
                "raw",
                "01 03 FF",
                Direction::Rx,
                "HEX: 01 03 FF",
                "Raw 3 bytes",
            ),
            FrameRow::new(
                Some(sid),
                "raw",
                "AA BB",
                Direction::Tx,
                "HEX: AA BB",
                "Raw 2 bytes",
            ),
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
