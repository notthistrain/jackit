# jacc 计划 2：Rust 后端 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 jacc 的 Rust 后端，包括 SQLite 数据库初始化、所有 Tauri 命令（config/models/skills/projects/preferences）

**架构：** Rust 后端通过 Tauri 命令暴露给前端。SQLite 数据库存储模型库、项目历史和用户偏好。配置读写直接操作 Claude Code 的 settings.json 文件。

**技术栈：** Rust, Tauri 2, sqlx 0.8 (SQLite), serde, tokio, dirs

**前置依赖：** 计划 1（项目脚手架）完成

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src-tauri/src/db.rs` | 数据库初始化和连接池管理 |
| `src-tauri/src/commands/mod.rs` | 命令模块入口 |
| `src-tauri/src/commands/config.rs` | settings.json 读写命令 |
| `src-tauri/src/commands/models.rs` | 模型库 CRUD + 激活命令 |
| `src-tauri/src/commands/skills.rs` | Skills/Agents 管理命令 |
| `src-tauri/src/commands/projects.rs` | 项目历史命令 |
| `src-tauri/src/commands/preferences.rs` | 用户偏好命令 |
| `src-tauri/src/error.rs` | 统一错误类型 |
| `src-tauri/src/lib.rs` | 修改：注册所有命令 |

---

### 任务 1：数据库模块

**文件：**
- 创建：`packages/jacc/src-tauri/src/db.rs`
- 创建：`packages/jacc/src-tauri/src/error.rs`

- [ ] **步骤 1：创建 error.rs**

```rust
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Database(#[from] sqlx::Error),

    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON 错误: {0}")]
    Json(#[from] serde_json::Error),

    #[error("{0}")]
    Custom(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
```

- [ ] **步骤 2：创建 db.rs**

```rust
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::PathBuf;

/// 获取数据库文件路径: ~/.jackit/toolbox/tools/jacc/data/jacc.db
/// 独立运行时: ~/.jackit/jacc/data/jacc.db
pub fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".jackit").join("jacc").join("data");
    std::fs::create_dir_all(&dir).ok();
    dir.join("jacc.db")
}

pub async fn init_pool() -> Result<SqlitePool, sqlx::Error> {
    let db_path = get_db_path();
    let url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    migrate(&pool).await?;
    Ok(pool)
}

async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alias TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            model_name TEXT NOT NULL,
            slot TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            name TEXT,
            last_opened_at TEXT DEFAULT (datetime('now')),
            pinned INTEGER DEFAULT 0
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    Ok(())
}
```

- [ ] **步骤 3：验证编译**

运行：`cd D:/Project/jackit/packages/jacc/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/db.rs packages/jacc/src-tauri/src/error.rs
git commit -m "feat(jacc): 添加数据库初始化和错误类型"
```

---

### 任务 2：Preferences 命令

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/mod.rs`
- 创建：`packages/jacc/src-tauri/src/commands/preferences.rs`

- [ ] **步骤 1：创建 commands/mod.rs**

```rust
pub mod preferences;
```

- [ ] **步骤 2：创建 commands/preferences.rs**

```rust
use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppResult;

#[tauri::command]
pub async fn get_preference(pool: State<'_, SqlitePool>, key: String) -> AppResult<Option<String>> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM preferences WHERE key = ?")
            .bind(&key)
            .fetch_optional(pool.inner())
            .await?;
    Ok(row.map(|r| r.0))
}

#[tauri::command]
pub async fn set_preference(pool: State<'_, SqlitePool>, key: String, value: String) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(&value)
    .execute(pool.inner())
    .await?;
    Ok(())
}
```

- [ ] **步骤 3：更新 lib.rs 注册命令和数据库**

```rust
mod commands;
mod db;
mod error;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let pool = rt.block_on(db::init_pool()).expect("failed to init database");
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::preferences::get_preference,
            commands::preferences::set_preference,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 4：验证编译**

运行：`cd D:/Project/jackit/packages/jacc/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/
git commit -m "feat(jacc): 添加 preferences 命令"
```

---

### 任务 3：Projects 命令

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/projects.rs`
- 修改：`packages/jacc/src-tauri/src/commands/mod.rs`

- [ ] **步骤 1：创建 commands/projects.rs**

```rust
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
    let projects = sqlx::query_as::<_, Project>(
        "SELECT id, path, name, last_opened_at, pinned FROM projects
         ORDER BY pinned DESC, last_opened_at DESC",
    )
    .fetch_all(pool.inner())
    .await?;
    Ok(projects)
}

#[tauri::command]
pub async fn add_project(pool: State<'_, SqlitePool>, path: String, name: Option<String>) -> AppResult<()> {
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
    Ok(())
}

#[tauri::command]
pub async fn open_project(pool: State<'_, SqlitePool>, path: String) -> AppResult<()> {
    sqlx::query("UPDATE projects SET last_opened_at = datetime('now') WHERE path = ?")
        .bind(&path)
        .execute(pool.inner())
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn remove_project(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn pin_project(pool: State<'_, SqlitePool>, id: i64, pinned: bool) -> AppResult<()> {
    sqlx::query("UPDATE projects SET pinned = ? WHERE id = ?")
        .bind(pinned as i32)
        .bind(id)
        .execute(pool.inner())
        .await?;
    Ok(())
}
```

- [ ] **步骤 2：更新 commands/mod.rs**

```rust
pub mod preferences;
pub mod projects;
```

- [ ] **步骤 3：在 lib.rs 注册 projects 命令**

在 `invoke_handler` 的 `generate_handler!` 宏中添加：

```rust
commands::projects::list_projects,
commands::projects::add_project,
commands::projects::open_project,
commands::projects::remove_project,
commands::projects::pin_project,
```

- [ ] **步骤 4：验证编译**

运行：`cd D:/Project/jackit/packages/jacc/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/
git commit -m "feat(jacc): 添加 projects 命令"
```

---

### 任务 4：Models 命令

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/models.rs`
- 修改：`packages/jacc/src-tauri/src/commands/mod.rs`

- [ ] **步骤 1：创建 commands/models.rs**

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Model {
    pub id: i64,
    pub alias: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
    pub slot: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateModelInput {
    pub alias: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
    pub slot: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModelInput {
    pub alias: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub model_name: Option<String>,
}

#[tauri::command]
pub async fn list_models(pool: State<'_, SqlitePool>) -> AppResult<Vec<Model>> {
    let models = sqlx::query_as::<_, Model>(
        "SELECT id, alias, base_url, api_key, model_name, slot, created_at, updated_at
         FROM models ORDER BY created_at DESC",
    )
    .fetch_all(pool.inner())
    .await?;
    Ok(models)
}

#[tauri::command]
pub async fn add_model(pool: State<'_, SqlitePool>, input: CreateModelInput) -> AppResult<Model> {
    let id = sqlx::query(
        "INSERT INTO models (alias, base_url, api_key, model_name, slot) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&input.alias)
    .bind(&input.base_url)
    .bind(&input.api_key)
    .bind(&input.model_name)
    .bind(&input.slot)
    .execute(pool.inner())
    .await?
    .last_insert_rowid();

    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;
    Ok(model)
}

#[tauri::command]
pub async fn update_model(pool: State<'_, SqlitePool>, id: i64, input: UpdateModelInput) -> AppResult<()> {
    let mut query = String::from("UPDATE models SET updated_at = datetime('now')");
    let mut binds: Vec<String> = vec![];

    if let Some(ref alias) = input.alias {
        query.push_str(", alias = ?");
        binds.push(alias.clone());
    }
    if let Some(ref base_url) = input.base_url {
        query.push_str(", base_url = ?");
        binds.push(base_url.clone());
    }
    if let Some(ref api_key) = input.api_key {
        query.push_str(", api_key = ?");
        binds.push(api_key.clone());
    }
    if let Some(ref model_name) = input.model_name {
        query.push_str(", model_name = ?");
        binds.push(model_name.clone());
    }

    query.push_str(" WHERE id = ?");

    let mut q = sqlx::query(&query);
    for b in &binds {
        q = q.bind(b);
    }
    q = q.bind(id);
    q.execute(pool.inner()).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM models WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn activate_model(pool: State<'_, SqlitePool>, id: i64, slot: String) -> AppResult<()> {
    // 清除该槽位的旧激活
    sqlx::query("UPDATE models SET slot = NULL WHERE slot = ?")
        .bind(&slot)
        .execute(pool.inner())
        .await?;

    // 激活新模型到该槽位
    sqlx::query("UPDATE models SET slot = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(&slot)
        .bind(id)
        .execute(pool.inner())
        .await?;

    // 读取模型信息，写入 settings.json 环境变量
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;

    write_model_to_settings(&model)?;
    Ok(())
}

#[tauri::command]
pub async fn test_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<String> {
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;

    // 简单的 HTTP 请求测试连接
    let client = reqwest::Client::new();
    let url = format!("{}/v1/messages", model.base_url.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .header("x-api-key", &model.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .body(r#"{"model":"claude-haiku-4-5-20251001","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}"#)
        .send()
        .await
        .map_err(|e| AppError::Custom(format!("连接失败: {}", e)))?;

    if resp.status().is_success() || resp.status().as_u16() == 400 {
        // 400 也算连接成功（可能是参数问题但 API 可达）
        Ok("连接成功".to_string())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(AppError::Custom(format!("HTTP {}: {}", status, body)))
    }
}

/// 将模型配置写入全局 settings.json 的环境变量
fn write_model_to_settings(model: &Model) -> AppResult<()> {
    let settings_path = get_global_settings_path();

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)?;
        serde_json::from_str(&content)?
    } else {
        serde_json::json!({})
    };

    let env = settings
        .as_object_mut()
        .unwrap()
        .entry("env")
        .or_insert_with(|| serde_json::json!({}));

    let env_obj = env.as_object_mut().unwrap();
    env_obj.insert(
        "ANTHROPIC_BASE_URL".to_string(),
        serde_json::Value::String(model.base_url.clone()),
    );
    env_obj.insert(
        "ANTHROPIC_AUTH_TOKEN".to_string(),
        serde_json::Value::String(model.api_key.clone()),
    );
    env_obj.insert(
        "ANTHROPIC_MODEL".to_string(),
        serde_json::Value::String(model.model_name.clone()),
    );

    let content = serde_json::to_string_pretty(&settings)?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&settings_path, content)?;
    Ok(())
}

fn get_global_settings_path() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".claude").join("settings.json")
}
```

- [ ] **步骤 2：在 Cargo.toml 添加 reqwest 依赖**

在 `[dependencies]` 中添加：

```toml
reqwest = { version = "0.12", features = ["json"] }
```

- [ ] **步骤 3：更新 commands/mod.rs**

```rust
pub mod models;
pub mod preferences;
pub mod projects;
```

- [ ] **步骤 4：在 lib.rs 注册 models 命令**

在 `generate_handler!` 中添加：

```rust
commands::models::list_models,
commands::models::add_model,
commands::models::update_model,
commands::models::delete_model,
commands::models::activate_model,
commands::models::test_model,
```

- [ ] **步骤 5：验证编译**

运行：`cd D:/Project/jackit/packages/jacc/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 6：Commit**

```bash
git add packages/jacc/src-tauri/
git commit -m "feat(jacc): 添加 models 命令（CRUD + 激活 + 测试连接）"
```

---

### 任务 5：Config 命令

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/config.rs`
- 修改：`packages/jacc/src-tauri/src/commands/mod.rs`

- [ ] **步骤 1：创建 commands/config.rs**

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConfigScope {
    Global,
    Project,
}

#[derive(Debug, Serialize)]
pub struct MergedConfigItem {
    pub key: String,
    pub value: serde_json::Value,
    pub scope: ConfigScope,
}

#[derive(Debug, Serialize)]
pub struct MergedConfig {
    pub items: Vec<MergedConfigItem>,
}

#[tauri::command]
pub async fn read_merged_config(project_path: String) -> AppResult<MergedConfig> {
    let global = read_settings_file(&get_global_settings_path());
    let project = read_settings_file(&get_project_settings_path(&project_path));

    let mut items: Vec<MergedConfigItem> = vec![];

    // 先加载全局配置
    if let Some(global_obj) = global.as_object() {
        for (key, value) in global_obj {
            items.push(MergedConfigItem {
                key: key.clone(),
                value: value.clone(),
                scope: ConfigScope::Global,
            });
        }
    }

    // 项目配置覆盖全局
    if let Some(project_obj) = project.as_object() {
        for (key, value) in project_obj {
            if let Some(existing) = items.iter_mut().find(|i| i.key == *key) {
                existing.value = value.clone();
                existing.scope = ConfigScope::Project;
            } else {
                items.push(MergedConfigItem {
                    key: key.clone(),
                    value: value.clone(),
                    scope: ConfigScope::Project,
                });
            }
        }
    }

    Ok(MergedConfig { items })
}

#[tauri::command]
pub async fn write_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
    value: serde_json::Value,
) -> AppResult<()> {
    let path = match scope {
        ConfigScope::Global => get_global_settings_path(),
        ConfigScope::Project => {
            let pp = project_path.ok_or_else(|| {
                crate::error::AppError::Custom("项目路径不能为空".to_string())
            })?;
            get_project_settings_path(&pp)
        }
    };

    let mut settings = read_settings_file(&path);
    let obj = settings.as_object_mut().unwrap_or(&mut serde_json::Map::new());
    obj.insert(key, value);

    write_settings_file(&path, &settings)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
) -> AppResult<()> {
    let path = match scope {
        ConfigScope::Global => get_global_settings_path(),
        ConfigScope::Project => {
            let pp = project_path.ok_or_else(|| {
                crate::error::AppError::Custom("项目路径不能为空".to_string())
            })?;
            get_project_settings_path(&pp)
        }
    };

    let mut settings = read_settings_file(&path);
    if let Some(obj) = settings.as_object_mut() {
        obj.remove(&key);
    }

    write_settings_file(&path, &settings)?;
    Ok(())
}

fn get_global_settings_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".claude").join("settings.json")
}

fn get_project_settings_path(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(".claude").join("settings.json")
}

fn read_settings_file(path: &PathBuf) -> serde_json::Value {
    if path.exists() {
        let content = std::fs::read_to_string(path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    }
}

fn write_settings_file(path: &PathBuf, value: &serde_json::Value) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(value).unwrap_or_default();
    std::fs::write(path, content)
}
```

- [ ] **步骤 2：更新 commands/mod.rs**

```rust
pub mod config;
pub mod models;
pub mod preferences;
pub mod projects;
```

- [ ] **步骤 3：在 lib.rs 注册 config 命令**

在 `generate_handler!` 中添加：

```rust
commands::config::read_merged_config,
commands::config::write_config,
commands::config::delete_config,
```

- [ ] **步骤 4：验证编译**

运行：`cd D:/Project/jackit/packages/jacc/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/
git commit -m "feat(jacc): 添加 config 命令（合并读取 + 分层写入）"
```

---

### 任务 6：Skills 命令

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/skills.rs`
- 修改：`packages/jacc/src-tauri/src/commands/mod.rs`

- [ ] **步骤 1：创建 commands/skills.rs**

```rust
use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub source: String, // "project" | "user" | "plugin"
}

#[tauri::command]
pub async fn list_skills(project_path: String) -> AppResult<Vec<SkillInfo>> {
    let mut skills = vec![];

    // 项目级 skills
    let project_skills_dir = PathBuf::from(&project_path).join(".claude").join("skills");
    if project_skills_dir.exists() {
        collect_skills(&project_skills_dir, "project", true, &mut skills)?;
    }

    // 项目级 disabled skills
    let disabled_dir = project_skills_dir.join(".disabled");
    if disabled_dir.exists() {
        collect_skills(&disabled_dir, "project", false, &mut skills)?;
    }

    // 用户级 skills
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let user_skills_dir = home.join(".claude").join("skills");
    if user_skills_dir.exists() {
        collect_skills(&user_skills_dir, "user", true, &mut skills)?;
    }

    Ok(skills)
}

#[tauri::command]
pub async fn toggle_skill(project_path: String, name: String, enabled: bool) -> AppResult<()> {
    let skills_dir = PathBuf::from(&project_path).join(".claude").join("skills");
    let disabled_dir = skills_dir.join(".disabled");

    if enabled {
        // 从 .disabled/ 移到 skills/
        let src = disabled_dir.join(&name);
        let dst = skills_dir.join(&name);
        if src.exists() {
            std::fs::rename(&src, &dst)?;
        }
    } else {
        // 从 skills/ 移到 .disabled/
        let src = skills_dir.join(&name);
        let dst = disabled_dir.join(&name);
        std::fs::create_dir_all(&disabled_dir)?;
        if src.exists() {
            std::fs::rename(&src, &dst)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn import_skill(project_path: String, source_path: String) -> AppResult<()> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(AppError::Custom("源路径不存在".to_string()));
    }

    let name = source
        .file_name()
        .ok_or_else(|| AppError::Custom("无效的源路径".to_string()))?
        .to_string_lossy()
        .to_string();

    let dst = PathBuf::from(&project_path)
        .join(".claude")
        .join("skills")
        .join(&name);

    copy_dir_recursive(&source, &dst)?;
    Ok(())
}

#[tauri::command]
pub async fn install_skill_from_github(project_path: String, repo_url: String) -> AppResult<Vec<SkillInfo>> {
    // Clone 到临时目录
    let temp_dir = std::env::temp_dir().join(format!("jacc-skill-{}", chrono::Utc::now().timestamp()));
    std::fs::create_dir_all(&temp_dir)?;

    let output = std::process::Command::new("git")
        .args(["clone", "--depth", "1", &repo_url, &temp_dir.to_string_lossy()])
        .output()
        .map_err(|e| AppError::Custom(format!("git clone 失败: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Custom(format!("git clone 失败: {}", stderr)));
    }

    // 扫描 skill 目录（查找包含 SKILL.md 的目录）
    let mut available_skills = vec![];
    scan_for_skills(&temp_dir, &mut available_skills)?;

    // 将临时目录路径存入 skill info 的 description 中以便后续使用
    for skill in &mut available_skills {
        skill.description = format!("{}|{}", temp_dir.display(), skill.description);
    }

    Ok(available_skills)
}

#[tauri::command]
pub async fn confirm_install_skill(
    project_path: String,
    temp_dir: String,
    skill_names: Vec<String>,
) -> AppResult<()> {
    let temp_path = PathBuf::from(&temp_dir);
    let dst_base = PathBuf::from(&project_path).join(".claude").join("skills");
    std::fs::create_dir_all(&dst_base)?;

    for name in &skill_names {
        let src = find_skill_dir(&temp_path, name)?;
        let dst = dst_base.join(name);
        copy_dir_recursive(&src, &dst)?;
    }

    // 清理临时目录
    std::fs::remove_dir_all(&temp_path).ok();
    Ok(())
}

fn collect_skills(
    dir: &Path,
    source: &str,
    enabled: bool,
    skills: &mut Vec<SkillInfo>,
) -> AppResult<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() && path.file_name().map(|n| !n.to_string_lossy().starts_with('.')).unwrap_or(false) {
            let name = path.file_name().unwrap().to_string_lossy().to_string();
            let skill_md = path.join("SKILL.md");
            let description = if skill_md.exists() {
                extract_description(&skill_md)
            } else {
                String::new()
            };
            skills.push(SkillInfo {
                name,
                description,
                enabled,
                source: source.to_string(),
            });
        }
    }
    Ok(())
}

fn extract_description(skill_md: &Path) -> String {
    let content = std::fs::read_to_string(skill_md).unwrap_or_default();
    // 取第一行非空非标题行作为描述
    content
        .lines()
        .find(|line| !line.is_empty() && !line.starts_with('#'))
        .unwrap_or("")
        .to_string()
}

fn scan_for_skills(dir: &Path, skills: &mut Vec<SkillInfo>) -> AppResult<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            let skill_md = path.join("SKILL.md");
            if skill_md.exists() {
                let name = path.file_name().unwrap().to_string_lossy().to_string();
                let description = extract_description(&skill_md);
                skills.push(SkillInfo {
                    name,
                    description,
                    enabled: false,
                    source: "github".to_string(),
                });
            } else {
                // 递归查找子目录
                scan_for_skills(&path, skills)?;
            }
        }
    }
    Ok(())
}

fn find_skill_dir(base: &Path, name: &str) -> AppResult<PathBuf> {
    for entry in walkdir(base)? {
        if entry.is_dir() && entry.file_name().map(|n| n.to_string_lossy() == name).unwrap_or(false) {
            let skill_md = entry.join("SKILL.md");
            if skill_md.exists() {
                return Ok(entry);
            }
        }
    }
    Err(AppError::Custom(format!("未找到 skill: {}", name)))
}

fn walkdir(dir: &Path) -> AppResult<Vec<PathBuf>> {
    let mut results = vec![];
    fn walk(dir: &Path, results: &mut Vec<PathBuf>) -> std::io::Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            results.push(path.clone());
            if path.is_dir() {
                walk(&path, results)?;
            }
        }
        Ok(())
    }
    walk(dir, &mut results)?;
    Ok(results)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}
```

- [ ] **步骤 2：在 Cargo.toml 添加 chrono 的 serde feature（如果还没有）**

确认 Cargo.toml 中 chrono 已有 serde feature：
```toml
chrono = { version = "0.4", features = ["serde"] }
```

- [ ] **步骤 3：更新 commands/mod.rs**

```rust
pub mod config;
pub mod models;
pub mod preferences;
pub mod projects;
pub mod skills;
```

- [ ] **步骤 4：在 lib.rs 注册 skills 命令**

在 `generate_handler!` 中添加：

```rust
commands::skills::list_skills,
commands::skills::toggle_skill,
commands::skills::import_skill,
commands::skills::install_skill_from_github,
commands::skills::confirm_install_skill,
```

- [ ] **步骤 5：验证编译**

运行：`cd D:/Project/jackit/packages/jacc/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 6：Commit**

```bash
git add packages/jacc/src-tauri/
git commit -m "feat(jacc): 添加 skills 命令（列表/启用禁用/导入/GitHub安装）"
```

---

### 任务 7：最终集成和完整编译验证

**文件：**
- 修改：`packages/jacc/src-tauri/src/lib.rs`（最终版本）

- [ ] **步骤 1：确认 lib.rs 最终版本**

```rust
mod commands;
mod db;
mod error;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let pool = rt.block_on(db::init_pool()).expect("failed to init database");
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // preferences
            commands::preferences::get_preference,
            commands::preferences::set_preference,
            // projects
            commands::projects::list_projects,
            commands::projects::add_project,
            commands::projects::open_project,
            commands::projects::remove_project,
            commands::projects::pin_project,
            // models
            commands::models::list_models,
            commands::models::add_model,
            commands::models::update_model,
            commands::models::delete_model,
            commands::models::activate_model,
            commands::models::test_model,
            // config
            commands::config::read_merged_config,
            commands::config::write_config,
            commands::config::delete_config,
            // skills
            commands::skills::list_skills,
            commands::skills::toggle_skill,
            commands::skills::import_skill,
            commands::skills::install_skill_from_github,
            commands::skills::confirm_install_skill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 2：完整编译验证**

运行：`cd D:/Project/jackit/packages/jacc/src-tauri && cargo build`
预期：编译成功，无错误无警告

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/
git commit -m "feat(jacc): Rust 后端完整集成"
```
