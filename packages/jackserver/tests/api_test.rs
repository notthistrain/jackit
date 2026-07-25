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

// ===== messages（留言提交 + 查询 + 消费） 端到端 =====
//
// 签名规则与 track 一致：sig = HMAC-SHA256(secret, "{site}|{path}|{ts}")。
// 测试中直接复用 `test_sign_track` 计算（path 缺失时传空串）。

fn message_body(site: &str, path: Option<&str>, nickname: &str, content: &str, ts: i64) -> String {
    let sig = jackserver::test_sign_track("test-track", site, path.unwrap_or(""), ts);
    let path_field = match path {
        Some(p) => format!(r#","path":"{p}""#),
        None => String::new(),
    };
    format!(
        r#"{{"site":"{site}"{path_field},"nickname":"{nickname}","content":"{content}","ts":{ts},"sig":"{sig}"}}"#
    )
}

#[tokio::test]
async fn test_message_submit_and_list_default_pending() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);
    let ts = now_ts();

    // blog 站点提交 2 条，shop 站点提交 1 条
    for (site, nick, content) in [
        ("blog", "alice", "好文章"),
        ("blog", "bob", "有个 bug"),
        ("shop", "carol", "什么时候补货"),
    ] {
        let req = Request::builder()
            .method("POST")
            .uri("/api/messages/submit")
            .header("origin", "https://test.local")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(message_body(site, Some("/"), nick, content, ts)))
            .unwrap();
        assert_eq!(
            app.clone().oneshot(req).await.unwrap().status(),
            StatusCode::OK
        );
    }

    // 默认查询 blog：只看待处理（consumed=0），应返回 2 条
    let req = Request::builder()
        .uri("/api/messages/list?site=blog")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::empty())
        .unwrap();
    let v = body_json(app.clone().oneshot(req).await.unwrap()).await;
    assert_eq!(v["code"], 0);
    assert_eq!(v["data"]["total"], 2);
    assert_eq!(v["data"]["items"].as_array().unwrap().len(), 2);

    // shop 站点独立隔离：1 条
    let req = Request::builder()
        .uri("/api/messages/list?site=shop")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::empty())
        .unwrap();
    let v = body_json(app.clone().oneshot(req).await.unwrap()).await;
    assert_eq!(v["data"]["total"], 1);
    assert_eq!(v["data"]["items"][0]["nickname"], "carol");
}

#[tokio::test]
async fn test_message_submit_rejects_bad_signature_origin_and_stale_ts() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);
    let ts = now_ts();

    // 错误签名 -> 400
    let req = Request::builder()
        .method("POST")
        .uri("/api/messages/submit")
        .header("origin", "https://test.local")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(format!(
            r#"{{"site":"blog","nickname":"x","content":"hi","ts":{ts},"sig":"deadbeef"}}"#
        )))
        .unwrap();
    assert_eq!(
        app.clone().oneshot(req).await.unwrap().status(),
        StatusCode::BAD_REQUEST
    );

    // 非白名单 origin -> 400
    let req = Request::builder()
        .method("POST")
        .uri("/api/messages/submit")
        .header("origin", "https://evil.example.com")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(message_body("blog", None, "x", "hi", ts)))
        .unwrap();
    assert_eq!(
        app.clone().oneshot(req).await.unwrap().status(),
        StatusCode::BAD_REQUEST
    );

    // 过期 ts -> 400
    let old_ts = ts - 9999;
    let req = Request::builder()
        .method("POST")
        .uri("/api/messages/submit")
        .header("origin", "https://test.local")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(message_body("blog", None, "x", "hi", old_ts)))
        .unwrap();
    assert_eq!(
        app.oneshot(req).await.unwrap().status(),
        StatusCode::BAD_REQUEST
    );
}

#[tokio::test]
async fn test_message_consume_flow() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);
    let ts = now_ts();

    // 提交一条
    let req = Request::builder()
        .method("POST")
        .uri("/api/messages/submit")
        .header("origin", "https://test.local")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(message_body("blog", None, "alice", "hello", ts)))
        .unwrap();
    let v = body_json(app.clone().oneshot(req).await.unwrap()).await;
    let id = v["data"]["id"].as_i64().unwrap();

    // 默认 list 应包含此条
    let req = Request::builder()
        .uri("/api/messages/list?site=blog")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::empty())
        .unwrap();
    let v = body_json(app.clone().oneshot(req).await.unwrap()).await;
    assert_eq!(v["data"]["total"], 1);
    assert_eq!(v["data"]["items"][0]["consumed"], false);

    // 无 token 消费 -> 401
    let req = Request::builder()
        .method("POST")
        .uri("/api/messages/admin/consume")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(format!(r#"{{"id":{id}}}"#)))
        .unwrap();
    assert_eq!(
        app.clone().oneshot(req).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );

    // 用 admin token 消费 -> 200
    let req = Request::builder()
        .method("POST")
        .uri("/api/messages/admin/consume")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(format!(r#"{{"id":{id}}}"#)))
        .unwrap();
    assert_eq!(
        app.clone().oneshot(req).await.unwrap().status(),
        StatusCode::OK
    );

    // 默认 list 应为空（已消费）
    let req = Request::builder()
        .uri("/api/messages/list?site=blog")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::empty())
        .unwrap();
    let v = body_json(app.clone().oneshot(req).await.unwrap()).await;
    assert_eq!(v["data"]["total"], 0);

    // consumed=1 应能看到
    let req = Request::builder()
        .uri("/api/messages/list?site=blog&consumed=1")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::empty())
        .unwrap();
    let v = body_json(app.clone().oneshot(req).await.unwrap()).await;
    assert_eq!(v["data"]["total"], 1);
    assert_eq!(v["data"]["items"][0]["consumed"], true);

    // consumed=all 应能看到
    let req = Request::builder()
        .uri("/api/messages/list?site=blog&consumed=all")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::empty())
        .unwrap();
    let v = body_json(app.clone().oneshot(req).await.unwrap()).await;
    assert_eq!(v["data"]["total"], 1);

    // 重复消费 -> 404
    let req = Request::builder()
        .method("POST")
        .uri("/api/messages/admin/consume")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(format!(r#"{{"id":{id}}}"#)))
        .unwrap();
    assert_eq!(
        app.oneshot(req).await.unwrap().status(),
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn test_message_list_requires_admin_token() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    // 无 token -> 401
    let req = Request::builder()
        .uri("/api/messages/list?site=blog")
        .body(Body::empty())
        .unwrap();
    assert_eq!(
        app.clone().oneshot(req).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );

    // 错误 token -> 401
    let req = Request::builder()
        .uri("/api/messages/list?site=blog")
        .header(header::AUTHORIZATION, "Bearer wrong-token")
        .body(Body::empty())
        .unwrap();
    assert_eq!(
        app.clone().oneshot(req).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );

    // 正确 token -> 200（空列表也算通过）
    let req = Request::builder()
        .uri("/api/messages/list?site=blog")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::empty())
        .unwrap();
    assert_eq!(
        app.oneshot(req).await.unwrap().status(),
        StatusCode::OK
    );
}

#[tokio::test]
async fn test_message_list_rejects_invalid_consumed_param() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    // 需先通过 admin token 鉴权，才能测到 consumed 参数校验
    let req = Request::builder()
        .uri("/api/messages/list?site=blog&consumed=invalid")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::empty())
        .unwrap();
    assert_eq!(
        app.oneshot(req).await.unwrap().status(),
        StatusCode::BAD_REQUEST
    );
}
