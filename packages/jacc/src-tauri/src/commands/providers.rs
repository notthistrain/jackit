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

pub(crate) async fn add_provider_inner(
    pool: &SqlitePool,
    input: CreateProviderInput,
) -> AppResult<Provider> {
    let notes = input.notes.as_deref().filter(|s| !s.is_empty());

    let provider = sqlx::query_as::<_, Provider>(
        "INSERT INTO providers (name, base_url, notes) VALUES (?, ?, ?) RETURNING *",
    )
    .bind(&input.name)
    .bind(&input.base_url)
    .bind(&notes)
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

pub(crate) async fn update_provider_inner(
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

pub(crate) async fn delete_provider_inner(pool: &SqlitePool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM providers WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn add_provider(
    pool: State<'_, SqlitePool>,
    input: CreateProviderInput,
) -> AppResult<Provider> {
    add_provider_inner(pool.inner(), input).await
}

#[tauri::command]
pub async fn list_providers(pool: State<'_, SqlitePool>) -> AppResult<Vec<Provider>> {
    list_providers_inner(pool.inner()).await
}

#[tauri::command]
pub async fn update_provider(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateProviderInput,
) -> AppResult<()> {
    update_provider_inner(pool.inner(), id, input).await
}

#[tauri::command]
pub async fn delete_provider(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    delete_provider_inner(pool.inner(), id).await
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
}
