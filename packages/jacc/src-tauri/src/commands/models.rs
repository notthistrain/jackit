use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Model {
    pub id: i64,
    pub alias: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
    pub slot: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateModelInput {
    pub alias: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
    pub slot: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModelInput {
    pub alias: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub model_name: Option<String>,
}

#[tauri::command]
pub async fn list_models(pool: State<'_, SqlitePool>) -> AppResult<Vec<Model>> {
    let models = sqlx::query_as::<_, Model>(
        "SELECT id, alias, base_url, api_key, model_name, slot, created_at, updated_at
         FROM models ORDER BY created_at DESC",
    )
    .fetch_all(pool.inner())
    .await?;
    Ok(models)
}

#[tauri::command]
pub async fn add_model(pool: State<'_, SqlitePool>, input: CreateModelInput) -> AppResult<Model> {
    let id = sqlx::query(
        "INSERT INTO models (alias, base_url, api_key, model_name, slot) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&input.alias)
    .bind(&input.base_url)
    .bind(&input.api_key)
    .bind(&input.model_name)
    .bind(&input.slot)
    .execute(pool.inner())
    .await?
    .last_insert_rowid();

    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;
    Ok(model)
}

#[tauri::command]
pub async fn update_model(pool: State<'_, SqlitePool>, id: i64, input: UpdateModelInput) -> AppResult<()> {
    let mut query = String::from("UPDATE models SET updated_at = datetime('now')");
    let mut binds: Vec<String> = vec![];

    if let Some(ref alias) = input.alias {
        query.push_str(", alias = ?");
        binds.push(alias.clone());
    }
    if let Some(ref base_url) = input.base_url {
        query.push_str(", base_url = ?");
        binds.push(base_url.clone());
    }
    if let Some(ref api_key) = input.api_key {
        query.push_str(", api_key = ?");
        binds.push(api_key.clone());
    }
    if let Some(ref model_name) = input.model_name {
        query.push_str(", model_name = ?");
        binds.push(model_name.clone());
    }

    query.push_str(" WHERE id = ?");

    let mut q = sqlx::query(&query);
    for b in &binds {
        q = q.bind(b);
    }
    q = q.bind(id);
    q.execute(pool.inner()).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM models WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn activate_model(pool: State<'_, SqlitePool>, id: i64, slot: String) -> AppResult<()> {
    // 清除该槽位的旧激活
    sqlx::query("UPDATE models SET slot = NULL WHERE slot = ?")
        .bind(&slot)
        .execute(pool.inner())
        .await?;

    // 激活新模型到该槽位
    sqlx::query("UPDATE models SET slot = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(&slot)
        .bind(id)
        .execute(pool.inner())
        .await?;

    // 读取模型信息，写入 settings.json 环境变量
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;

    write_model_to_settings(&model)?;
    Ok(())
}

#[tauri::command]
pub async fn test_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<String> {
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;

    // 简单的 HTTP 请求测试连接
    let client = reqwest::Client::new();
    let url = format!("{}/v1/messages", model.base_url.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .header("x-api-key", &model.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .body(r#"{"model":"claude-haiku-4-5-20251001","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}"#)
        .send()
        .await
        .map_err(|e| AppError::Custom(format!("连接失败: {}", e)))?;

    if resp.status().is_success() || resp.status().as_u16() == 400 {
        Ok("连接成功".to_string())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(AppError::Custom(format!("HTTP {}: {}", status, body)))
    }
}

/// 将模型配置写入全局 settings.json 的环境变量
fn write_model_to_settings(model: &Model) -> AppResult<()> {
    let settings_path = get_global_settings_path();

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)?;
        serde_json::from_str(&content)?
    } else {
        serde_json::json!({})
    };

    let env = settings
        .as_object_mut()
        .unwrap()
        .entry("env")
        .or_insert_with(|| serde_json::json!({}));

    let env_obj = env.as_object_mut().unwrap();
    env_obj.insert(
        "ANTHROPIC_BASE_URL".to_string(),
        serde_json::Value::String(model.base_url.clone()),
    );
    env_obj.insert(
        "ANTHROPIC_AUTH_TOKEN".to_string(),
        serde_json::Value::String(model.api_key.clone()),
    );
    env_obj.insert(
        "ANTHROPIC_MODEL".to_string(),
        serde_json::Value::String(model.model_name.clone()),
    );

    let content = serde_json::to_string_pretty(&settings)?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&settings_path, content)?;
    Ok(())
}

fn get_global_settings_path() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".claude").join("settings.json")
}
