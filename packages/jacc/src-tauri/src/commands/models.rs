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

/// 内部函数：获取所有 slot 的绑定信息
pub(crate) async fn get_slot_bindings_inner(pool: &SqlitePool) -> AppResult<Vec<SlotBinding>> {
    let bindings = sqlx::query_as::<_, (String, i64, String, String, String, String, Option<String>)>(
        "SELECT ms.slot, ms.model_id, m.alias, m.base_url, m.model_name, m.api_key, ms.context_size
         FROM model_slots ms JOIN models m ON ms.model_id = m.id
         ORDER BY ms.slot",
    )
    .fetch_all(pool)
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

/// 获取所有 slot 的绑定信息
#[tauri::command]
pub async fn get_slot_bindings(pool: State<'_, SqlitePool>) -> AppResult<Vec<SlotBinding>> {
    get_slot_bindings_inner(pool.inner()).await
}

/// 内部函数：绑定 slot 到数据库，返回模型信息
pub(crate) async fn bind_slot_inner(pool: &SqlitePool, slot: &str, model_id: i64) -> AppResult<Model> {
    // 验证模型存在
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(model_id)
        .fetch_one(pool)
        .await?;

    // 写入或更新 model_slots
    sqlx::query(
        "INSERT INTO model_slots (slot, model_id, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(slot) DO UPDATE SET model_id = excluded.model_id, updated_at = datetime('now')",
    )
    .bind(slot)
    .bind(model_id)
    .execute(pool)
    .await?;

    Ok(model)
}

/// 绑定模型到 slot，并写入 settings.json 环境变量
#[tauri::command]
pub async fn bind_slot(pool: State<'_, SqlitePool>, slot: String, model_id: i64) -> AppResult<()> {
    let model = bind_slot_inner(pool.inner(), &slot, model_id).await?;

    // 写入 settings.json 环境变量
    write_slot_to_settings(&slot, &model)?;

    Ok(())
}

/// 内部函数：解绑 slot
pub(crate) async fn unbind_slot_inner(pool: &SqlitePool, slot: &str) -> AppResult<()> {
    let rows = sqlx::query("DELETE FROM model_slots WHERE slot = ?")
        .bind(slot)
        .execute(pool)
        .await?;

    if rows.rows_affected() == 0 {
        return Err(AppError::Custom(format!("SLOT_UNBOUND:{}", slot)));
    }
    Ok(())
}

/// 解绑 slot
#[tauri::command]
pub async fn unbind_slot(pool: State<'_, SqlitePool>, slot: String) -> AppResult<()> {
    unbind_slot_inner(pool.inner(), &slot).await
}

/// 内部函数：设置当前模型（写入指定路径的 settings.json 的 model 字段）
pub(crate) fn set_current_model_at(slot: &str, context_size: Option<&str>, settings_path: &std::path::Path) -> AppResult<()> {
    let model_value = match context_size {
        Some(ctx) if !ctx.is_empty() => format!("{}[{}]", slot, ctx),
        _ => slot.to_string(),
    };

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(settings_path)?;
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
    std::fs::write(settings_path, content)?;
    Ok(())
}

/// 设置当前模型（写入 settings.json 的 model 字段）
#[tauri::command]
pub async fn set_current_model(slot: String, context_size: Option<String>) -> AppResult<()> {
    set_current_model_at(&slot, context_size.as_deref(), &get_global_settings_path())
}

/// 内部函数：将 slot 绑定的模型信息写入指定路径的 settings.json 的 env
pub(crate) fn write_slot_to_settings_at(slot: &str, model: &Model, settings_path: &std::path::Path) -> AppResult<()> {
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(settings_path)?;
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
    std::fs::write(settings_path, content)?;
    Ok(())
}

/// 将 slot 绑定的模型信息写入 settings.json 的 env
fn write_slot_to_settings(slot: &str, model: &Model) -> AppResult<()> {
    write_slot_to_settings_at(slot, model, &get_global_settings_path())
}

fn get_global_settings_path() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".claude").join("settings.json")
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    /// 创建内存 SQLite 数据库，包含 models 和 model_slots 表
    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alias TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE model_slots (
                slot TEXT PRIMARY KEY,
                model_id INTEGER NOT NULL,
                context_size TEXT,
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    /// 插入测试模型，返回 id
    async fn insert_test_model(pool: &SqlitePool, alias: &str, model_name: &str) -> i64 {
        sqlx::query(
            "INSERT INTO models (alias, base_url, api_key, model_name) VALUES (?, 'https://api.test.com', 'test-api-key-123456', ?)",
        )
        .bind(alias)
        .bind(model_name)
        .execute(pool)
        .await
        .unwrap()
        .last_insert_rowid()
    }

    // ── bind_slot_inner 测试 ──

    #[tokio::test]
    async fn test_bind_slot_inserts_binding() {
        let pool = setup_test_db().await;
        let model_id = insert_test_model(&pool, "opus-main", "claude-opus-4-0-20250514").await;

        let model = bind_slot_inner(&pool, "opus", model_id).await.unwrap();
        assert_eq!(model.id, model_id);
        assert_eq!(model.alias, "opus-main");

        // 验证 model_slots 表有记录
        let (slot, mid): (String, i64) =
            sqlx::query_as("SELECT slot, model_id FROM model_slots WHERE slot = 'opus'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(slot, "opus");
        assert_eq!(mid, model_id);
    }

    #[tokio::test]
    async fn test_bind_slot_updates_existing() {
        let pool = setup_test_db().await;
        let model_a = insert_test_model(&pool, "model-a", "claude-opus-4-0-20250514").await;
        let model_b = insert_test_model(&pool, "model-b", "claude-sonnet-4-20250514").await;

        // 先绑定到 model_a
        bind_slot_inner(&pool, "opus", model_a).await.unwrap();

        // 再绑定到 model_b（UPSERT）
        bind_slot_inner(&pool, "opus", model_b).await.unwrap();

        // 应该只有一条记录，且 model_id 已更新
        let (mid,): (i64,) = sqlx::query_as("SELECT model_id FROM model_slots WHERE slot = 'opus'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(mid, model_b);

        // 确认只有一条 slot 记录
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM model_slots")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_bind_slot_nonexistent_model() {
        let pool = setup_test_db().await;
        let result = bind_slot_inner(&pool, "opus", 9999).await;
        assert!(result.is_err());
    }

    // ── unbind_slot_inner 测试 ──

    #[tokio::test]
    async fn test_unbind_slot_removes_binding() {
        let pool = setup_test_db().await;
        let model_id = insert_test_model(&pool, "opus-main", "claude-opus-4-0-20250514").await;
        bind_slot_inner(&pool, "opus", model_id).await.unwrap();

        unbind_slot_inner(&pool, "opus").await.unwrap();

        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM model_slots")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_unbind_slot_nonexistent() {
        let pool = setup_test_db().await;
        let result = unbind_slot_inner(&pool, "nonexistent").await;
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SLOT_UNBOUND:nonexistent"));
    }

    // ── get_slot_bindings_inner 测试 ──

    #[tokio::test]
    async fn test_get_slot_bindings_returns_bound_slots() {
        let pool = setup_test_db().await;
        let opus_id = insert_test_model(&pool, "opus-main", "claude-opus-4-0-20250514").await;
        let sonnet_id = insert_test_model(&pool, "sonnet-main", "claude-sonnet-4-20250514").await;

        bind_slot_inner(&pool, "opus", opus_id).await.unwrap();
        bind_slot_inner(&pool, "sonnet", sonnet_id).await.unwrap();

        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert_eq!(bindings.len(), 2);

        // 按 slot 排序：haiku, opus, sonnet
        assert_eq!(bindings[0].slot, "opus");
        assert_eq!(bindings[0].model_id, opus_id);
        assert_eq!(bindings[0].alias, "opus-main");
        assert_eq!(bindings[0].model_name, "claude-opus-4-0-20250514");

        assert_eq!(bindings[1].slot, "sonnet");
        assert_eq!(bindings[1].model_id, sonnet_id);
        assert_eq!(bindings[1].alias, "sonnet-main");
    }

    #[tokio::test]
    async fn test_get_slot_bindings_empty() {
        let pool = setup_test_db().await;
        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert!(bindings.is_empty());
    }

    // ── write_slot_to_settings_at 测试 ──

    #[tokio::test]
    async fn test_write_slot_to_settings_opus() {
        let pool = setup_test_db().await;
        let model_id = insert_test_model(&pool, "opus-main", "claude-opus-4-0-20250514").await;
        let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
            .bind(model_id)
            .fetch_one(&pool)
            .await
            .unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        write_slot_to_settings_at("opus", &model, &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        let env = settings.get("env").unwrap();

        assert_eq!(env["ANTHROPIC_DEFAULT_OPUS_MODEL"], "claude-opus-4-0-20250514");
        assert_eq!(env["ANTHROPIC_BASE_URL"], "https://api.test.com");
        assert_eq!(env["ANTHROPIC_AUTH_TOKEN"], "test-api-key-123456");
    }

    #[tokio::test]
    async fn test_write_slot_to_settings_sonnet() {
        let pool = setup_test_db().await;
        let model_id = insert_test_model(&pool, "sonnet-main", "claude-sonnet-4-20250514").await;
        let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
            .bind(model_id)
            .fetch_one(&pool)
            .await
            .unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        write_slot_to_settings_at("sonnet", &model, &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        let env = settings.get("env").unwrap();

        assert_eq!(env["ANTHROPIC_DEFAULT_SONNET_MODEL"], "claude-sonnet-4-20250514");
    }

    #[tokio::test]
    async fn test_write_slot_to_settings_haiku() {
        let pool = setup_test_db().await;
        let model_id = insert_test_model(&pool, "haiku-main", "claude-haiku-4-20250514").await;
        let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
            .bind(model_id)
            .fetch_one(&pool)
            .await
            .unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        write_slot_to_settings_at("haiku", &model, &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        let env = settings.get("env").unwrap();

        assert_eq!(env["ANTHROPIC_DEFAULT_HAIKU_MODEL"], "claude-haiku-4-20250514");
    }

    #[tokio::test]
    async fn test_write_slot_to_settings_unknown_slot() {
        let pool = setup_test_db().await;
        let model_id = insert_test_model(&pool, "custom", "custom-model").await;
        let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
            .bind(model_id)
            .fetch_one(&pool)
            .await
            .unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        write_slot_to_settings_at("custom-slot", &model, &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        let env = settings.get("env").unwrap();

        // 未知 slot 应该写入 ANTHROPIC_MODEL
        assert_eq!(env["ANTHROPIC_MODEL"], "custom-model");
    }

    #[tokio::test]
    async fn test_write_slot_to_settings_preserves_existing() {
        let pool = setup_test_db().await;
        let model_id = insert_test_model(&pool, "opus-main", "claude-opus-4-0-20250514").await;
        let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
            .bind(model_id)
            .fetch_one(&pool)
            .await
            .unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        // 先写入 opus
        write_slot_to_settings_at("opus", &model, &settings_path).unwrap();

        // 再写入 sonnet，应该保留 opus 的设置
        let sonnet_id = insert_test_model(&pool, "sonnet-main", "claude-sonnet-4-20250514").await;
        let sonnet_model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
            .bind(sonnet_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        write_slot_to_settings_at("sonnet", &sonnet_model, &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        let env = settings.get("env").unwrap();

        // opus 的 MODEL 环境变量应该仍然存在
        assert_eq!(env["ANTHROPIC_DEFAULT_OPUS_MODEL"], "claude-opus-4-0-20250514");
        // sonnet 的 MODEL 环境变量也被写入
        assert_eq!(env["ANTHROPIC_DEFAULT_SONNET_MODEL"], "claude-sonnet-4-20250514");
    }

    // ── set_current_model_at 测试 ──

    #[test]
    fn test_set_current_model_with_context() {
        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        set_current_model_at("opus", Some("1m"), &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(settings["model"], "opus[1m]");
    }

    #[test]
    fn test_set_current_model_without_context() {
        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        set_current_model_at("sonnet", None, &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(settings["model"], "sonnet");
    }

    #[test]
    fn test_set_current_model_empty_context() {
        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        set_current_model_at("haiku", Some(""), &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(settings["model"], "haiku");
    }

    #[test]
    fn test_set_current_model_updates_existing() {
        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        // 先设置 opus
        set_current_model_at("opus", None, &settings_path).unwrap();

        // 再设置 sonnet，应该覆盖 model 字段
        set_current_model_at("sonnet", Some("200k"), &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(settings["model"], "sonnet[200k]");
    }

    // ── CASCADE DELETE 测试 ──

    #[tokio::test]
    async fn test_cascade_delete() {
        let pool = setup_test_db().await;
        let model_id = insert_test_model(&pool, "opus-main", "claude-opus-4-0-20250514").await;

        // 绑定 slot
        bind_slot_inner(&pool, "opus", model_id).await.unwrap();

        // 确认 slot 存在
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM model_slots")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1);

        // 删除模型
        sqlx::query("DELETE FROM models WHERE id = ?")
            .bind(model_id)
            .execute(&pool)
            .await
            .unwrap();

        // CASCADE 应该删除 slot
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM model_slots")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
    }

    // ── ModelView API key 掩码测试 ──

    #[test]
    fn test_model_view_masking_long_key() {
        let model = Model {
            id: 1,
            alias: "test".to_string(),
            base_url: "https://api.test.com".to_string(),
            api_key: "sk-ant-12345678-abcdef".to_string(),
            model_name: "claude-opus-4".to_string(),
            context_size: None,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
        };
        let view = ModelView::from(&model);
        assert_eq!(view.api_key_masked, "sk-ant-1***");
    }

    #[test]
    fn test_model_view_masking_short_key() {
        let model = Model {
            id: 1,
            alias: "test".to_string(),
            base_url: "https://api.test.com".to_string(),
            api_key: "short".to_string(),
            model_name: "claude-opus-4".to_string(),
            context_size: None,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
        };
        let view = ModelView::from(&model);
        assert_eq!(view.api_key_masked, "***");
    }

    #[test]
    fn test_model_view_masking_exact_8_chars() {
        let model = Model {
            id: 1,
            alias: "test".to_string(),
            base_url: "https://api.test.com".to_string(),
            api_key: "12345678".to_string(),
            model_name: "claude-opus-4".to_string(),
            context_size: None,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
        };
        let view = ModelView::from(&model);
        // 8 chars: len() == 8, not > 8
        assert_eq!(view.api_key_masked, "***");
    }

    #[test]
    fn test_model_view_masking_9_chars() {
        let model = Model {
            id: 1,
            alias: "test".to_string(),
            base_url: "https://api.test.com".to_string(),
            api_key: "123456789".to_string(),
            model_name: "claude-opus-4".to_string(),
            context_size: None,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
        };
        let view = ModelView::from(&model);
        // 9 chars: len() > 8
        assert_eq!(view.api_key_masked, "12345678***");
    }
}
