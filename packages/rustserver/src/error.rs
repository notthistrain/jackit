use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

/// 统一 API 响应格式，沿用现有 Node.js server 的 ResDTO 风格
#[derive(Debug, Serialize)]
pub struct ResDTO<T: Serialize> {
    pub code: i32,
    pub msg: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T: Serialize> ResDTO<T> {
    pub fn ok(data: T) -> Self {
        Self { code: 0, msg: "ok".to_string(), data: Some(data) }
    }
}

impl ResDTO<()> {
    pub fn fail(msg: impl Into<String>) -> ResDTO<()> {
        ResDTO { code: 1, msg: msg.into(), data: None }
    }
}

/// 应用错误类型
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("{0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };
        let body = ResDTO::<()>::fail(msg);
        (status, axum::Json(body)).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
