use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppResult;

#[derive(Debug, sqlx::FromRow)]
pub struct ApiKey {
    pub id: i64,
    pub provider_id: i64,
    pub name: String,
    pub api_key: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyView {
    pub id: i64,
    pub provider_id: i64,
    pub name: String,
    pub api_key_masked: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl ApiKeyView {
    pub fn from_api_key(ak: &ApiKey) -> Self {
        let masked = if ak.api_key.len() > 8 {
            format!("{}***", &ak.api_key[..8])
        } else {
            "***".to_string()
        };
        Self {
            id: ak.id,
            provider_id: ak.provider_id,
            name: ak.name.clone(),
            api_key_masked: masked,
            notes: ak.notes.clone(),
            created_at: ak.created_at.clone(),
            updated_at: ak.updated_at.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateApiKeyInput {
    pub provider_id: i64,
    pub name: String,
    pub api_key: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateApiKeyInput {
    pub name: Option<String>,
    pub api_key: Option<String>,
    pub notes: Option<String>,
}

pub(crate) async fn add_api_key_inner(
    pool: &SqlitePool,
    input: CreateApiKeyInput,
) -> AppResult<ApiKey> {
    let notes = input.notes.as_deref().filter(|s| !s.is_empty());

    let ak = sqlx::query_as::<_, ApiKey>(
        "INSERT INTO api_keys (provider_id, name, api_key, notes) VALUES (?, ?, ?, ?) RETURNING *",
    )
    .bind(input.provider_id)
    .bind(&input.name)
    .bind(&input.api_key)
    .bind(&notes)
    .fetch_one(pool)
    .await?;
    Ok(ak)
}

pub(crate) async fn list_api_keys_inner(
    pool: &SqlitePool,
    provider_id: i64,
) -> AppResult<Vec<ApiKeyView>> {
    let keys = sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_keys WHERE provider_id = ? ORDER BY created_at DESC",
    )
    .bind(provider_id)
    .fetch_all(pool)
    .await?;
    Ok(keys.iter().map(ApiKeyView::from_api_key).collect())
}

pub(crate) async fn update_api_key_inner(
    pool: &SqlitePool,
    id: i64,
    input: UpdateApiKeyInput,
) -> AppResult<()> {
    let mut query = String::from("UPDATE api_keys SET updated_at = datetime('now')");
    let mut binds: Vec<String> = vec![];

    if let Some(ref name) = input.name {
        query.push_str(", name = ?");
        binds.push(name.clone());
    }
    if let Some(ref api_key) = input.api_key {
        query.push_str(", api_key = ?");
        binds.push(api_key.clone());
    }
    if let Some(ref notes) = input.notes {
        if notes.is_empty() {
            query.push_str(", notes = NULL");
        } else {
            query.push_str(", notes = ?");
            binds.push(notes.clone());
        }
    }

    query.push_str(" WHERE id = ?");

    let mut q = sqlx::query(&query);
    for b in &binds {
        q = q.bind(b);
    }
    q = q.bind(id);
    q.execute(pool).await?;
    Ok(())
}

pub(crate) async fn delete_api_key_inner(pool: &SqlitePool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM api_keys WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn add_api_key(
    pool: State<'_, SqlitePool>,
    input: CreateApiKeyInput,
) -> AppResult<ApiKeyView> {
    let ak = add_api_key_inner(pool.inner(), input).await?;
    Ok(ApiKeyView::from_api_key(&ak))
}

#[tauri::command]
pub async fn list_api_keys(
    pool: State<'_, SqlitePool>,
    provider_id: i64,
) -> AppResult<Vec<ApiKeyView>> {
    list_api_keys_inner(pool.inner(), provider_id).await
}

#[tauri::command]
pub async fn update_api_key(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateApiKeyInput,
) -> AppResult<()> {
    update_api_key_inner(pool.inner(), id, input).await
}

#[tauri::command]
pub async fn delete_api_key(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    delete_api_key_inner(pool.inner(), id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
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
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn insert_test_provider(pool: &SqlitePool, name: &str) -> i64 {
        sqlx::query("INSERT INTO providers (name, base_url) VALUES (?, 'https://api.test.com')")
            .bind(name)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid()
    }

    #[tokio::test]
    async fn test_add_api_key() {
        let pool = setup_test_db().await;
        let pid = insert_test_provider(&pool, "TestProvider").await;

        let input = CreateApiKeyInput {
            provider_id: pid,
            name: "Main Key".to_string(),
            api_key: "sk-ant-api123456789".to_string(),
            notes: Some("production".to_string()),
        };
        let ak = add_api_key_inner(&pool, input).await.unwrap();
        assert_eq!(ak.name, "Main Key");
        assert_eq!(ak.provider_id, pid);
        assert_eq!(ak.notes.as_deref(), Some("production"));
    }

    #[tokio::test]
    async fn test_list_api_keys_masks_key() {
        let pool = setup_test_db().await;
        let pid = insert_test_provider(&pool, "TestProvider").await;

        add_api_key_inner(
            &pool,
            CreateApiKeyInput {
                provider_id: pid,
                name: "Key1".to_string(),
                api_key: "sk-ant-123456789abc".to_string(),
                notes: None,
            },
        )
        .await
        .unwrap();

        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        assert_eq!(views.len(), 1);
        assert_eq!(views[0].api_key_masked, "sk-ant-1***");
        assert_eq!(views[0].name, "Key1");
    }

    #[tokio::test]
    async fn test_list_api_keys_filters_by_provider() {
        let pool = setup_test_db().await;
        let pid_a = insert_test_provider(&pool, "A").await;
        let pid_b = insert_test_provider(&pool, "B").await;

        add_api_key_inner(
            &pool,
            CreateApiKeyInput {
                provider_id: pid_a,
                name: "Key A".to_string(),
                api_key: "key-a-12345678".to_string(),
                notes: None,
            },
        )
        .await
        .unwrap();
        add_api_key_inner(
            &pool,
            CreateApiKeyInput {
                provider_id: pid_b,
                name: "Key B".to_string(),
                api_key: "key-b-12345678".to_string(),
                notes: None,
            },
        )
        .await
        .unwrap();

        let views_a = list_api_keys_inner(&pool, pid_a).await.unwrap();
        assert_eq!(views_a.len(), 1);
        assert_eq!(views_a[0].name, "Key A");
    }

    #[tokio::test]
    async fn test_update_api_key() {
        let pool = setup_test_db().await;
        let pid = insert_test_provider(&pool, "TestProvider").await;

        add_api_key_inner(
            &pool,
            CreateApiKeyInput {
                provider_id: pid,
                name: "Old".to_string(),
                api_key: "old-key-12345678".to_string(),
                notes: None,
            },
        )
        .await
        .unwrap();

        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        let id = views[0].id;

        update_api_key_inner(
            &pool,
            id,
            UpdateApiKeyInput {
                name: Some("New Name".to_string()),
                api_key: None,
                notes: Some("updated notes".to_string()),
            },
        )
        .await
        .unwrap();

        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        assert_eq!(views[0].name, "New Name");
        assert_eq!(views[0].notes.as_deref(), Some("updated notes"));
    }

    #[tokio::test]
    async fn test_delete_api_key() {
        let pool = setup_test_db().await;
        let pid = insert_test_provider(&pool, "TestProvider").await;

        add_api_key_inner(
            &pool,
            CreateApiKeyInput {
                provider_id: pid,
                name: "ToDelete".to_string(),
                api_key: "del-key-12345678".to_string(),
                notes: None,
            },
        )
        .await
        .unwrap();

        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        let id = views[0].id;

        delete_api_key_inner(&pool, id).await.unwrap();
        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        assert!(views.is_empty());
    }

    #[tokio::test]
    async fn test_mask_short_key() {
        let view = ApiKeyView::from_api_key(&ApiKey {
            id: 1,
            provider_id: 1,
            name: "test".to_string(),
            api_key: "short".to_string(),
            notes: None,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
        });
        assert_eq!(view.api_key_masked, "***");
    }

    #[tokio::test]
    async fn test_mask_long_key() {
        let view = ApiKeyView::from_api_key(&ApiKey {
            id: 1,
            provider_id: 1,
            name: "test".to_string(),
            api_key: "sk-ant-api123456789abcdef".to_string(),
            notes: None,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
        });
        assert_eq!(view.api_key_masked, "sk-ant-a***");
    }
}
