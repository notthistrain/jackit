use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;
use crate::error::AppResult;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeleteKind {
    Provider,
    ApiKey,
    Model,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ImpactedSlot {
    pub slot: String,
    pub model_name: String,
    pub model_id: i64,
}

pub(crate) async fn preview_delete_impact_inner(
    pool: &SqlitePool,
    kind: DeleteKind,
    id: i64,
) -> AppResult<Vec<ImpactedSlot>> {
    let sql = match kind {
        DeleteKind::Provider => {
            "SELECT ms.slot, m.model_name, m.id as model_id
             FROM model_slots ms
             JOIN models m ON ms.model_id = m.id
             JOIN api_keys ak ON m.api_key_id = ak.id
             WHERE ak.provider_id = ?"
        }
        DeleteKind::ApiKey => {
            "SELECT ms.slot, m.model_name, m.id as model_id
             FROM model_slots ms
             JOIN models m ON ms.model_id = m.id
             WHERE m.api_key_id = ?"
        }
        DeleteKind::Model => {
            "SELECT ms.slot, m.model_name, m.id as model_id
             FROM model_slots ms
             JOIN models m ON ms.model_id = m.id
             WHERE m.id = ?"
        }
    };
    let rows = sqlx::query_as::<_, ImpactedSlot>(sql)
        .bind(id)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn preview_delete_impact(
    pool: State<'_, SqlitePool>,
    kind: DeleteKind,
    id: i64,
) -> AppResult<Vec<ImpactedSlot>> {
    log_command!("preview_delete_impact", {
        preview_delete_impact_inner(pool.inner(), kind, id).await
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await.unwrap();
        sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await.unwrap();
        sqlx::query(
            "CREATE TABLE providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )"
        ).execute(&pool).await.unwrap();
        sqlx::query(
            "CREATE TABLE api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                api_key TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
            )"
        ).execute(&pool).await.unwrap();
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key_id INTEGER NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
            )"
        ).execute(&pool).await.unwrap();
        sqlx::query(
            "CREATE TABLE model_slots (
                slot TEXT PRIMARY KEY,
                model_id INTEGER NOT NULL,
                context_size TEXT,
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
            )"
        ).execute(&pool).await.unwrap();
        pool
    }

    async fn insert_full_chain(pool: &SqlitePool) -> (i64, i64, i64) {
        let pid = sqlx::query("INSERT INTO providers (name, base_url) VALUES ('A', 'https://a.com')")
            .execute(pool).await.unwrap().last_insert_rowid();
        let ak = sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?, 'k', 'sk-x12345678')")
            .bind(pid).execute(pool).await.unwrap().last_insert_rowid();
        let m = sqlx::query("INSERT INTO models (api_key_id, model_name) VALUES (?, 'm')")
            .bind(ak).execute(pool).await.unwrap().last_insert_rowid();
        sqlx::query("INSERT INTO model_slots (slot, model_id) VALUES ('opus', ?)")
            .bind(m).execute(pool).await.unwrap();
        (pid, ak, m)
    }

    #[tokio::test]
    async fn preview_provider_returns_impacted_slots() {
        let pool = setup_test_db().await;
        let (pid, _, m) = insert_full_chain(&pool).await;
        let r = preview_delete_impact_inner(&pool, DeleteKind::Provider, pid).await.unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].slot, "opus");
        assert_eq!(r[0].model_id, m);
    }

    #[tokio::test]
    async fn preview_apikey_returns_impacted_slots() {
        let pool = setup_test_db().await;
        let (_, ak, _) = insert_full_chain(&pool).await;
        let r = preview_delete_impact_inner(&pool, DeleteKind::ApiKey, ak).await.unwrap();
        assert_eq!(r.len(), 1);
    }

    #[tokio::test]
    async fn preview_model_returns_impacted_slots() {
        let pool = setup_test_db().await;
        let (_, _, m) = insert_full_chain(&pool).await;
        let r = preview_delete_impact_inner(&pool, DeleteKind::Model, m).await.unwrap();
        assert_eq!(r.len(), 1);
    }

    #[tokio::test]
    async fn preview_returns_empty_when_no_slot() {
        let pool = setup_test_db().await;
        let pid = sqlx::query("INSERT INTO providers (name, base_url) VALUES ('A', 'https://a.com')")
            .execute(&pool).await.unwrap().last_insert_rowid();
        let r = preview_delete_impact_inner(&pool, DeleteKind::Provider, pid).await.unwrap();
        assert!(r.is_empty());
    }
}
