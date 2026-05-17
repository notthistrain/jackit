use serde::Serialize;
use sqlx::SqlitePool;
use std::path::Path;
use tauri::State;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
pub struct SlotBinding {
    pub slot: String,
    pub model_id: i64,
    pub model_name: String,
    pub context_size: Option<String>,
    pub api_key: String,
    pub base_url: String,
    pub provider_name: String,
}

pub(crate) async fn get_slot_bindings_inner(pool: &SqlitePool) -> AppResult<Vec<SlotBinding>> {
    let rows = sqlx::query_as::<_, (String, i64, String, Option<String>, String, String, String)>(
        "SELECT ms.slot, ms.model_id, m.model_name, ms.context_size,
                ak.api_key, p.base_url, p.name
         FROM model_slots ms
         JOIN models m ON ms.model_id = m.id
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         ORDER BY ms.slot",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(slot, model_id, model_name, context_size, api_key, base_url, provider_name)| {
            SlotBinding {
                slot,
                model_id,
                model_name,
                context_size,
                api_key,
                base_url,
                provider_name,
            }
        })
        .collect())
}

pub(crate) async fn bind_slot_inner(
    pool: &SqlitePool,
    slot: &str,
    model_id: i64,
) -> AppResult<SlotBinding> {
    let row = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT m.model_name, ak.api_key, p.base_url, p.name
         FROM models m
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE m.id = ?",
    )
    .bind(model_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Custom(format!("MODEL_NOT_FOUND:{}", model_id)))?;

    let (model_name, api_key, base_url, provider_name) = row;

    sqlx::query(
        "INSERT INTO model_slots (slot, model_id, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(slot) DO UPDATE SET model_id = excluded.model_id, updated_at = datetime('now')",
    )
    .bind(slot)
    .bind(model_id)
    .execute(pool)
    .await?;

    Ok(SlotBinding {
        slot: slot.to_string(),
        model_id,
        model_name,
        context_size: None,
        api_key,
        base_url,
        provider_name,
    })
}

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

pub(crate) fn write_slot_to_settings_at(
    slot: &str,
    binding: &SlotBinding,
    settings_path: &Path,
) -> AppResult<()> {
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

    env_obj.insert(
        "ANTHROPIC_BASE_URL".to_string(),
        serde_json::Value::String(binding.base_url.clone()),
    );
    env_obj.insert(
        "ANTHROPIC_AUTH_TOKEN".to_string(),
        serde_json::Value::String(binding.api_key.clone()),
    );

    let env_key = match slot {
        "opus" => "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "sonnet" => "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "haiku" => "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        _ => "ANTHROPIC_MODEL",
    };
    env_obj.insert(
        env_key.to_string(),
        serde_json::Value::String(binding.model_name.clone()),
    );

    let content = serde_json::to_string_pretty(&settings)?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(settings_path, content)?;
    Ok(())
}

pub(crate) async fn set_current_model_at(
    pool: &SqlitePool,
    slot: &str,
    context_size: Option<&str>,
    settings_path: &Path,
) -> AppResult<()> {
    let row = sqlx::query_as::<_, (String, Option<String>, String, String)>(
        "SELECT m.model_name, ms.context_size, ak.api_key, p.base_url
         FROM model_slots ms
         JOIN models m ON ms.model_id = m.id
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE ms.slot = ?",
    )
    .bind(slot)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Custom(format!("SLOT_NOT_BOUND:{}", slot)))?;

    let (_model_name, _slot_ctx, api_key, base_url) = row;

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

    let env = settings
        .as_object_mut()
        .unwrap()
        .entry("env")
        .or_insert_with(|| serde_json::json!({}));

    let env_obj = env.as_object_mut().unwrap();
    env_obj.insert(
        "ANTHROPIC_BASE_URL".to_string(),
        serde_json::Value::String(base_url),
    );
    env_obj.insert(
        "ANTHROPIC_AUTH_TOKEN".to_string(),
        serde_json::Value::String(api_key),
    );

    let content = serde_json::to_string_pretty(&settings)?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(settings_path, content)?;
    Ok(())
}

fn get_global_settings_path() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".claude").join("settings.json")
}

#[tauri::command]
pub async fn get_slot_bindings(pool: State<'_, SqlitePool>) -> AppResult<Vec<SlotBinding>> {
    get_slot_bindings_inner(pool.inner()).await
}

#[tauri::command]
pub async fn bind_slot(pool: State<'_, SqlitePool>, slot: String, model_id: i64) -> AppResult<()> {
    let binding = bind_slot_inner(pool.inner(), &slot, model_id).await?;
    write_slot_to_settings_at(&slot, &binding, &get_global_settings_path())?;
    Ok(())
}

#[tauri::command]
pub async fn unbind_slot(pool: State<'_, SqlitePool>, slot: String) -> AppResult<()> {
    unbind_slot_inner(pool.inner(), &slot).await
}

#[tauri::command]
pub async fn set_current_model(
    pool: State<'_, SqlitePool>,
    slot: String,
    context_size: Option<String>,
) -> AppResult<()> {
    set_current_model_at(pool.inner(), &slot, context_size.as_deref(), &get_global_settings_path()).await
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

    async fn insert_full_model(
        pool: &SqlitePool,
        provider_name: &str,
        base_url: &str,
        api_key: &str,
        model_name: &str,
    ) -> i64 {
        let pid = sqlx::query("INSERT INTO providers (name, base_url) VALUES (?, ?)")
            .bind(provider_name)
            .bind(base_url)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid();
        let ak_id = sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?, ?, ?)")
            .bind(pid)
            .bind(format!("{} Key", provider_name))
            .bind(api_key)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid();
        sqlx::query("INSERT INTO models (api_key_id, model_name) VALUES (?, ?)")
            .bind(ak_id)
            .bind(model_name)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid()
    }

    #[tokio::test]
    async fn test_get_slot_bindings_empty() {
        let pool = setup_test_db().await;
        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert!(bindings.is_empty());
    }

    #[tokio::test]
    async fn test_bind_slot_returns_binding() {
        let pool = setup_test_db().await;
        let mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
        ).await;

        let binding = bind_slot_inner(&pool, "opus", mid).await.unwrap();
        assert_eq!(binding.slot, "opus");
        assert_eq!(binding.model_id, mid);
        assert_eq!(binding.model_name, "claude-opus-4-6");
        assert_eq!(binding.base_url, "https://api.anthropic.com");
        assert_eq!(binding.api_key, "sk-ant-aaa");
        assert_eq!(binding.provider_name, "Anthropic");
    }

    #[tokio::test]
    async fn test_bind_slot_upsert() {
        let pool = setup_test_db().await;
        let mid_a = insert_full_model(
            &pool, "A", "https://a.com", "key-a-12345678", "model-a",
        ).await;
        let mid_b = insert_full_model(
            &pool, "B", "https://b.com", "key-b-12345678", "model-b",
        ).await;

        bind_slot_inner(&pool, "opus", mid_a).await.unwrap();
        bind_slot_inner(&pool, "opus", mid_b).await.unwrap();

        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert_eq!(bindings.len(), 1);
        assert_eq!(bindings[0].model_name, "model-b");
    }

    #[tokio::test]
    async fn test_get_slot_bindings_multiple() {
        let pool = setup_test_db().await;
        let opus_mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
        ).await;
        let sonnet_mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-bbb", "claude-sonnet-4-6",
        ).await;

        bind_slot_inner(&pool, "opus", opus_mid).await.unwrap();
        bind_slot_inner(&pool, "sonnet", sonnet_mid).await.unwrap();

        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert_eq!(bindings.len(), 2);
    }

    #[tokio::test]
    async fn test_unbind_slot() {
        let pool = setup_test_db().await;
        let mid = insert_full_model(
            &pool, "Test", "https://test.com", "key-12345678", "model",
        ).await;

        bind_slot_inner(&pool, "opus", mid).await.unwrap();
        unbind_slot_inner(&pool, "opus").await.unwrap();

        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert!(bindings.is_empty());
    }

    #[tokio::test]
    async fn test_unbind_nonexistent_slot() {
        let pool = setup_test_db().await;
        let result = unbind_slot_inner(&pool, "nonexistent").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("SLOT_UNBOUND:nonexistent"));
    }

    #[tokio::test]
    async fn test_write_slot_to_settings() {
        let pool = setup_test_db().await;
        let mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
        ).await;
        let binding = bind_slot_inner(&pool, "opus", mid).await.unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        write_slot_to_settings_at("opus", &binding, &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        let env = settings.get("env").unwrap();

        assert_eq!(env["ANTHROPIC_DEFAULT_OPUS_MODEL"], "claude-opus-4-6");
        assert_eq!(env["ANTHROPIC_BASE_URL"], "https://api.anthropic.com");
        assert_eq!(env["ANTHROPIC_AUTH_TOKEN"], "sk-ant-aaa");
    }

    #[tokio::test]
    async fn test_set_current_model_updates_credentials() {
        let pool = setup_test_db().await;
        let opus_mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
        ).await;
        let sonnet_mid = insert_full_model(
            &pool, "DeepSeek", "https://api.deepseek.com", "ds-bbb", "deepseek-v3",
        ).await;

        bind_slot_inner(&pool, "opus", opus_mid).await.unwrap();
        bind_slot_inner(&pool, "sonnet", sonnet_mid).await.unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        set_current_model_at(&pool, "opus", None, &settings_path).await.unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(settings["model"], "opus");
        assert_eq!(settings["env"]["ANTHROPIC_BASE_URL"], "https://api.anthropic.com");
        assert_eq!(settings["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-ant-aaa");

        set_current_model_at(&pool, "sonnet", Some("1m"), &settings_path).await.unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(settings["model"], "sonnet[1m]");
        assert_eq!(settings["env"]["ANTHROPIC_BASE_URL"], "https://api.deepseek.com");
        assert_eq!(settings["env"]["ANTHROPIC_AUTH_TOKEN"], "ds-bbb");
    }

    #[tokio::test]
    async fn test_set_current_model_unbound_slot() {
        let pool = setup_test_db().await;
        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        let result = set_current_model_at(&pool, "opus", None, &settings_path).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("SLOT_NOT_BOUND:opus"));
    }

    #[tokio::test]
    async fn test_cascade_delete_provider() {
        let pool = setup_test_db().await;
        let mid = insert_full_model(
            &pool, "ToDelete", "https://del.com", "del-key-12345678", "model",
        ).await;
        bind_slot_inner(&pool, "opus", mid).await.unwrap();

        sqlx::query("DELETE FROM providers")
            .execute(&pool)
            .await
            .unwrap();

        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert!(bindings.is_empty());
    }
}
