use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use jackserver::{db, test_app};
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

    let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
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
        .body(Body::from(
            r#"{"name":"test","version":"0.1.0","downloadUrl":"https://example.com/t.exe"}"#,
        ))
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
        .body(Body::from(
            r#"{"name":"toolbox","version":"0.1.0","downloadUrl":"https://github.com/test/t.exe"}"#,
        ))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
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
        &axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
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
        &axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
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

// ===== metrics（打点 + 报表） 端到端 =====

fn now_ts() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

async fn body_json(resp: axum::response::Response) -> serde_json::Value {
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

#[tokio::test]
async fn test_track_and_report() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    let ts = now_ts();
    let post_track = move |ip: &str, ua: &str, path: &str| {
        let sig = jackserver::test_sign_track("test-track", "blog", path, ts);
        let body = format!(r#"{{"site":"blog","path":"{path}","ts":{ts},"sig":"{sig}"}}"#);
        Request::builder()
            .method("POST")
            .uri("/api/metrics/track")
            .header("origin", "https://test.local")
            .header("x-forwarded-for", ip)
            .header("user-agent", ua)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body))
            .unwrap()
    };

    // 同 visitor（同 IP+UA）访问 / 两次 + 不同 visitor 访问 /about 一次
    assert_eq!(
        app.clone()
            .oneshot(post_track("1.1.1.1", "Mozilla/5.0", "/"))
            .await
            .unwrap()
            .status(),
        StatusCode::OK
    );
    assert_eq!(
        app.clone()
            .oneshot(post_track("1.1.1.1", "Mozilla/5.0", "/"))
            .await
            .unwrap()
            .status(),
        StatusCode::OK
    );
    assert_eq!(
        app.clone()
            .oneshot(post_track("2.2.2.2", "curl/8.0", "/about"))
            .await
            .unwrap()
            .status(),
        StatusCode::OK
    );

    // 查询 overview -> PV=3, UV=2（无鉴权，仅限流）
    let req = Request::builder()
        .uri("/api/metrics/overview?site=blog&from=2000-01-01&to=2999-01-01")
        .body(Body::empty())
        .unwrap();
    let v = body_json(app.clone().oneshot(req).await.unwrap()).await;
    assert_eq!(v["code"], 0);
    let pv: i64 = v["data"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["pv"].as_i64().unwrap())
        .sum();
    let uv: i64 = v["data"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["uv"].as_i64().unwrap())
        .sum();
    assert_eq!(pv, 3);
    assert_eq!(uv, 2);

    // paths Top-N
    let req = Request::builder()
        .uri("/api/metrics/paths?site=blog&from=2000-01-01&to=2999-01-01")
        .body(Body::empty())
        .unwrap();
    let v = body_json(app.oneshot(req).await.unwrap()).await;
    assert_eq!(v["data"][0]["key"], "/");
    assert_eq!(v["data"][0]["count"], 2);
}

#[tokio::test]
async fn test_track_rejects_bad_signature_origin_and_stale_ts() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);
    let ts = now_ts();

    // 错误签名 -> 400
    let req = Request::builder()
        .method("POST")
        .uri("/api/metrics/track")
        .header("origin", "https://test.local")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(format!(
            r#"{{"site":"blog","path":"/","ts":{ts},"sig":"deadbeef"}}"#
        )))
        .unwrap();
    assert_eq!(
        app.clone().oneshot(req).await.unwrap().status(),
        StatusCode::BAD_REQUEST
    );

    // 非白名单 origin -> 400
    let sig = jackserver::test_sign_track("test-track", "blog", "/", ts);
    let req = Request::builder()
        .method("POST")
        .uri("/api/metrics/track")
        .header("origin", "https://evil.example.com")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(format!(
            r#"{{"site":"blog","path":"/","ts":{ts},"sig":"{sig}"}}"#
        )))
        .unwrap();
    assert_eq!(
        app.clone().oneshot(req).await.unwrap().status(),
        StatusCode::BAD_REQUEST
    );

    // 过期 ts -> 400
    let old_ts = ts - 9999;
    let sig = jackserver::test_sign_track("test-track", "blog", "/", old_ts);
    let req = Request::builder()
        .method("POST")
        .uri("/api/metrics/track")
        .header("origin", "https://test.local")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(format!(
            r#"{{"site":"blog","path":"/","ts":{old_ts},"sig":"{sig}"}}"#
        )))
        .unwrap();
    assert_eq!(
        app.oneshot(req).await.unwrap().status(),
        StatusCode::BAD_REQUEST
    );
}

#[tokio::test]
async fn test_report_rate_limit() {
    // 报表查询无鉴权，但按 IP 限流（默认 60/分钟）。此处直接验证可正常查询且返回数据。
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    // 先打点一条数据
    let ts = now_ts();
    let sig = jackserver::test_sign_track("test-track", "blog", "/", ts);
    let req = Request::builder()
        .method("POST")
        .uri("/api/metrics/track")
        .header("origin", "https://test.local")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(format!(
            r#"{{"site":"blog","path":"/","ts":{ts},"sig":"{sig}"}}"#
        )))
        .unwrap();
    assert_eq!(
        app.clone().oneshot(req).await.unwrap().status(),
        StatusCode::OK
    );

    // 无需任何鉴权头即可查询
    let req = Request::builder()
        .uri("/api/metrics/overview?site=blog&from=2000-01-01&to=2999-01-01")
        .body(Body::empty())
        .unwrap();
    assert_eq!(app.oneshot(req).await.unwrap().status(), StatusCode::OK);
}
