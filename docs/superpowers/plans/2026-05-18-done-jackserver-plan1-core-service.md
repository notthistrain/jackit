# rustserver 核心服务实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建 rustserver 核心服务——axum 纯 API 服务，提供软件包信息的 publish（写入）和 tools（查询）接口，SQLite 存储。

**架构：** axum + tokio + sqlx(SQLite) + TOML 配置。Nginx 反代，监听 localhost:7001。统一 ResDTO JSON 响应格式。

**技术栈：** Rust, axum 0.8, tokio 1, sqlx 0.8 (sqlite), serde + toml, tracing, thiserror

**设计文档：** `docs/superpowers/specs/2026-05-18-rustserver-design.md`

**参考项目：** `packages/jacc/src-tauri/` — 同 monorepo 中的 Rust 项目，复用依赖版本和错误处理模式

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/rustserver/Cargo.toml` | 项目依赖 |
| `packages/rustserver/config.example.toml` | 配置文件模板 |
| `packages/rustserver/src/main.rs` | 启动入口、graceful shutdown、路由注册 |
| `packages/rustserver/src/config.rs` | TOML 配置结构体 + 加载 |
| `packages/rustserver/src/db.rs` | SQLite 连接池 + schema 初始化 |
| `packages/rustserver/src/error.rs` | 统一错误类型 + ResDTO 响应格式 |
| `packages/rustserver/src/model.rs` | Software / SoftwareVersion 结构体 + CRUD |
| `packages/rustserver/src/middleware/mod.rs` | middleware 模块声明 |
| `packages/rustserver/src/middleware/auth.rs` | Bearer token 校验 |
| `packages/rustserver/src/middleware/log.rs` | 请求日志 |
| `packages/rustserver/src/handler/mod.rs` | handler 模块声明 |
| `packages/rustserver/src/handler/publish.rs` | POST /api/publish/github |
| `packages/rustserver/src/handler/tools.rs` | GET /api/tools, /download/:id, /download-latest/:name |
| `packages/rustserver/src/handler/health.rs` | GET /api/health |
| `packages/rustserver/tests/api_test.rs` | 集成测试 |

---

### 任务 1：项目骨架 + 配置 + 错误类型

**文件：**
- 创建：`packages/rustserver/Cargo.toml`
- 创建：`packages/rustserver/src/main.rs`
- 创建：`packages/rustserver/src/config.rs`
- 创建：`packages/rustserver/src/error.rs`
- 创建：`packages/rustserver/config.example.toml`

- [ ] **步骤 1：创建项目目录和 Cargo.toml**

```bash
mkdir -p packages/rustserver/src
```

`packages/rustserver/Cargo.toml`：

```toml
[package]
name = "rustserver"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
thiserror = "2"
chrono = { version = "0.4", features = ["serde"] }

[dev-dependencies]
tempfile = "3"
```

- [ ] **步骤 2：创建 config.rs**

`packages/rustserver/src/config.rs`：

```rust
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub publish: PublishConfig,
}

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
}

#[derive(Debug, Deserialize)]
pub struct DatabaseConfig {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct PublishConfig {
    pub token: String,
}

impl AppConfig {
    pub fn load(path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let content = std::fs::read_to_string(path)?;
        let config: AppConfig = toml::from_str(&content)?;
        Ok(config)
    }

    pub fn load_or_default() -> Self {
        let default_path = std::env::current_exe()
            .ok()
            .map(|p| p.parent().map(|d| d.join("config.toml")).unwrap())
            .unwrap_or_else(|| PathBuf::from("config.toml"));

        let config_path = std::env::args()
            .nth(1)
            .map(PathBuf::from)
            .unwrap_or(default_path);

        Self::load(&config_path).unwrap_or_else(|e| {
            eprintln!("Failed to load config from {}: {}. Using defaults.", config_path.display(), e);
            std::process::exit(1);
        })
    }
}

use std::path::PathBuf;
```

- [ ] **步骤 3：创建 error.rs**

`packages/rustserver/src/error.rs`：

```rust
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
```

- [ ] **步骤 4：创建最小 main.rs**

`packages/rustserver/src/main.rs`：

```rust
mod config;
mod error;

use axum::{routing::get, Router};
use error::ResDTO;

async fn health() -> axum::Json<ResDTO<serde_json::Value>> {
    axum::Json(ResDTO::ok(serde_json::json!({ "status": "ok" })))
}

#[tokio::main]
async fn main() {
    let config = config::AppConfig::load_or_default();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rustserver=info".into()),
        )
        .init();

    let app = Router::new()
        .route("/api/health", get(health));

    let addr = format!("127.0.0.1:{}", config.server.port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app)
        .await
        .unwrap();
}
```

- [ ] **步骤 5：创建 config.example.toml**

`packages/rustserver/config.example.toml`：

```toml
[server]
port = 7001

[database]
path = "./data/rustserver.db"

[publish]
token = "change-me-to-a-secret-token"
```

- [ ] **步骤 6：编译验证**

```bash
cd packages/rustserver
cargo build
```

预期：编译成功，无错误。

- [ ] **步骤 7：运行验证 health 接口**

终端 1：
```bash
cd packages/rustserver && cargo run
```

终端 2：
```bash
curl http://127.0.0.1:7001/api/health
```

预期：`{"code":0,"msg":"ok","data":{"status":"ok"}}`

- [ ] **步骤 8：Commit**

```bash
git add packages/rustserver/
git commit -m "feat(rustserver): 项目骨架 + 配置 + 错误类型 + health 接口"
```

---

### 任务 2：数据库初始化 + 数据模型 + CRUD

**文件：**
- 创建：`packages/rustserver/src/db.rs`
- 创建：`packages/rustserver/src/model.rs`

- [ ] **步骤 1：创建 db.rs**

`packages/rustserver/src/db.rs`：

```rust
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

pub async fn init_pool(db_path: &str) -> Result<SqlitePool, sqlx::Error> {
    // 确保数据目录存在
    if let Some(parent) = std::path::Path::new(db_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let url = format!("sqlite:{}?mode=rwc", db_path);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    migrate(&pool).await?;
    Ok(pool)
}

async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS software (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT NOT NULL UNIQUE,
            display_name TEXT,
            description  TEXT,
            ext          TEXT,
            identifier   TEXT,
            created_at   TEXT DEFAULT (datetime('now')),
            updated_at   TEXT DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS software_version (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            software_id INTEGER NOT NULL REFERENCES software(id) ON DELETE CASCADE,
            sequence    TEXT NOT NULL,
            key         TEXT NOT NULL,
            size        INTEGER DEFAULT 0,
            force       INTEGER DEFAULT 0,
            changelog   TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            UNIQUE(software_id, sequence)
        )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// 创建内存数据库（测试用）
#[cfg(test)]
pub async fn setup_test_db() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    migrate(&pool).await.unwrap();
    pool
}
```

- [ ] **步骤 2：创建 model.rs**

`packages/rustserver/src/model.rs`：

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Software {
    pub id: i64,
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub ext: Option<String>,
    pub identifier: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SoftwareVersion {
    pub id: i64,
    pub software_id: i64,
    pub sequence: String,
    pub key: String,
    pub size: i64,
    pub force: bool,
    pub changelog: Option<String>,
    pub created_at: String,
}

/// publish/github 请求体（字段名与现有 Node.js server API 保持一致）
#[derive(Debug, Deserialize)]
pub struct GithubPublishInput {
    pub name: String,
    pub version: String,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    pub display: Option<String>,
    pub identifier: Option<String>,
    pub description: Option<String>,
    pub changelog: Option<String>,
    pub force: Option<bool>,
}

/// tools 列表响应中的软件条目（camelCase 输出与现有 API 兼容）
#[derive(Debug, Serialize)]
pub struct SoftwareListItem {
    pub id: i64,
    pub name: String,
    pub ext: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub identifier: Option<String>,
    pub description: Option<String>,
    pub versions: Vec<VersionItem>,
}

#[derive(Debug, Serialize)]
pub struct VersionItem {
    #[serde(rename = "versionId")]
    pub version_id: i64,
    pub sequence: String,
    pub size: i64,
    pub force: bool,
    pub changelog: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

/// 保存或更新软件版本（publish 核心逻辑）
pub async fn save_version(pool: &SqlitePool, input: &GithubPublishInput) -> AppResult<SoftwareVersion> {
    // 查找或创建 software
    let software = sqlx::query_as::<_, Software>(
        "SELECT * FROM software WHERE name = ?",
    )
    .bind(&input.name)
    .fetch_optional(pool)
    .await?;

    let software = if let Some(s) = software {
        // 更新可选字段
        if input.display.is_some() || input.identifier.is_some() || input.description.is_some() {
            sqlx::query(
                "UPDATE software SET updated_at = datetime('now'),
                 display_name = COALESCE(?, display_name),
                 identifier = COALESCE(?, identifier),
                 description = COALESCE(?, description)
                 WHERE id = ?",
            )
            .bind(&input.display)
            .bind(&input.identifier)
            .bind(&input.description)
            .bind(s.id)
            .execute(pool)
            .await?;
            sqlx::query_as::<_, Software>("SELECT * FROM software WHERE id = ?")
                .bind(s.id)
                .fetch_one(pool)
                .await?
        } else {
            s
        }
    } else {
        sqlx::query_as::<_, Software>(
            "INSERT INTO software (name, display_name, description, ext, identifier)
             VALUES (?, ?, ?, '', ?) RETURNING *",
        )
        .bind(&input.name)
        .bind(input.display.as_deref().unwrap_or(&input.name))
        .bind(&input.description)
        .bind(&input.identifier)
        .fetch_one(pool)
        .await?
    };

    // 查找或创建 version
    let existing = sqlx::query_as::<_, SoftwareVersion>(
        "SELECT * FROM software_version WHERE software_id = ? AND sequence = ?",
    )
    .bind(software.id)
    .bind(&input.version)
    .fetch_optional(pool)
    .await?;

    if let Some(v) = existing {
        sqlx::query(
            "UPDATE software_version SET key = ?, size = ?, force = ?, changelog = ?
             WHERE id = ?",
        )
        .bind(&input.download_url)
        .bind(if input.force.unwrap_or(false) { 0 } else { v.size })
        .bind(input.force.unwrap_or(false))
        .bind(&input.changelog)
        .bind(v.id)
        .execute(pool)
        .await?;
        Ok(sqlx::query_as::<_, SoftwareVersion>("SELECT * FROM software_version WHERE id = ?")
            .bind(v.id)
            .fetch_one(pool)
            .await?)
    } else {
        sqlx::query_as::<_, SoftwareVersion>(
            "INSERT INTO software_version (software_id, sequence, key, size, force, changelog)
             VALUES (?, ?, ?, 0, ?, ?) RETURNING *",
        )
        .bind(software.id)
        .bind(&input.version)
        .bind(&input.download_url)
        .bind(input.force.unwrap_or(false))
        .bind(&input.changelog)
        .fetch_one(pool)
        .await
        .map_err(Into::into)
    }
}

/// 获取所有软件及版本列表
pub async fn list_all_software(pool: &SqlitePool) -> AppResult<Vec<SoftwareListItem>> {
    let software_list = sqlx::query_as::<_, Software>(
        "SELECT * FROM software ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let mut result = Vec::new();
    for s in software_list {
        let versions = sqlx::query_as::<_, SoftwareVersion>(
            "SELECT * FROM software_version WHERE software_id = ? ORDER BY created_at DESC",
        )
        .bind(s.id)
        .fetch_all(pool)
        .await?;

        result.push(SoftwareListItem {
            id: s.id,
            name: s.name,
            ext: s.ext,
            display_name: s.display_name,
            identifier: s.identifier,
            description: s.description,
            versions: versions.into_iter().map(|v| VersionItem {
                version_id: v.id,
                sequence: v.sequence,
                size: v.size,
                force: v.force,
                changelog: v.changelog,
                created_at: v.created_at,
            }).collect(),
        });
    }
    Ok(result)
}

/// 按 ID 获取版本（用于 download/:id）
pub async fn get_version_by_id(pool: &SqlitePool, id: i64) -> AppResult<SoftwareVersion> {
    sqlx::query_as::<_, SoftwareVersion>("SELECT * FROM software_version WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Version '{}' not found", id)))
}

/// 按软件名获取最新版本（用于 download-latest/:name）
pub async fn get_latest_version(pool: &SqlitePool, name: &str) -> AppResult<(Software, SoftwareVersion)> {
    let software = sqlx::query_as::<_, Software>(
        "SELECT * FROM software WHERE name = ?",
    )
    .bind(name)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Software '{}' not found", name)))?;

    let version = sqlx::query_as::<_, SoftwareVersion>(
        "SELECT * FROM software_version WHERE software_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(software.id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("No versions for '{}'", name)))?;

    Ok((software, version))
}
```

- [ ] **步骤 3：编写 model 单元测试**

在 `packages/rustserver/src/model.rs` 底部添加：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::setup_test_db;

    #[tokio::test]
    async fn test_save_version_creates_software_and_version() {
        let pool = setup_test_db().await;
        let input = GithubPublishInput {
            name: "toolbox".to_string(),
            version: "0.1.0".to_string(),
            download_url: "https://github.com/test/toolbox-0.1.0.exe".to_string(),
            display: Some("工具箱".to_string()),
            identifier: Some("com.jackit.toolbox".to_string()),
            description: Some("测试描述".to_string()),
            changelog: Some("首个版本".to_string()),
            force: None,
        };
        let v = save_version(&pool, &input).await.unwrap();
        assert_eq!(v.sequence, "0.1.0");
        assert_eq!(v.key, "https://github.com/test/toolbox-0.1.0.exe");
    }

    #[tokio::test]
    async fn test_save_version_updates_existing() {
        let pool = setup_test_db().await;
        let input = GithubPublishInput {
            name: "toolbox".to_string(),
            version: "0.1.0".to_string(),
            download_url: "https://github.com/test/v1.exe".to_string(),
            display: None, identifier: None, description: None,
            changelog: Some("v1".to_string()), force: None,
        };
        save_version(&pool, &input).await.unwrap();

        let updated = GithubPublishInput {
            download_url: "https://github.com/test/v1-updated.exe".to_string(),
            changelog: Some("v1 updated".to_string()),
            ..input
        };
        let v = save_version(&pool, &updated).await.unwrap();
        assert_eq!(v.key, "https://github.com/test/v1-updated.exe");
    }

    #[tokio::test]
    async fn test_list_all_software() {
        let pool = setup_test_db().await;
        for name in &["toolbox", "jackcom"] {
            save_version(&pool, &GithubPublishInput {
                name: name.to_string(),
                version: "0.1.0".to_string(),
                download_url: format!("https://github.com/test/{}-0.1.0.exe", name),
                display: None, identifier: None, description: None,
                changelog: None, force: None,
            }).await.unwrap();
        }
        let list = list_all_software(&pool).await.unwrap();
        assert_eq!(list.len(), 2);
        assert!(list.iter().all(|s| s.versions.len() == 1));
    }

    #[tokio::test]
    async fn test_get_latest_version() {
        let pool = setup_test_db().await;
        save_version(&pool, &GithubPublishInput {
            name: "toolbox".to_string(), version: "0.1.0".to_string(),
            download_url: "https://github.com/test/v1.exe".to_string(),
            display: None, identifier: None, description: None,
            changelog: None, force: None,
        }).await.unwrap();
        save_version(&pool, &GithubPublishInput {
            name: "toolbox".to_string(), version: "0.2.0".to_string(),
            download_url: "https://github.com/test/v2.exe".to_string(),
            display: None, identifier: None, description: None,
            changelog: None, force: None,
        }).await.unwrap();

        let (sw, v) = get_latest_version(&pool, "toolbox").await.unwrap();
        assert_eq!(sw.name, "toolbox");
        assert_eq!(v.sequence, "0.2.0");
    }

    #[tokio::test]
    async fn test_get_version_not_found() {
        let pool = setup_test_db().await;
        let result = get_version_by_id(&pool, 999).await;
        assert!(result.is_err());
    }
}
```

- [ ] **步骤 4：更新 main.rs 添加 mod 声明**

在 `packages/rustserver/src/main.rs` 顶部添加：

```rust
mod config;
mod db;
mod error;
mod model;
```

- [ ] **步骤 5：运行测试**

```bash
cd packages/rustserver && cargo test
```

预期：所有 model 测试通过（5 个测试）。

- [ ] **步骤 6：Commit**

```bash
git add packages/rustserver/
git commit -m "feat(rustserver): 数据库初始化 + Software/Version 模型 + CRUD"
```

---

### 任务 3：Auth middleware + Publish handler

**文件：**
- 创建：`packages/rustserver/src/middleware/mod.rs`
- 创建：`packages/rustserver/src/middleware/auth.rs`
- 创建：`packages/rustserver/src/handler/mod.rs`
- 创建：`packages/rustserver/src/handler/publish.rs`
- 修改：`packages/rustserver/src/main.rs` — 添加路由和共享状态

- [ ] **步骤 1：创建 middleware/auth.rs**

`packages/rustserver/src/middleware/auth.rs`：

```rust
use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::AUTHORIZATION;
use axum::middleware::Next;
use axum::response::Response;

use crate::error::AppError;

/// Bearer token 校验中间件
pub async fn require_token(
    State(token): State<String>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".to_string()))?;

    let provided = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid Authorization format".to_string()))?;

    // timing-safe 比较
    if !constant_time_eq(provided.as_bytes(), token.as_bytes()) {
        return Err(AppError::Unauthorized("Invalid token".to_string()));
    }

    Ok(next.run(req).await)
}

/// 常量时间比较，防止 timing 攻击
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
}
```

- [ ] **步骤 2：创建 middleware/mod.rs**

`packages/rustserver/src/middleware/mod.rs`：

```rust
pub mod auth;
```

- [ ] **步骤 3：创建 handler/publish.rs**

`packages/rustserver/src/handler/publish.rs`：

```rust
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
    // 校验必填字段
    if input.name.is_empty() || input.version.is_empty() || input.download_url.is_empty() {
        return Ok(Json(ResDTO::fail("Missing required fields: name, version, downloadUrl")));
    }

    // 校验 downloadUrl 是合法 HTTP(S) URL
    if !input.download_url.starts_with("http://") && !input.download_url.starts_with("https://") {
        return Ok(Json(ResDTO::fail("downloadUrl must be a valid HTTP(S) URL")));
    }

    tracing::info!(name = %input.name, version = %input.version, "publish from github");

    let version = model::save_version(&pool, &input).await?;

    Ok(Json(ResDTO::ok(serde_json::json!({
        "key": version.key,
        "sequence": version.sequence,
        "name": input.name,
    }))))
}
```

- [ ] **步骤 4：创建 handler/mod.rs**

`packages/rustserver/src/handler/mod.rs`：

```rust
pub mod publish;
pub mod tools;
pub mod health;
```

- [ ] **步骤 5：创建 handler/health.rs 占位**

`packages/rustserver/src/handler/health.rs`：

```rust
use axum::Json;
use crate::error::ResDTO;

/// GET /api/health
pub async fn health() -> Json<ResDTO<serde_json::Value>> {
    Json(ResDTO::ok(serde_json::json!({ "status": "ok" })))
}
```

- [ ] **步骤 6：创建 handler/tools.rs 占位**

`packages/rustserver/src/handler/tools.rs`：

```rust
// 将在任务 4 中实现
```

- [ ] **步骤 7：更新 main.rs — 添加状态、路由、graceful shutdown**

`packages/rustserver/src/main.rs`：

```rust
mod config;
mod db;
mod error;
mod handler;
mod middleware;
mod model;

use axum::{routing::{get, post}, Router, middleware};
use sqlx::SqlitePool;

#[tokio::main]
async fn main() {
    let config = config::AppConfig::load_or_default();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rustserver=info".into()),
        )
        .init();

    tracing::info!("Starting rustserver...");

    let pool = db::init_pool(&config.database.path)
        .await
        .expect("Failed to initialize database");
    tracing::info!("Database initialized");

    let publish_token = config.publish.token.clone();
    let port = config.server.port;

    let publish_routes = Router::new()
        .route("/github", post(handler::publish::github))
        .layer(middleware::from_fn_with_state(
            publish_token,
            middleware::auth::require_token,
        ));

    let app = Router::new()
        .route("/api/health", get(handler::health::health))
        .nest("/api/publish", publish_routes)
        .with_state(pool);

    let addr = format!("127.0.0.1:{}", port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    // graceful shutdown
    tokio::spawn(async {
        tokio::signal::ctrl_c().await.unwrap();
        tracing::info!("Shutdown signal received");
    });

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c().await.unwrap();
}

// Remove old health function - now in handler::health
```

- [ ] **步骤 8：编译验证**

```bash
cd packages/rustserver && cargo build
```

预期：编译成功。

- [ ] **步骤 9：手动测试 publish 接口**

终端 1：
```bash
cd packages/rustserver && cargo run
```

终端 2：
```bash
# 无 token 应该 401
curl -s -X POST http://127.0.0.1:7001/api/publish/github \
  -H "Content-Type: application/json" \
  -d '{"name":"test","version":"0.1.0","downloadUrl":"https://example.com/test.exe"}'
# 预期：{"code":1,"msg":"Unauthorized: Missing Authorization header","data":null}

# 正确 token
curl -s -X POST http://127.0.0.1:7001/api/publish/github \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me-to-a-secret-token" \
  -d '{"name":"test","version":"0.1.0","downloadUrl":"https://example.com/test.exe"}'
# 预期：{"code":0,"msg":"ok","data":{"key":"https://example.com/test.exe","sequence":"0.1.0","name":"test"}}
```

- [ ] **步骤 10：运行全部测试**

```bash
cd packages/rustserver && cargo test
```

预期：所有测试通过。

- [ ] **步骤 11：Commit**

```bash
git add packages/rustserver/
git commit -m "feat(rustserver): auth 中间件 + publish handler"
```

---

### 任务 4：Tools handler + 完整路由

**文件：**
- 创建：`packages/rustserver/src/handler/tools.rs`（替换占位）
- 修改：`packages/rustserver/src/main.rs` — 添加 tools 路由

- [ ] **步骤 1：实现 handler/tools.rs**

`packages/rustserver/src/handler/tools.rs`：

```rust
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
    Ok(Json(ResDTO::ok(list)))
}

/// GET /api/tools/download/:id
pub async fn download_by_id(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<Json<ResDTO<serde_json::Value>>, AppError> {
    let version = model::get_version_by_id(&pool, id).await?;
    Ok(Json(ResDTO::ok(serde_json::json!({
        "url": version.key,
    }))))
}

/// GET /api/tools/download-latest/:name
pub async fn download_latest(
    State(pool): State<SqlitePool>,
    Path(name): Path<String>,
) -> Result<Json<ResDTO<serde_json::Value>>, AppError> {
    let (software, version) = model::get_latest_version(&pool, &name).await?;
    let display_name = software.display_name.unwrap_or(software.name);
    Ok(Json(ResDTO::ok(serde_json::json!({
        "url": version.key,
        "version": version.sequence,
        "size": version.size,
        "displayName": display_name,
    }))))
}
```

- [ ] **步骤 2：更新 main.rs 添加 tools 路由**

在 `packages/rustserver/src/main.rs` 的路由构建中，在 `.with_state(pool)` 之前添加：

```rust
    let tools_routes = Router::new()
        .route("/", get(handler::tools::list_software))
        .route("/download/{id}", get(handler::tools::download_by_id))
        .route("/download-latest/{name}", get(handler::tools::download_latest));

    let app = Router::new()
        .route("/api/health", get(handler::health::health))
        .nest("/api/publish", publish_routes)
        .nest("/api/tools", tools_routes)
        .with_state(pool);
```

- [ ] **步骤 3：编译验证**

```bash
cd packages/rustserver && cargo build
```

- [ ] **步骤 4：手动测试完整流程**

终端 1：
```bash
cd packages/rustserver && cargo run
```

终端 2：
```bash
# 1. publish
curl -s -X POST http://127.0.0.1:7001/api/publish/github \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me-to-a-secret-token" \
  -d '{"name":"toolbox","version":"0.1.0","downloadUrl":"https://github.com/test/toolbox-0.1.0.exe","display":"工具箱"}'

# 2. list tools
curl -s http://127.0.0.1:7001/api/tools

# 3. download by id
curl -s http://127.0.0.1:7001/api/tools/download/1

# 4. download latest
curl -s http://127.0.0.1:7001/api/tools/download-latest/toolbox
```

预期：所有接口返回正确的 ResDTO JSON。

- [ ] **步骤 5：运行全部测试**

```bash
cd packages/rustserver && cargo test
```

- [ ] **步骤 6：Commit**

```bash
git add packages/rustserver/
git commit -m "feat(rustserver): tools handler — 软件列表 + 版本下载"
```

---

### 任务 5：请求日志中间件

**文件：**
- 创建：`packages/rustserver/src/middleware/log.rs`
- 修改：`packages/rustserver/src/middleware/mod.rs`
- 修改：`packages/rustserver/src/main.rs` — 添加日志中间件

- [ ] **步骤 1：创建 middleware/log.rs**

`packages/rustserver/src/middleware/log.rs`：

```rust
use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response;

/// 请求日志中间件：记录 method、path、耗时、状态码
pub async fn request_log(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let start = std::time::Instant::now();

    let response = next.run(req).await;

    let elapsed = start.elapsed();
    let status = response.status().as_u16();

    tracing::info!(
        method = %method,
        path = %path,
        status = status,
        elapsed_ms = elapsed.as_millis() as u64,
        "request completed"
    );

    response
}
```

- [ ] **步骤 2：更新 middleware/mod.rs**

`packages/rustserver/src/middleware/mod.rs`：

```rust
pub mod auth;
pub mod log;
```

- [ ] **步骤 3：更新 main.rs 添加全局日志中间件**

在 `packages/rustserver/src/main.rs` 中，在 `let app = Router::new()` 链式调用的 `.with_state(pool)` 之后添加：

```rust
    let app = Router::new()
        .route("/api/health", get(handler::health::health))
        .nest("/api/publish", publish_routes)
        .nest("/api/tools", tools_routes)
        .layer(middleware::from_fn(middleware::log::request_log))
        .with_state(pool);
```

注意：`.layer()` 在 `.with_state()` 之前，这样日志中间件包裹在路由外层。

- [ ] **步骤 4：编译验证 + 运行测试**

```bash
cd packages/rustserver && cargo test
```

- [ ] **步骤 5：手动验证日志输出**

```bash
cd packages/rustserver && RUST_LOG=rustserver=info cargo run
```

发起请求后，控制台应输出类似：
```
2026-05-18T10:00:00.000000Z  INFO rustserver::middleware::log: request completed method=POST path=/api/publish/github status=200 elapsed_ms=12
```

- [ ] **步骤 6：Commit**

```bash
git add packages/rustserver/
git commit -m "feat(rustserver): 请求日志中间件"
```

---

### 任务 6：集成测试

**文件：**
- 创建：`packages/rustserver/tests/api_test.rs`

- [ ] **步骤 1：创建集成测试**

`packages/rustserver/tests/api_test.rs`：

```rust
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use sqlx::SqlitePool;
use tower::ServiceExt;

/// 构建测试用 app（与 main.rs 路由结构一致）
async fn test_app() -> (Router, SqlitePool) {
    let pool = crate_helper::db::setup_test_db().await;
    let publish_token = "test-token".to_string();

    let publish_routes = axum::Router::new()
        .route("/github", axum::routing::post(crate_helper::handler::publish::github))
        .layer(axum::middleware::from_fn_with_state(
            publish_token,
            crate_helper::middleware::auth::require_token,
        ));

    let tools_routes = axum::Router::new()
        .route("/", axum::routing::get(crate_helper::handler::tools::list_software))
        .route("/download/{id}", axum::routing::get(crate_helper::handler::tools::download_by_id))
        .route("/download-latest/{name}", axum::routing::get(crate_helper::handler::tools::download_latest));

    let app = axum::Router::new()
        .route("/api/health", axum::routing::get(crate_helper::handler::health::health))
        .nest("/api/publish", publish_routes)
        .nest("/api/tools", tools_routes)
        .with_state(pool.clone());

    (app, pool)
}
```

注意：由于 Rust 集成测试无法直接访问 `src/` 内的非 pub 函数，这里采用另一种方式——在 `src/lib.rs` 中暴露 `test_helpers` 模块。或者更简单的方式：使用 `axum::test` 辅助函数，直接对 handler 做单元级集成测试。

更实用的做法是在 `src/model.rs` 的 `#[cfg(test)]` 中已有完整的数据层测试，集成测试专注于 handler 的 HTTP 层行为。将集成测试改为：

`packages/rustserver/tests/api_test.rs`：

```rust
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use axum::Json;
use serde_json::json;

/// 直接测试 health handler
#[tokio::test]
async fn test_health_handler() {
    let response = rustserver::handler::health::health().await;
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["code"], 0);
    assert_eq!(json["data"]["status"], "ok");
}
```

这要求在 `src/lib.rs` 中暴露 handler 模块。

- [ ] **步骤 2：创建 src/lib.rs 暴露公共接口**

`packages/rustserver/src/lib.rs`：

```rust
pub mod config;
pub mod db;
pub mod error;
pub mod handler;
pub mod middleware;
pub mod model;
```

- [ ] **步骤 3：更新 Cargo.toml 添加 lib 配置**

在 `packages/rustserver/Cargo.toml` 的 `[package]` 和 `[dependencies]` 之间添加：

```toml
[lib]
name = "rustserver"
path = "src/lib.rs"
```

同时更新 `src/main.rs`：将所有 `mod` 声明替换为：

```rust
use rustserver::*;
```

或者保留 main.rs 的 mod 声明但添加 `extern crate` 方式。更简洁的做法是保留 `mod` 声明在 lib.rs，main.rs 通过 `use` 引用。

更新后的 `src/main.rs`：

```rust
use rustserver::config;
use rustserver::db;
use rustserver::handler;
use rustserver::middleware;

use axum::{routing::{get, post}, Router, middleware as axum_mw};
use sqlx::SqlitePool;

#[tokio::main]
async fn main() {
    let config = config::AppConfig::load_or_default();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rustserver=info".into()),
        )
        .init();

    tracing::info!("Starting rustserver...");

    let pool = db::init_pool(&config.database.path)
        .await
        .expect("Failed to initialize database");
    tracing::info!("Database initialized");

    let publish_token = config.publish.token.clone();
    let port = config.server.port;

    let publish_routes = Router::new()
        .route("/github", post(handler::publish::github))
        .layer(axum_mw::from_fn_with_state(
            publish_token,
            middleware::auth::require_token,
        ));

    let tools_routes = Router::new()
        .route("/", get(handler::tools::list_software))
        .route("/download/{id}", get(handler::tools::download_by_id))
        .route("/download-latest/{name}", get(handler::tools::download_latest));

    let app = Router::new()
        .route("/api/health", get(handler::health::health))
        .nest("/api/publish", publish_routes)
        .nest("/api/tools", tools_routes)
        .layer(axum_mw::from_fn(middleware::log::request_log))
        .with_state(pool);

    let addr = format!("127.0.0.1:{}", port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    tokio::spawn(async {
        tokio::signal::ctrl_c().await.unwrap();
        tracing::info!("Shutdown signal received");
    });

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c().await.unwrap();
}
```

- [ ] **步骤 4：重写集成测试（使用 axum::TestClient 模式）**

由于需要完整路由测试，在 lib.rs 中添加测试辅助函数：

在 `packages/rustserver/src/lib.rs` 末尾添加：

```rust
/// 构建测试用 app（集成测试使用）
#[cfg(test)]
pub fn test_app(pool: SqlitePool) -> Router {
    let publish_token = "test-token".to_string();

    let publish_routes = Router::new()
        .route("/github", axum::routing::post(handler::publish::github))
        .layer(axum::middleware::from_fn_with_state(
            publish_token,
            middleware::auth::require_token,
        ));

    let tools_routes = Router::new()
        .route("/", axum::routing::get(handler::tools::list_software))
        .route("/download/{id}", axum::routing::get(handler::tools::download_by_id))
        .route("/download-latest/{name}", axum::routing::get(handler::tools::download_latest));

    Router::new()
        .route("/api/health", axum::routing::get(handler::health::health))
        .nest("/api/publish", publish_routes)
        .nest("/api/tools", tools_routes)
        .with_state(pool)
}
```

在文件顶部添加 `use axum::Router;` 和 `use sqlx::SqlitePool;`。

然后 `packages/rustserver/tests/api_test.rs`：

```rust
use rustserver::{db, test_app};
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
async fn test_publish_and_query() {
    let pool = db::setup_test_db().await;
    let app = test_app(pool);

    // publish
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

    // 需要重新构建 app 因为 oneshot 消费了它
    // 改用 clone-friendly 的方式：直接测试 handler
}
```

注意：`oneshot` 会消费 `app`，所以每个测试需要独立创建 app 和 pool。上面的测试结构正确（每个测试函数独立创建）。

- [ ] **步骤 5：确保 db::setup_test_db 为 pub**

在 `packages/rustserver/src/db.rs` 中，`setup_test_db` 函数需标记为 `pub`（在 `#[cfg(test)]` 块内无法被外部 tests/ 目录访问）。需要将其移出 `#[cfg(test)]` 或改为 `#[cfg(test)]` 条件编译但通过 lib.rs 重新导出。

最简方案：将 `setup_test_db` 改为非 test-only 的 pub 函数：

在 `packages/rustserver/src/db.rs` 中，将 `setup_test_db` 从 `#[cfg(test)]` 移到模块顶层：

```rust
/// 创建内存数据库（测试用）
pub async fn setup_test_db() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    migrate(&pool).await.unwrap();
    pool
}
```

- [ ] **步骤 6：运行全部测试**

```bash
cd packages/rustserver && cargo test
```

预期：所有 model 单元测试 + 集成测试通过。

- [ ] **步骤 7：Commit**

```bash
git add packages/rustserver/
git commit -m "feat(rustserver): lib.rs 暴露接口 + 集成测试"
```

---

### 任务 7：最终编译 + 清理

**文件：**
- 修改：`packages/rustserver/src/main.rs` — 确认最终状态
- 修改：`packages/rustserver/src/lib.rs` — 确认最终状态

- [ ] **步骤 1：删除测试数据库文件（如有）**

```bash
rm -f packages/rustserver/data/rustserver.db
```

- [ ] **步骤 2：完整编译 + 测试**

```bash
cd packages/rustserver && cargo test && cargo build --release
```

预期：测试通过，release 编译成功。

- [ ] **步骤 3：检查 release 二进制大小**

```bash
ls -lh packages/rustserver/target/release/rustserver
```

预期：10-30MB 左右（Linux 上 strip 后更小）。

- [ ] **步骤 4：确认 .gitignore**

确保 `packages/rustserver/` 下的构建产物被忽略。检查根 `.gitignore` 是否已包含 `target/`。

- [ ] **步骤 5：Commit（如有变更）**

```bash
git add packages/rustserver/
git commit -m "chore(rustserver): 最终清理"
```
