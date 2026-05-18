use axum::extract::{Path, State};
use axum::Json;
use sqlx::SqlitePool;

use crate::error::{AppError, ResDTO};
use crate::model;

/// GET /api/tools
pub async fn list_software(
    State(pool): State<SqlitePool>,
) -> Result<Json<ResDTO<Vec<model::SoftwareListItem>>>, AppError> {
    let list = model::list_all_software(&pool).await?;
    tracing::debug!(count = list.len(), "list software");
    Ok(Json(ResDTO::ok(list)))
}

/// GET /api/tools/download/{id}
pub async fn download_by_id(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<Json<ResDTO<serde_json::Value>>, AppError> {
    tracing::debug!(version_id = id, "download by id");
    let version = model::get_version_by_id(&pool, id).await?;
    Ok(Json(ResDTO::ok(serde_json::json!({
        "url": version.key,
    }))))
}

/// GET /api/tools/download-latest/{name}
pub async fn download_latest(
    State(pool): State<SqlitePool>,
    Path(name): Path<String>,
) -> Result<Json<ResDTO<serde_json::Value>>, AppError> {
    tracing::info!(name = %name, "download latest");
    let (software, version) = model::get_latest_version(&pool, &name).await?;
    let display_name = software.display_name.unwrap_or(software.name);
    Ok(Json(ResDTO::ok(serde_json::json!({
        "url": version.key,
        "version": version.sequence,
        "size": version.size,
        "displayName": display_name,
    }))))
}
