use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppResult;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Provider {
    pub id: i64,
    pub name: String,
    pub base_url: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProviderInput {
    pub name: String,
    pub base_url: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProviderInput {
    pub name: Option<String>,
    pub base_url: Option<String>,
    pub notes: Option<String>,
}

pub async fn add_provider_inner(
    pool: &SqlitePool,
    input: CreateProviderInput,
) -> AppResult<Provider> {
    let notes = input.notes.as_deref().filter(|s| !s.is_empty());

    let provider = sqlx::query_as::<_, Provider>(
        "INSERT INTO providers (name, base_url, notes) VALUES (?, ?, ?) RETURNING *",
    )
    .bind(&input.name)
    .bind(&input.base_url)
    .bind(notes)
    .fetch_one(pool)
    .await?;
    Ok(provider)
}

pub(crate) async fn list_providers_inner(pool: &SqlitePool) -> AppResult<Vec<Provider>> {
    let providers = sqlx::query_as::<_, Provider>(
        "SELECT * FROM providers ORDER BY name ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(providers)
}

pub async fn update_provider_inner(
    pool: &SqlitePool,
    id: i64,
    input: UpdateProviderInput,
) -> AppResult<()> {
    let mut query = String::from("UPDATE providers SET updated_at = datetime('now')");
    let mut binds: Vec<String> = vec![];

    if let Some(ref name) = input.name {
        query.push_str(", name = ?");
        binds.push(name.clone());
    }
    if let Some(ref base_url) = input.base_url {
        query.push_str(", base_url = ?");
        binds.push(base_url.clone());
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

pub async fn update_provider_at(
    pool: &SqlitePool,
    id: i64,
    input: UpdateProviderInput,
    settings_path: &std::path::Path,
) -> AppResult<()> {
    update_provider_inner(pool, id, input).await?;
    let bindings: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT ms.slot, m.model_name, ak.api_key, p.base_url
         FROM model_slots ms
         JOIN models m ON ms.model_id = m.id
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE p.id = ?"
    ).bind(id).fetch_all(pool).await?;
    for (slot, model_name, api_key, base_url) in bindings {
        crate::claude_settings::write_slot_env(settings_path, &slot, &base_url, &api_key, &model_name).await?;
    }
    Ok(())
}

pub async fn delete_provider_inner(pool: &SqlitePool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM providers WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_provider_at(
    pool: &SqlitePool,
    id: i64,
    settings_path: &std::path::Path,
) -> AppResult<()> {
    // 收集受影响 (base_url, api_key)
    let creds: Vec<(String, String)> = sqlx::query_as(
        "SELECT p.base_url, ak.api_key
         FROM providers p JOIN api_keys ak ON ak.provider_id = p.id
         WHERE p.id = ?",
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    sqlx::query("DELETE FROM providers WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    for (base_url, api_key) in &creds {
        crate::claude_settings::purge_token(settings_path, base_url, api_key).await?;
    }
    tracing::info!(id, affected = creds.len(), "provider deleted, settings purged");
    Ok(())
}

#[tauri::command]
pub async fn add_provider(
    pool: State<'_, SqlitePool>,
    input: CreateProviderInput,
) -> AppResult<Provider> {
    log_command!("add_provider", {
        let provider = add_provider_inner(pool.inner(), input).await?;
        tracing::info!(id = provider.id, name = %provider.name, "provider created");
        Ok(provider)
    })
}

#[tauri::command]
pub async fn list_providers(pool: State<'_, SqlitePool>) -> AppResult<Vec<Provider>> {
    log_read_command!("list_providers", {
        list_providers_inner(pool.inner()).await
    })
}

#[tauri::command]
pub async fn update_provider(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateProviderInput,
) -> AppResult<()> {
    log_command!("update_provider", {
        let path = crate::claude_settings::global_settings_path();
        update_provider_at(pool.inner(), id, input, &path).await?;
        tracing::info!(id, "provider updated");
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_provider(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    log_command!("delete_provider", {
        let path = crate::claude_settings::global_settings_path();
        delete_provider_at(pool.inner(), id, &path).await?;
        tracing::info!(id, "provider deleted");
        Ok(())
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
        pool
    }

    #[tokio::test]
    async fn test_add_provider() {
        let pool = setup_test_db().await;
        let input = CreateProviderInput {
            name: "Anthropic".to_string(),
            base_url: "https://api.anthropic.com".to_string(),
            notes: Some("Official API".to_string()),
        };
        let p = add_provider_inner(&pool, input).await.unwrap();
        assert_eq!(p.name, "Anthropic");
        assert_eq!(p.base_url, "https://api.anthropic.com");
        assert_eq!(p.notes.as_deref(), Some("Official API"));
        assert!(p.id > 0);
    }

    #[tokio::test]
    async fn test_list_providers_empty() {
        let pool = setup_test_db().await;
        let list = list_providers_inner(&pool).await.unwrap();
        assert!(list.is_empty());
    }

    #[tokio::test]
    async fn test_list_providers_ordered() {
        let pool = setup_test_db().await;
        add_provider_inner(
            &pool,
            CreateProviderInput {
                name: "B Provider".to_string(),
                base_url: "https://b.com".to_string(),
                notes: None,
            },
        )
        .await
        .unwrap();
        add_provider_inner(
            &pool,
            CreateProviderInput {
                name: "A Provider".to_string(),
                base_url: "https://a.com".to_string(),
                notes: None,
            },
        )
        .await
        .unwrap();

        let list = list_providers_inner(&pool).await.unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].name, "A Provider");
        assert_eq!(list[1].name, "B Provider");
    }

    #[tokio::test]
    async fn test_update_provider() {
        let pool = setup_test_db().await;
        let p = add_provider_inner(
            &pool,
            CreateProviderInput {
                name: "Old".to_string(),
                base_url: "https://old.com".to_string(),
                notes: None,
            },
        )
        .await
        .unwrap();

        update_provider_inner(
            &pool,
            p.id,
            UpdateProviderInput {
                name: Some("New".to_string()),
                base_url: Some("https://new.com".to_string()),
                notes: Some("updated".to_string()),
            },
        )
        .await
        .unwrap();

        let list = list_providers_inner(&pool).await.unwrap();
        assert_eq!(list[0].name, "New");
        assert_eq!(list[0].base_url, "https://new.com");
        assert_eq!(list[0].notes.as_deref(), Some("updated"));
    }

    #[tokio::test]
    async fn test_delete_provider() {
        let pool = setup_test_db().await;
        let p = add_provider_inner(
            &pool,
            CreateProviderInput {
                name: "ToDelete".to_string(),
                base_url: "https://del.com".to_string(),
                notes: None,
            },
        )
        .await
        .unwrap();

        delete_provider_inner(&pool, p.id).await.unwrap();
        let list = list_providers_inner(&pool).await.unwrap();
        assert!(list.is_empty());
    }

    #[tokio::test]
    async fn delete_provider_purges_settings_env() {
        let pool = setup_test_db().await;
        sqlx::query(
            "CREATE TABLE api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL,
                name TEXT NOT NULL, api_key TEXT NOT NULL, notes TEXT,
                created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE)"
        ).execute(&pool).await.unwrap();
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT, api_key_id INTEGER NOT NULL,
                model_name TEXT NOT NULL, context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE)"
        ).execute(&pool).await.unwrap();

        let pid = add_provider_inner(&pool, CreateProviderInput {
            name: "A".into(), base_url: "https://a.com".into(), notes: None
        }).await.unwrap().id;
        let ak_id = sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?,?,?)")
            .bind(pid).bind("k").bind("sk-xx12345678").execute(&pool).await.unwrap().last_insert_rowid();
        sqlx::query("INSERT INTO models (api_key_id, model_name) VALUES (?,?)")
            .bind(ak_id).bind("m").execute(&pool).await.unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");
        crate::claude_settings::write_slot_env(&settings_path, "opus", "https://a.com", "sk-xx12345678", "m")
            .await.unwrap();

        delete_provider_at(&pool, pid, &settings_path).await.unwrap();

        let v: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
        assert!(v["env"].get("ANTHROPIC_BASE_URL").is_none());
        assert!(v["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
    }

    #[tokio::test]
    async fn update_provider_refreshes_env_for_bound_slots() {
        let pool = setup_test_db().await;
        sqlx::query(
            "CREATE TABLE api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL,
                name TEXT NOT NULL, api_key TEXT NOT NULL, notes TEXT,
                created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE)"
        ).execute(&pool).await.unwrap();
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT, api_key_id INTEGER NOT NULL,
                model_name TEXT NOT NULL, context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE)"
        ).execute(&pool).await.unwrap();
        sqlx::query(
            "CREATE TABLE model_slots (
                slot TEXT PRIMARY KEY, model_id INTEGER NOT NULL, context_size TEXT,
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE)"
        ).execute(&pool).await.unwrap();

        let pid = add_provider_inner(&pool, CreateProviderInput {
            name: "A".into(), base_url: "https://old.com".into(), notes: None
        }).await.unwrap().id;
        let ak_id = sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?,?,?)")
            .bind(pid).bind("k").bind("sk-xx12345678").execute(&pool).await.unwrap().last_insert_rowid();
        let mid = sqlx::query("INSERT INTO models (api_key_id, model_name) VALUES (?,?)")
            .bind(ak_id).bind("m").execute(&pool).await.unwrap().last_insert_rowid();
        sqlx::query("INSERT INTO model_slots (slot, model_id) VALUES ('opus', ?)")
            .bind(mid).execute(&pool).await.unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");
        crate::claude_settings::write_slot_env(&settings_path, "opus", "https://old.com", "sk-xx12345678", "m")
            .await.unwrap();

        update_provider_at(&pool, pid, UpdateProviderInput {
            name: None,
            base_url: Some("https://new.com".into()),
            notes: None,
        }, &settings_path).await.unwrap();

        let v: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
        assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://new.com");
        assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-xx12345678");
    }
}
