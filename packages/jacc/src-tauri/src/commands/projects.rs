use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppResult;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Project {
    pub id: i64,
    pub path: String,
    pub name: Option<String>,
    pub last_opened_at: String,
    pub pinned: i32,
}

#[tauri::command]
pub async fn list_projects(pool: State<'_, SqlitePool>) -> AppResult<Vec<Project>> {
    log_command!("list_projects", {
        let projects = sqlx::query_as::<_, Project>(
            "SELECT id, path, name, last_opened_at, pinned FROM projects
             ORDER BY pinned DESC, last_opened_at DESC",
        )
        .fetch_all(pool.inner())
        .await?;
        Ok(projects)
    })
}

#[tauri::command]
pub async fn add_project(
    pool: State<'_, SqlitePool>,
    path: String,
    name: Option<String>,
) -> AppResult<()> {
    log_command!("add_project", {
        let display_name = name.unwrap_or_else(|| {
            std::path::Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone())
        });

        sqlx::query(
            "INSERT INTO projects (path, name) VALUES (?, ?)
             ON CONFLICT(path) DO UPDATE SET last_opened_at = datetime('now'), name = excluded.name",
        )
        .bind(&path)
        .bind(&display_name)
        .execute(pool.inner())
        .await?;
        tracing::info!(path = %path, "project added");
        Ok(())
    })
}

#[tauri::command]
pub async fn open_project(pool: State<'_, SqlitePool>, path: String) -> AppResult<()> {
    log_command!("open_project", {
        sqlx::query("UPDATE projects SET last_opened_at = datetime('now') WHERE path = ?")
            .bind(&path)
            .execute(pool.inner())
            .await?;
        tracing::info!(path = %path, "project opened");
        Ok(())
    })
}

#[tauri::command]
pub async fn remove_project(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    log_command!("remove_project", {
        sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id)
            .execute(pool.inner())
            .await?;
        tracing::info!(id, "project removed");
        Ok(())
    })
}

#[tauri::command]
pub async fn pin_project(pool: State<'_, SqlitePool>, id: i64, pinned: bool) -> AppResult<()> {
    log_command!("pin_project", {
        sqlx::query("UPDATE projects SET pinned = ? WHERE id = ?")
            .bind(pinned as i32)
            .bind(id)
            .execute(pool.inner())
            .await?;
        tracing::info!(id, pinned, "project pin toggled");
        Ok(())
    })
}
