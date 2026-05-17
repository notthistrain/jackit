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
    pub context_size: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// 返回给前端的模型信息，API key 做掩码处理
#[derive(Debug, Serialize)]
pub struct ModelView {
    pub id: i64,
    pub alias: String,
    pub base_url: String,
    pub api_key_masked: String,
    pub model_name: String,
    pub context_size: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&Model> for ModelView {
    fn from(m: &Model) -> Self {
        let masked = if m.api_key.len() > 8 {
            format!("{}***", &m.api_key[..8])
        } else {
            "***".to_string()
        };
        Self {
            id: m.id,
            alias: m.alias.clone(),
            base_url: m.base_url.clone(),
            api_key_masked: masked,
            model_name: m.model_name.clone(),
            context_size: m.context_size.clone(),
            created_at: m.created_at.clone(),
            updated_at: m.updated_at.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateModelInput {
    pub alias: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
    pub context_size: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModelInput {
    pub alias: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub model_name: Option<String>,
    pub context_size: Option<String>,
}

/// slot 绑定信息（联查 model_slots + models）
#[derive(Debug, Serialize)]
pub struct SlotBinding {
    pub slot: String,
    pub model_id: i64,
    pub alias: String,
    pub base_url: String,
    pub model_name: String,
    pub api_key: String,
    pub context_size: Option<String>,
}

#[tauri::command]
pub async fn list_models(pool: State<'_, SqlitePool>) -> AppResult<Vec<ModelView>> {
    let models = sqlx::query_as::<_, Model>(
        "SELECT id, alias, base_url, api_key, model_name, context_size, created_at, updated_at
         FROM models ORDER BY created_at DESC",
    )
    .fetch_all(pool.inner())
    .await?;
    Ok(models.iter().map(ModelView::from).collect())
}

#[tauri::command]
pub async fn add_model(pool: State<'_, SqlitePool>, input: CreateModelInput) -> AppResult<ModelView> {
    let context_size = input.context_size.as_deref().filter(|s| !s.is_empty());

    let id = sqlx::query(
        "INSERT INTO models (alias, base_url, api_key, model_name, context_size) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&input.alias)
    .bind(&input.base_url)
    .bind(&input.api_key)
    .bind(&input.model_name)
    .bind(&context_size)
    .execute(pool.inner())
    .await?
    .last_insert_rowid();

    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;
    Ok(ModelView::from(&model))
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
pub async fn test_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<String> {
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;

    let client = reqwest::Client::new();
    let url = format!("{}/v1/messages", model.base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model.model_name,
        "max_tokens": 1,
        "messages": [{"role": "user", "content": "hi"}]
    });
    let resp = client
        .post(&url)
        .header("x-api-key", &model.api_key)
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

/// 获取所有 slot 的绑定信息
#[tauri::command]
pub async fn get_slot_bindings(pool: State<'_, SqlitePool>) -> AppResult<Vec<SlotBinding>> {
    let bindings = sqlx::query_as::<_, (String, i64, String, String, String, String, Option<String>)>(
        "SELECT ms.slot, ms.model_id, m.alias, m.base_url, m.model_name, m.api_key, ms.context_size
         FROM model_slots ms JOIN models m ON ms.model_id = m.id
         ORDER BY ms.slot",
    )
    .fetch_all(pool.inner())
    .await?;

    Ok(bindings
        .into_iter()
        .map(|(slot, model_id, alias, base_url, model_name, api_key, context_size)| SlotBinding {
            slot,
            model_id,
            alias,
            base_url,
            model_name,
            api_key,
            context_size,
        })
        .collect())
}

/// 绑定模型到 slot，并写入 settings.json 环境变量
#[tauri::command]
pub async fn bind_slot(pool: State<'_, SqlitePool>, slot: String, model_id: i64) -> AppResult<()> {
    // 验证模型存在
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(model_id)
        .fetch_one(pool.inner())
        .await?;

    // 写入或更新 model_slots
    sqlx::query(
        "INSERT INTO model_slots (slot, model_id, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(slot) DO UPDATE SET model_id = excluded.model_id, updated_at = datetime('now')",
    )
    .bind(&slot)
    .bind(model_id)
    .execute(pool.inner())
    .await?;

    // 写入 settings.json 环境变量
    write_slot_to_settings(&slot, &model)?;

    Ok(())
}

/// 解绑 slot
#[tauri::command]
pub async fn unbind_slot(pool: State<'_, SqlitePool>, slot: String) -> AppResult<()> {
    let rows = sqlx::query("DELETE FROM model_slots WHERE slot = ?")
        .bind(&slot)
        .execute(pool.inner())
        .await?;

    if rows.rows_affected() == 0 {
        return Err(AppError::Custom(format!("SLOT_UNBOUND:{}", slot)));
    }
    Ok(())
}

/// 设置当前模型（写入 settings.json 的 model 字段）
#[tauri::command]
pub async fn set_current_model(slot: String, context_size: Option<String>) -> AppResult<()> {
    let model_value = match &context_size {
        Some(ctx) if !ctx.is_empty() => format!("{}[{}]", slot, ctx),
        _ => slot.clone(),
    };

    let settings_path = get_global_settings_path();

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)?;
        serde_json::from_str(&content)?
    } else {
        serde_json::json!({})
    };

    settings
        .as_object_mut()
        .unwrap()
        .insert("model".to_string(), serde_json::Value::String(model_value));

    let content = serde_json::to_string_pretty(&settings)?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&settings_path, content)?;
    Ok(())
}

/// 将 slot 绑定的模型信息写入 settings.json 的 env
fn write_slot_to_settings(slot: &str, model: &Model) -> AppResult<()> {
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

    // 写入全局凭证（每次绑定覆盖）
    env_obj.insert(
        "ANTHROPIC_BASE_URL".to_string(),
        serde_json::Value::String(model.base_url.clone()),
    );
    env_obj.insert(
        "ANTHROPIC_AUTH_TOKEN".to_string(),
        serde_json::Value::String(model.api_key.clone()),
    );

    // 根据 slot 写入对应的 DEFAULT_*_MODEL 环境变量
    let env_key = match slot {
        "opus" => "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "sonnet" => "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "haiku" => "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        _ => "ANTHROPIC_MODEL",
    };
    env_obj.insert(
        env_key.to_string(),
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
