//! 端到端：add provider → key → model → bind → 改 token → 验 env 已刷 → 删 provider → 验 env 清空
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

async fn setup() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await.unwrap();
    sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, base_url TEXT NOT NULL,
        notes TEXT, created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')))").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL,
        name TEXT NOT NULL, api_key TEXT NOT NULL, notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE)")
        .execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE models (
        id INTEGER PRIMARY KEY AUTOINCREMENT, api_key_id INTEGER NOT NULL,
        model_name TEXT NOT NULL, context_size TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE)")
        .execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE model_slots (
        slot TEXT PRIMARY KEY, model_id INTEGER NOT NULL, context_size TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE)")
        .execute(&pool).await.unwrap();
    pool
}

#[tokio::test]
async fn full_lifecycle_keeps_settings_in_sync() {
    let pool = setup().await;
    let dir = tempfile::tempdir().unwrap();
    let settings_path = dir.path().join("settings.json");

    // 1. add provider/key/model
    let p = jacc_lib::commands::providers::add_provider_inner(
        &pool, jacc_lib::commands::providers::CreateProviderInput {
            name: "A".into(), base_url: "https://a.com".into(), notes: None,
        }).await.unwrap();
    let ak = jacc_lib::commands::api_keys::add_api_key_inner(
        &pool, jacc_lib::commands::api_keys::CreateApiKeyInput {
            provider_id: p.id, name: "k".into(), api_key: "sk-xx12345678".into(), notes: None,
        }).await.unwrap();
    let m = jacc_lib::commands::models::add_model_inner(
        &pool, jacc_lib::commands::models::CreateModelInput {
            api_key_id: ak.id, model_name: "m".into(), context_size: None,
        }).await.unwrap();

    // 2. bind opus
    jacc_lib::commands::slots::bind_slot_at(&pool, "opus", m.id, &settings_path).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://a.com");
    assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-xx12345678");

    // 3. 改 token
    jacc_lib::commands::api_keys::update_api_key_at(
        &pool, ak.id,
        jacc_lib::commands::api_keys::UpdateApiKeyInput {
            name: None, api_key: Some("sk-NEW12345678".into()), notes: None,
        }, &settings_path).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-NEW12345678");

    // 4. 删 provider
    jacc_lib::commands::providers::delete_provider_at(&pool, p.id, &settings_path).await.unwrap();
    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert!(v["env"].get("ANTHROPIC_BASE_URL").is_none());
    assert!(v["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
}
