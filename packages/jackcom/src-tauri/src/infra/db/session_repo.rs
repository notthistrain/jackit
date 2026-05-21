use anyhow::{Context, Result};
use sqlx::SqlitePool;

use crate::core::serial::types::{PortName, SessionId};

/// 创建新会话
pub async fn create_session(
    pool: &SqlitePool,
    port_name: &PortName,
    baud_rate: u32,
) -> Result<SessionId> {
    let result = sqlx::query_as::<_, (i64,)>(
        "INSERT INTO sessions (port_name, baud_rate) VALUES (?, ?) RETURNING id"
    )
    .bind(port_name.as_str())
    .bind(baud_rate as i64)
    .fetch_one(pool)
    .await
    .context("创建 session 失败")?;

    Ok(SessionId::new(result.0))
}

/// 结束会话
pub async fn end_session(pool: &SqlitePool, session_id: SessionId) -> Result<()> {
    sqlx::query("UPDATE sessions SET ended_at = datetime('now') WHERE id = ?")
        .bind(session_id.value())
        .execute(pool)
        .await
        .context("结束 session 失败")?;
    Ok(())
}

/// 会话信息（用于 list_recent_sessions）
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub id: i64,
    pub port_name: String,
    pub baud_rate: u32,
    pub created_at: String,
}

/// 查询最近的会话
pub async fn list_recent_sessions(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<SessionInfo>> {
    let rows = sqlx::query_as::<_, (i64, String, i64, String)>(
        "SELECT id, port_name, baud_rate, started_at FROM sessions ORDER BY started_at DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .context("查询 sessions 失败")?;

    Ok(rows.into_iter().map(|(id, port_name, baud_rate, started_at)| {
        SessionInfo {
            id,
            port_name,
            baud_rate: baud_rate as u32,
            // DB 字段 started_at → 前端字段 created_at
            created_at: started_at,
        }
    }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn session_crud() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(include_str!("migrations/001_init.sql"))
            .execute(&pool)
            .await
            .unwrap();

        // 创建
        let port = PortName::new("COM_TEST");
        let session_id = create_session(&pool, &port, 115200).await.unwrap();
        assert!(session_id.value() > 0);

        // 查询
        let sessions = list_recent_sessions(&pool, 10).await.unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].port_name, "COM_TEST");
        assert_eq!(sessions[0].baud_rate, 115200);
        // 验证字段映射：started_at → created_at
        assert!(!sessions[0].created_at.is_empty());

        // 结束
        end_session(&pool, session_id).await.unwrap();
    }
}
