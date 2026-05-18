use jackserver::{db, test_app};
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use tower::ServiceExt;

#[tokio::test]
async fn test_health_endpoint() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    let req = Request::builder()
        .uri("/api/health")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["code"], 0);
    assert_eq!(json["data"]["status"], "ok");
}

#[tokio::test]
async fn test_publish_requires_auth() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    let req = Request::builder()
        .method("POST")
        .uri("/api/publish/github")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(r#"{"name":"test","version":"0.1.0","downloadUrl":"https://example.com/t.exe"}"#))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_publish_with_valid_token() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    let req = Request::builder()
        .method("POST")
        .uri("/api/publish/github")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::from(r#"{"name":"toolbox","version":"0.1.0","downloadUrl":"https://github.com/test/t.exe"}"#))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap()
    ).unwrap();
    assert_eq!(body["code"], 0);
    assert_eq!(body["data"]["name"], "toolbox");
    assert_eq!(body["data"]["sequence"], "0.1.0");
}

#[tokio::test]
async fn test_tools_list_empty() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    let req = Request::builder()
        .uri("/api/tools")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap()
    ).unwrap();
    assert_eq!(body["code"], 0);
    assert_eq!(body["data"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn test_publish_and_query_same_pool() {
    // Use a single pool so both app instances share the same in-memory database
    let pool = db::setup_test_db().await;

    // First app: publish a version
    let app1 = test_app(pool.clone());
    let req = Request::builder()
        .method("POST")
        .uri("/api/publish/github")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::from(r#"{"name":"toolbox","version":"0.1.0","downloadUrl":"https://github.com/test/t.exe","display":"工具箱"}"#))
        .unwrap();
    let resp = app1.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Second app with the SAME pool: query the published data
    let app2 = test_app(pool);

    let req = Request::builder()
        .uri("/api/tools")
        .body(Body::empty())
        .unwrap();
    let resp = app2.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap()
    ).unwrap();
    assert_eq!(body["code"], 0);
    let list = body["data"].as_array().unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0]["name"], "toolbox");
}

#[tokio::test]
async fn test_download_not_found() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    let req = Request::builder()
        .uri("/api/tools/download/999")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}
