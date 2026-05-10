# Plan 2: Rust 基础模块 — 数据库与配置

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。

**目标：** 实现 SQLite 数据库初始化/CRUD 和 YAML 配置读写，注册 Tauri commands

**架构：** `rusqlite` 管理 SQLite 连接池，`serde_yaml` 读写配置文件。db 和 config 模块各通过 mod.rs 暴露公共 API，lib.rs 注册所有 `#[tauri::command]`。配置文件路径为 `~/.seichitech/toolbox.yaml`，数据库路径默认 `~/.seichitech/data/toolbox.db`。

**技术栈：** rusqlite (bundled)、serde + serde_yaml、tauri::command

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 修改 | `src-tauri/Cargo.toml` | 添加 rusqlite, serde_yaml 依赖 |
| 修改 | `src-tauri/src/lib.rs` | 注册新 commands |
| 创建 | `src-tauri/src/db/mod.rs` | db 模块入口 |
| 创建 | `src-tauri/src/db/init.rs` | SQLite 初始化 + 建表 |
| 创建 | `src-tauri/src/db/models.rs` | Tool / ToolVersion 结构体 + CRUD |
| 创建 | `src-tauri/src/config/mod.rs` | config 模块入口 |
| 创建 | `src-tauri/src/config/settings.rs` | 配置结构体 + YAML 读写 |

---

### 任务 1：添加 Rust 依赖

**文件：**
- 修改：`packages/toolbox/src-tauri/Cargo.toml`

- [ ] **步骤 1：在 `[dependencies]` 添加依赖**

在现有 tauri/serde 依赖之后追加：

```toml
rusqlite = { version = "0.31", features = ["bundled"] }
serde_yaml = "0.9"
dirs = "5"
```

- [ ] **步骤 2：运行 cargo check 下载依赖**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo check 2>&1 | tail -5
```

预期：`Finished` 或 `Downloading crates...`（首次下载需几分钟）

---

### 任务 2：配置模块

**文件：**
- 创建：`packages/toolbox/src-tauri/src/config/mod.rs`
- 创建：`packages/toolbox/src-tauri/src/config/settings.rs`

- [ ] **步骤 1：创建 config/mod.rs**

```rust
pub mod settings;
pub use settings::{AppConfig, Config, DatabaseConfig, LogConfig, ServerConfig, ToolConfig};
```

- [ ] **步骤 2：创建 config/settings.rs**

移植 Go 的 `config.go`，结构体保持 1:1 对应：

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub app: AppConfig,
    pub tool: ToolConfig,
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub log: LogConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default = "default_app_name")]
    pub name: String,
    #[serde(default = "default_environment")]
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolConfig {
    #[serde(default = "default_install_path")]
    pub install_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_server_address")]
    pub address: String,
    #[serde(default = "default_s3_port")]
    pub s3_port: i32,
    #[serde(default = "default_manual_path")]
    pub manual_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    #[serde(default = "default_db_type")]
    pub db_type: String,
    #[serde(default = "default_db_path")]
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogConfig {
    #[serde(default = "default_log_level")]
    pub level: String,
    #[serde(default)]
    pub format: String,
    #[serde(default)]
    pub output_path: String,
    #[serde(default = "default_ten")]
    pub max_size: i32,
    #[serde(default = "default_five")]
    pub max_backups: i32,
    #[serde(default = "default_thirty")]
    pub max_age: i32,
    #[serde(default = "default_true")]
    pub compress: bool,
}

fn default_app_name() -> String { "toolbox".into() }
fn default_environment() -> String { "production".into() }
fn default_install_path() -> String { "tools".into() }
fn default_server_address() -> String { "http://127.0.0.1:7001".into() }
fn default_s3_port() -> i32 { 9090 }
fn default_manual_path() -> String { "/manual".into() }
fn default_db_type() -> String { "sqlite".into() }
fn default_db_path() -> String { "data/toolbox.db".into() }
fn default_log_level() -> String { "debug".into() }
fn default_ten() -> i32 { 10 }
fn default_five() -> i32 { 5 }
fn default_thirty() -> i32 { 30 }
fn default_true() -> bool { true }

impl Default for Config {
    fn default() -> Self {
        Config {
            app: AppConfig {
                name: default_app_name(),
                environment: default_environment(),
            },
            tool: ToolConfig {
                install_path: default_install_path(),
            },
            server: ServerConfig {
                address: default_server_address(),
                s3_port: default_s3_port(),
                manual_path: default_manual_path(),
            },
            database: DatabaseConfig {
                db_type: default_db_type(),
                path: default_db_path(),
            },
            log: LogConfig {
                level: default_log_level(),
                format: String::new(),
                output_path: String::new(),
                max_size: default_ten(),
                max_backups: default_five(),
                max_age: default_thirty(),
                compress: default_true(),
            },
        }
    }
}

pub fn config_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".seichitech")
}

pub fn config_path() -> PathBuf {
    config_dir().join("toolbox.yaml")
}

pub fn load() -> Result<Config, String> {
    let path = config_path();
    if !path.exists() {
        fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        let default = Config::default();
        save(&default)?;
        return Ok(default);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let cfg: Config = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
    Ok(cfg)
}

pub fn save(cfg: &Config) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let yaml = serde_yaml::to_string(cfg).map_err(|e| e.to_string())?;
    fs::write(&path, yaml).map_err(|e| e.to_string())
}

pub fn resolve_path(path: &str, base_dir: &std::path::Path) -> PathBuf {
    let p = PathBuf::from(path);
    if p.is_absolute() {
        p
    } else {
        base_dir.join(path)
    }
}

pub fn get_resolved_db_path(cfg: &Config) -> PathBuf {
    resolve_path(&cfg.database.path, &config_dir())
}
```

- [ ] **步骤 3：验证编译**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo check 2>&1 | tail -5
```

---

### 任务 3：数据库模块

**文件：**
- 创建：`packages/toolbox/src-tauri/src/db/mod.rs`
- 创建：`packages/toolbox/src-tauri/src/db/init.rs`
- 创建：`packages/toolbox/src-tauri/src/db/models.rs`

- [ ] **步骤 1：创建 db/mod.rs**

```rust
pub mod init;
pub mod models;
pub use init::Database;
pub use models::{Tool, ToolVersion};
```

- [ ] **步骤 2：创建 db/init.rs**

移植 Go 的 `database.go`。使用 `rusqlite::Connection`，全局存储在 `std::sync::Mutex`：

```rust
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use crate::config::Config;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(cfg: &Config) -> Result<Self, String> {
        let db_path = crate::config::get_resolved_db_path(cfg);
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA journal_mode=WAL;").map_err(|e| e.to_string())?;
        let db = Database { conn: Mutex::new(conn) };
        db.create_tables()?;
        Ok(db)
    }

    fn create_tables(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tools (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                identifier TEXT,
                display_name TEXT,
                version TEXT,
                icon TEXT,
                description TEXT,
                ext TEXT,
                file_path TEXT,
                installed_at TEXT,
                remote_updated_at TEXT,
                local_updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS tool_versions (
                id INTEGER PRIMARY KEY,
                tool_id INTEGER NOT NULL,
                version_id INTEGER NOT NULL,
                sequence TEXT NOT NULL,
                size INTEGER NOT NULL DEFAULT 0,
                force INTEGER NOT NULL DEFAULT 0,
                changelog TEXT,
                downloaded INTEGER NOT NULL DEFAULT 0,
                deleted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT,
                UNIQUE(tool_id, version_id)
            );",
        ).map_err(|e| e.to_string())?;
        Ok(())
    }
}
```

- [ ] **步骤 3：创建 db/models.rs**

移植 Go 的 `tool.go` + `tool_version.go` + ToolService CRUD：

```rust
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: i64,
    pub name: String,
    pub identifier: String,
    pub display_name: String,
    pub version: String,
    pub icon: String,
    pub description: String,
    pub ext: String,
    pub file_path: String,
    pub installed_at: String,
    pub remote_updated_at: String,
    pub local_updated_at: String,
    #[serde(default)]
    pub versions: Vec<ToolVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolVersion {
    pub id: i64,
    pub tool_id: i64,
    pub version_id: i64,
    pub sequence: String,
    pub size: i64,
    pub force: bool,
    pub changelog: String,
    pub downloaded: bool,
    pub deleted: bool,
    pub created_at: String,
}

pub fn query_tools(conn: &rusqlite::Connection, filter: &str) -> Result<Vec<Tool>, String> {
    let sql = match filter {
        "installed" => "SELECT * FROM tools WHERE installed_at IS NOT NULL AND installed_at != ''",
        "not_installed" => "SELECT * FROM tools WHERE installed_at IS NULL OR installed_at = ''",
        _ => "SELECT * FROM tools",
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Tool {
            id: row.get(0)?,
            name: row.get(1)?,
            identifier: row.get(2).unwrap_or_default(),
            display_name: row.get(3).unwrap_or_default(),
            version: row.get(4).unwrap_or_default(),
            icon: row.get(5).unwrap_or_default(),
            description: row.get(6).unwrap_or_default(),
            ext: row.get(7).unwrap_or_default(),
            file_path: row.get(8).unwrap_or_default(),
            installed_at: row.get(9).unwrap_or_default(),
            remote_updated_at: row.get(10).unwrap_or_default(),
            local_updated_at: row.get(11).unwrap_or_default(),
            versions: vec![],
        })
    }).map_err(|e| e.to_string())?;

    let mut tools: Vec<Tool> = rows.filter_map(|r| r.ok()).collect();
    for tool in &mut tools {
        tool.versions = query_versions_by_tool(conn, tool.id).unwrap_or_default();
    }
    Ok(tools)
}

pub fn query_tool_by_id(conn: &rusqlite::Connection, id: i64) -> Result<Tool, String> {
    let mut stmt = conn.prepare("SELECT * FROM tools WHERE id = ?1").map_err(|e| e.to_string())?;
    let mut tool: Tool = stmt.query_row(params![id], |row| {
        Ok(Tool {
            id: row.get(0)?,
            name: row.get(1)?,
            identifier: row.get(2).unwrap_or_default(),
            display_name: row.get(3).unwrap_or_default(),
            version: row.get(4).unwrap_or_default(),
            icon: row.get(5).unwrap_or_default(),
            description: row.get(6).unwrap_or_default(),
            ext: row.get(7).unwrap_or_default(),
            file_path: row.get(8).unwrap_or_default(),
            installed_at: row.get(9).unwrap_or_default(),
            remote_updated_at: row.get(10).unwrap_or_default(),
            local_updated_at: row.get(11).unwrap_or_default(),
            versions: vec![],
        })
    }).map_err(|e| e.to_string())?;
    tool.versions = query_versions_by_tool(conn, tool.id).unwrap_or_default();
    Ok(tool)
}

pub fn upsert_tool(conn: &rusqlite::Connection, t: &Tool) -> Result<(), String> {
    conn.execute(
        "INSERT INTO tools (id, name, identifier, display_name, version, icon, description, ext, file_path, installed_at, remote_updated_at, local_updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(id) DO UPDATE SET name=?2, identifier=?3, display_name=?4, version=?5, icon=?6, description=?7, ext=?8, file_path=?9, installed_at=?10, remote_updated_at=?11, local_updated_at=?12",
        params![t.id, t.name, t.identifier, t.display_name, t.version, t.icon, t.description, t.ext, t.file_path, t.installed_at, t.remote_updated_at, t.local_updated_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn query_versions_by_tool(conn: &rusqlite::Connection, tool_id: i64) -> Result<Vec<ToolVersion>, String> {
    let mut stmt = conn.prepare("SELECT id, tool_id, version_id, sequence, size, force, changelog, downloaded, deleted, created_at FROM tool_versions WHERE tool_id = ?1").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![tool_id], |row| {
        Ok(ToolVersion {
            id: row.get(0)?,
            tool_id: row.get(1)?,
            version_id: row.get(2)?,
            sequence: row.get(3)?,
            size: row.get(4)?,
            force: row.get::<_, i32>(5)? != 0,
            changelog: row.get(6).unwrap_or_default(),
            downloaded: row.get::<_, i32>(7)? != 0,
            deleted: row.get::<_, i32>(8)? != 0,
            created_at: row.get(9).unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn upsert_version(conn: &rusqlite::Connection, v: &ToolVersion) -> Result<(), String> {
    conn.execute(
        "INSERT INTO tool_versions (tool_id, version_id, sequence, size, force, changelog, downloaded, deleted, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(tool_id, version_id) DO UPDATE SET sequence=?3, size=?4, force=?5, changelog=?6, downloaded=?7, deleted=?8, created_at=?9",
        params![v.tool_id, v.version_id, v.sequence, v.size, v.force as i32, v.changelog, v.downloaded as i32, v.deleted as i32, v.created_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **步骤 4：验证编译**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo check 2>&1 | tail -5
```

---

### 任务 4：注册 Tauri Commands

**文件：**
- 修改：`packages/toolbox/src-tauri/src/lib.rs`

- [ ] **步骤 1：重写 lib.rs**

将 lib.rs 更新为注册 db/config commands，同时管理 Database 生命周期：

```rust
use tauri::Manager;

mod config;
mod db;

struct AppState {
    db: db::Database,
    cfg: config::Config,
}

#[tauri::command]
fn config_get(state: tauri::State<AppState>, key: String) -> Result<serde_json::Value, String> {
    let cfg_json = serde_json::to_value(&state.cfg).map_err(|e| e.to_string())?;
    cfg_json.get(&key).cloned().ok_or_else(|| format!("key '{}' not found", key))
}

#[tauri::command]
fn config_set(state: tauri::State<AppState>, key: String, value: serde_json::Value) -> Result<(), String> {
    let mut cfg = state.cfg.clone();
    let cfg_json = serde_json::to_value_mut(&mut cfg).map_err(|e| e.to_string())?;
    if let Some(obj) = cfg_json.as_object_mut() {
        // 支持 "database.path" 形式的嵌套 key
        let parts: Vec<&str> = key.split('.').collect();
        if parts.len() == 2 {
            if let Some(parent) = obj.get_mut(parts[0]) {
                if let Some(parent_obj) = parent.as_object_mut() {
                    parent_obj.insert(parts[1].into(), value);
                }
            }
        }
    }
    config::save(&cfg)?;
    Ok(())
}

#[tauri::command]
fn db_query_tools(state: tauri::State<AppState>, filter: Option<String>) -> Result<Vec<db::models::Tool>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let f = filter.as_deref().unwrap_or("all");
    db::models::query_tools(&conn, f)
}

#[tauri::command]
fn db_upsert_tool(state: tauri::State<AppState>, tool: db::models::Tool) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    db::models::upsert_tool(&conn, &tool)
}

#[tauri::command]
fn db_delete_tool(state: tauri::State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tool_versions WHERE tool_id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tools WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    let cfg = config::load().expect("failed to load config");
    let db = db::Database::new(&cfg).expect("failed to init database");

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(AppState { db, cfg })
        .invoke_handler(tauri::generate_handler![
            config_get,
            config_set,
            db_query_tools,
            db_upsert_tool,
            db_delete_tool,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 2：删除 main.rs 中的旧 greet**

确认 main.rs 只调用 `upgrade-component_toolbox_lib::run()`，无需修改。

- [ ] **步骤 3：cargo check**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo check 2>&1 | tail -10
```

预期：`Finished`，无 error（可能有 unused import warning 无妨）

---

### 任务 5：验证 DB 命令端到端

- [ ] **步骤 1：cargo build**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo build 2>&1 | tail -5
```

预期：`Finished`，exe 生成在 `target/debug/upgrade-component-toolbox.exe`

- [ ] **步骤 2：验证配置文件自动创建**

```bash
ls ~/.seichitech/toolbox.yaml
```

预期：文件存在（首次运行时自动创建）。如果不想启动 GUI，可跳过此步在 Plan 5 集成测试。
