use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Model {
    pub id: i64,
    pub api_key_id: i64,
    pub model_name: String,
    pub context_size: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateModelInput {
    pub api_key_id: i64,
    pub model_name: String,
    pub context_size: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModelInput {
    pub model_name: Option<String>,
    pub context_size: Option<String>,
}

pub(crate) async fn add_model_inner(
    pool: &SqlitePool,
    input: CreateModelInput,
) -> AppResult<Model> {
    let context_size = input.context_size.as_deref().filter(|s| !s.is_empty());

    let model = sqlx::query_as::<_, Model>(
        "INSERT INTO models (api_key_id, model_name, context_size) VALUES (?, ?, ?) RETURNING *",
    )
    .bind(input.api_key_id)
    .bind(&input.model_name)
    .bind(&context_size)
    .fetch_one(pool)
    .await?;
    Ok(model)
}

pub(crate) async fn list_models_inner(
    pool: &SqlitePool,
    api_key_id: i64,
) -> AppResult<Vec<Model>> {
    let models = sqlx::query_as::<_, Model>(
        "SELECT * FROM models WHERE api_key_id = ? ORDER BY created_at DESC",
    )
    .bind(api_key_id)
    .fetch_all(pool)
    .await?;
    Ok(models)
}

pub(crate) async fn update_model_inner(
    pool: &SqlitePool,
    id: i64,
    input: UpdateModelInput,
) -> AppResult<()> {
    let mut query = String::from("UPDATE models SET updated_at = datetime('now')");
    let mut binds: Vec<String> = vec![];

    if let Some(ref model_name) = input.model_name {
        query.push_str(", model_name = ?");
        binds.push(model_name.clone());
    }
    if let Some(ref context_size) = input.context_size {
        if context_size.is_empty() {
            query.push_str(", context_size = NULL");
        } else {
            query.push_str(", context_size = ?");
            binds.push(context_size.clone());
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

pub(crate) async fn delete_model_inner(pool: &SqlitePool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM models WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// 测试模型连接：联查 3 层获取 base_url + api_key + model_name
pub(crate) async fn test_model_inner(pool: &SqlitePool, id: i64) -> AppResult<String> {
    let row = sqlx::query_as::<_, (String, String, String)>(
        "SELECT p.base_url, ak.api_key, m.model_name
         FROM models m
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE m.id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Custom("MODEL_NOT_FOUND".to_string()))?;

    let (base_url, api_key, model_name) = row;

    let client = reqwest::Client::new();
    let url = format!("{}/v1/messages", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model_name,
        "max_tokens": 1,
        "messages": [{"role": "user", "content": "hi"}]
    });
    let resp = client
        .post(&url)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| AppError::Custom(format!("CONNECTION_FAILED:{}", e)))?;

    if resp.status().is_success() || resp.status().as_u16() == 400 {
        Ok("CONNECTION_SUCCESS".to_string())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(AppError::Custom(format!("HTTP_ERROR:{}:{}", status.as_u16(), body)))
    }
}

#[tauri::command]
pub async fn add_model(pool: State<'_, SqlitePool>, input: CreateModelInput) -> AppResult<Model> {
    add_model_inner(pool.inner(), input).await
}

#[tauri::command]
pub async fn list_models(pool: State<'_, SqlitePool>, api_key_id: i64) -> AppResult<Vec<Model>> {
    list_models_inner(pool.inner(), api_key_id).await
}

#[tauri::command]
pub async fn update_model(pool: State<'_, SqlitePool>, id: i64, input: UpdateModelInput) -> AppResult<()> {
    update_model_inner(pool.inner(), id, input).await
}

#[tauri::command]
pub async fn delete_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    delete_model_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn test_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<String> {
    test_model_inner(pool.inner(), id).await
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
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key_id INTEGER NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn insert_test_api_key(pool: &SqlitePool) -> i64 {
        let pid = sqlx::query("INSERT INTO providers (name, base_url) VALUES ('Test', 'https://api.test.com')")
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid();
        sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?, 'Key', 'sk-test-12345678')")
            .bind(pid)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid()
    }

    #[tokio::test]
    async fn test_add_model() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let input = CreateModelInput {
            api_key_id: ak_id,
            model_name: "claude-opus-4-6".to_string(),
            context_size: Some("200k".to_string()),
        };
        let m = add_model_inner(&pool, input).await.unwrap();
        assert_eq!(m.model_name, "claude-opus-4-6");
        assert_eq!(m.context_size.as_deref(), Some("200k"));
        assert_eq!(m.api_key_id, ak_id);
    }

    #[tokio::test]
    async fn test_list_models_by_api_key() {
        let pool = setup_test_db().await;
        let ak1 = insert_test_api_key(&pool).await;
        let ak2 = insert_test_api_key(&pool).await;

        add_model_inner(&pool, CreateModelInput {
            api_key_id: ak1,
            model_name: "model-a".to_string(),
            context_size: None,
        }).await.unwrap();
        add_model_inner(&pool, CreateModelInput {
            api_key_id: ak2,
            model_name: "model-b".to_string(),
            context_size: None,
        }).await.unwrap();

        let models = list_models_inner(&pool, ak1).await.unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].model_name, "model-a");
    }

    #[tokio::test]
    async fn test_update_model() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let m = add_model_inner(&pool, CreateModelInput {
            api_key_id: ak_id,
            model_name: "old-name".to_string(),
            context_size: None,
        }).await.unwrap();

        update_model_inner(&pool, m.id, UpdateModelInput {
            model_name: Some("new-name".to_string()),
            context_size: Some("1m".to_string()),
        }).await.unwrap();

        let models = list_models_inner(&pool, ak_id).await.unwrap();
        assert_eq!(models[0].model_name, "new-name");
        assert_eq!(models[0].context_size.as_deref(), Some("1m"));
    }

    #[tokio::test]
    async fn test_update_model_clear_context() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let m = add_model_inner(&pool, CreateModelInput {
            api_key_id: ak_id,
            model_name: "test".to_string(),
            context_size: Some("200k".to_string()),
        }).await.unwrap();

        update_model_inner(&pool, m.id, UpdateModelInput {
            model_name: None,
            context_size: Some("".to_string()),
        }).await.unwrap();

        let models = list_models_inner(&pool, ak_id).await.unwrap();
        assert!(models[0].context_size.is_none());
    }

    #[tokio::test]
    async fn test_delete_model() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let m = add_model_inner(&pool, CreateModelInput {
            api_key_id: ak_id,
            model_name: "to-delete".to_string(),
            context_size: None,
        }).await.unwrap();

        delete_model_inner(&pool, m.id).await.unwrap();
        let models = list_models_inner(&pool, ak_id).await.unwrap();
        assert!(models.is_empty());
    }

    #[tokio::test]
    async fn test_test_model_success() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let m = add_model_inner(&pool, CreateModelInput {
            api_key_id: ak_id,
            model_name: "test-model".to_string(),
            context_size: None,
        }).await.unwrap();

        // test_model 会发 HTTP 请求，这里只验证它能正确查找 3 层关联
        // 实际 HTTP 调用会失败，但错误消息应该包含 base_url
        let result = test_model_inner(&pool, m.id).await;
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("https://api.test.com"));
    }
}
