use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppResult;

#[tauri::command]
pub async fn get_preference(pool: State<'_, SqlitePool>, key: String) -> AppResult<Option<String>> {
    log_command!("get_preference", {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT value FROM preferences WHERE key = ?")
                .bind(&key)
                .fetch_optional(pool.inner())
                .await?;
        Ok(row.map(|r| r.0))
    })
}

#[tauri::command]
pub async fn set_preference(pool: State<'_, SqlitePool>, key: String, value: String) -> AppResult<()> {
    log_command!("set_preference", {
        sqlx::query(
            "INSERT INTO preferences (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(&key)
        .bind(&value)
        .execute(pool.inner())
        .await?;
        tracing::info!(key = %key, "preference set");
        Ok(())
    })
}
