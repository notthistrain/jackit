use axum::extract::{Extension, Query, State};
use axum::Json;
use sqlx::SqlitePool;

use crate::error::{AppError, ResDTO};
use crate::model::{self, ConsumeInput, MessageData, MessageListQuery, MessageListPage};

/// POST /api/messages/submit —— 用户提交留言（已过 check_message 中间件校验）。
///
/// 从中间件注入的 [`MessageData`] 取站点/路径/昵称/内容/IP/UA 后落库。
pub async fn submit(
    State(pool): State<SqlitePool>,
    Extension(data): Extension<MessageData>,
) -> Result<Json<ResDTO<serde_json::Value>>, AppError> {
    let MessageData { input, ip, ua } = data;

    let id = model::insert_message(
        &pool,
        &input.site,
        input.path.as_deref(),
        &input.nickname,
        &input.content,
        ip.as_deref(),
        ua.as_deref(),
    )
    .await?;

    tracing::debug!(id, site = %input.site, "message recorded");
    Ok(Json(ResDTO::ok(serde_json::json!({ "id": id }))))
}

/// GET /api/messages/list —— 按站点分页查询留言（需 admin token，仅站长可查）。
///
/// `consumed` 取值 "0"（默认，待处理）/ "1"（已消费）/ "all"（全部）。
/// 默认 page=1, size=20，size 上限 100。
pub async fn list(
    State(pool): State<SqlitePool>,
    Query(q): Query<MessageListQuery>,
) -> Result<Json<ResDTO<MessageListPage>>, AppError> {
    let consumed = q.consumed.as_deref().unwrap_or("0");
    if consumed != "0" && consumed != "1" && consumed != "all" {
        return Err(AppError::BadRequest(
            "consumed must be '0', '1' or 'all'".to_string(),
        ));
    }
    let page = q.page.unwrap_or(1).clamp(1, 10_000);
    let size = q.size.unwrap_or(20).clamp(1, 100);
    let rows = model::query_messages(&pool, &q.site, consumed, page, size).await?;
    Ok(Json(ResDTO::ok(rows)))
}

/// POST /api/messages/admin/consume —— 管理员标记留言为已消费（需 admin token）。
///
/// body: `{ "id": <i64> }`。已消费的留言再次消费返回 404。
pub async fn consume(
    State(pool): State<SqlitePool>,
    Json(input): Json<ConsumeInput>,
) -> Result<Json<ResDTO<serde_json::Value>>, AppError> {
    let updated = model::consume_message(&pool, input.id).await?;
    if !updated {
        return Err(AppError::NotFound(format!(
            "Message {} not found or already consumed",
            input.id
        )));
    }
    tracing::info!(id = input.id, "message consumed");
    Ok(Json(ResDTO::ok(serde_json::json!({ "ok": true }))))
}
