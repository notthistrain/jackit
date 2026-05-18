use axum::extract::State;
use axum::Json;
use sqlx::SqlitePool;

use crate::error::ResDTO;
use crate::model::{self, GithubPublishInput};

/// POST /api/publish/github
pub async fn github(
    State(pool): State<SqlitePool>,
    Json(input): Json<GithubPublishInput>,
) -> Result<Json<ResDTO<serde_json::Value>>, crate::error::AppError> {
    if input.name.is_empty() || input.version.is_empty() || input.download_url.is_empty() {
        return Ok(Json(ResDTO::fail_value(
            "Missing required fields: name, version, downloadUrl",
        )));
    }

    if !input.download_url.starts_with("http://") && !input.download_url.starts_with("https://") {
        return Ok(Json(ResDTO::fail_value(
            "downloadUrl must be a valid HTTP(S) URL",
        )));
    }

    tracing::info!(name = %input.name, version = %input.version, "publish from github");

    let version = model::save_version(&pool, &input).await?;

    Ok(Json(ResDTO::ok(serde_json::json!({
        "key": version.key,
        "sequence": version.sequence,
        "name": input.name,
    }))))
}
