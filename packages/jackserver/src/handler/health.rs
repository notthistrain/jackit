use axum::Json;

use crate::error::ResDTO;

/// GET /api/health
pub async fn health() -> Json<ResDTO<serde_json::Value>> {
    Json(ResDTO::ok(serde_json::json!({ "status": "ok" })))
}
