# Plan 5: 集成与收尾

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。

**目标：** 前后端联调，验证完整 Tauri 2 应用能启动、显示页面、响应 commands

**架构：** 将 Plan 2-4 的所有模块连接到 `main.rs` → `lib.rs` 启动流程，确保 Tauri dev 能启动完整应用。

**技术栈：** Tauri 2 dev 模式

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 修改 | `src-tauri/src/main.rs` | 添加启动初始化序列 |
| 修改 | `src-tauri/src/lib.rs` | 添加 sync 模块和启动钩子 |
| 创建 | `src-tauri/src/sync/mod.rs` | 远程同步调度器 |
| 创建 | `src-tauri/src/sync/remote.rs` | HTTP 拉取 + 本地保存 |
| 修改 | `src-tauri/Cargo.toml` | 添加同步依赖 |
| 修改 | `src-tauri/tauri.conf.json` | 微调配置 |

所有路径相对于 `packages/toolbox/`。

---

### 任务 1：添加同步模块

**文件：**
- 创建：`src-tauri/src/sync/mod.rs`
- 创建：`src-tauri/src/sync/remote.rs`

- [ ] **步骤 1：创建 sync/mod.rs**

```rust
pub mod remote;
pub use remote::{fetch_and_save, SyncResult};
```

- [ ] **步骤 2：创建 sync/remote.rs**

移植 Go 的 `remote_sync.go`。使用 reqwest 从 svnlink API 拉取工具列表，保存到本地 SQLite：

```rust
use reqwest::blocking::Client;
use rusqlite::Connection;
use serde::Deserialize;

use crate::config::Config;
use crate::db::models;

#[derive(Debug, Deserialize)]
struct ApiRes<T> {
    success: bool,
    data: T,
    message: String,
}

#[derive(Debug, Deserialize)]
struct SoftwareVersionDTO {
    #[serde(rename = "versionId")]
    version_id: i64,
    sequence: String,
    size: i64,
    force: bool,
    changelog: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct SoftwareDTO {
    id: i64,
    name: String,
    identifier: String,
    #[serde(rename = "displayName")]
    display_name: String,
    description: String,
    ext: String,
    versions: Vec<SoftwareVersionDTO>,
}

pub struct SyncResult {
    pub success: bool,
    pub count: i32,
    pub message: String,
}

pub fn fetch_and_save(cfg: &Config, conn: &Connection) -> Result<SyncResult, String> {
    let url = format!("{}/api/tools/", cfg.server.address);
    let resp = Client::new().get(&url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("API returned {}", resp.status()));
    }

    let body: ApiRes<Vec<SoftwareDTO>> = resp.json().map_err(|e| e.to_string())?;
    if !body.success {
        return Err(body.message);
    }

    let now = chrono_now();
    let mut count = 0;

    for sw in &body.data {
        if sw.versions.is_empty() { continue; }
        if sw.name == "toolbox" { continue; }
        count += 1;

        // 保存 tool
        let tool = models::Tool {
            id: sw.id,
            name: sw.name.clone(),
            identifier: sw.identifier.clone(),
            display_name: sw.display_name.clone(),
            description: sw.description.clone(),
            ext: sw.ext.clone(),
            local_updated_at: now.clone(),
            ..Default::default()
        };
        // 查找已有 tool 保留安装状态
        let existing = models::query_tool_by_id(conn, sw.id).ok();
        let tool = if let Some(ex) = existing {
            models::Tool { version: ex.version, file_path: ex.file_path, installed_at: ex.installed_at, ..tool }
        } else { tool };
        models::upsert_tool(conn, &tool)?;

        // 保存 versions
        for v in &sw.versions {
            let tv = models::ToolVersion {
                id: 0,
                tool_id: sw.id,
                version_id: v.version_id,
                sequence: v.sequence.clone(),
                size: v.size,
                force: v.force,
                changelog: v.changelog.clone(),
                downloaded: false,
                deleted: false,
                created_at: v.created_at.clone(),
            };
            models::upsert_version(conn, &tv)?;
        }
    }

    Ok(SyncResult {
        success: true,
        count,
        message: format!("成功同步 {} 个工具", count),
    })
}

fn chrono_now() -> String {
    // 简单实现，与 lib.rs 中保持一致
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}
```

注意：`models::Tool` 需要实现 `Default` trait，在 Plan 2 中补充。

---

### 任务 2：更新 lib.rs 启动流程

**文件：**
- 修改：`src-tauri/src/lib.rs`

- [ ] **步骤 1：添加 sync 模块和启动初始化**

在 lib.rs 中：

1. 添加 `mod sync;`
2. 添加 `sync_now` command
3. 在 `run()` 中启动初始化序列：config → db → cleanup → sync

添加 command：

```rust
#[tauri::command]
fn sync_now(state: tauri::State<AppState>, app: tauri::AppHandle) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let result = sync::fetch_and_save(&state.cfg, &conn)?;
    let _ = app.emit("tools:sync:completed", serde_json::json!({
        "success": result.success,
        "count": result.count,
        "message": result.message,
    }));
    Ok(())
}
```

将 `sync_now` 添加到 `invoke_handler`。

在 `run()` 函数中，`tauri::Builder` 添加 `.setup()` 钩子执行初始同步和清理：

```rust
.setup(|app| {
    let state = app.state::<AppState>();
    // 清理旧版本文件
    let exe_path = std::env::current_exe().unwrap_or_default().to_string_lossy().into();
    updater::cleanup::cleanup_old_versions(&exe_path);
    // 启动时同步（异步不阻塞）
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        let state = handle.state::<AppState>();
        let conn = state.db.conn.lock().unwrap();
        if let Ok(result) = sync::fetch_and_save(&state.cfg, &conn) {
            drop(conn);
            let _ = handle.emit("tools:sync:completed", serde_json::json!({
                "success": result.success,
                "count": result.count,
                "message": result.message,
            }));
        }
    });
    Ok(())
})
```

---

### 任务 3：验证 Tauri Dev 模式

- [ ] **步骤 1：确保 Tauri CLI 已安装**

```bash
pnpm --filter @svnlink/toolbox tauri --version
```

如果未安装，在 toolbox 的 package.json 中 `@tauri-apps/cli` 已声明为 devDep，`pnpm tauri` 即可使用。

- [ ] **步骤 2：启动 dev 模式**

```bash
cd D:/Project/upgrade-component/packages/toolbox
pnpm tauri dev
```

预期：
1. Astro dev server 启动在 `localhost:4321`
2. Rust 编译并启动 Tauri 窗口
3. 窗口显示 index 页面（工具列表）
4. 侧边栏可导航到设置页

如果有编译错误，根据错误信息修复。

- [ ] **步骤 3：验证基本功能**

- 窗口标题栏可拖拽
- 最小化/最大化/关闭按钮工作
- 点击"设置"跳转到设置页
- 点击"工具"返回首页

---

### 任务 4：构建 Release

- [ ] **步骤 1：构建**

```bash
cd D:/Project/upgrade-component/packages/toolbox
pnpm tauri build
```

预期：生成安装包或 exe

- [ ] **步骤 2：验证产物**

```bash
ls src-tauri/target/release/svnlink-toolbox.exe
ls src-tauri/target/release/bundle/
```

预期：exe 和安装包生成成功

---

### 任务 5：清理旧 toolbox 目录

- [ ] **步骤 1：确认不再需要旧 Wails 项目**

检查 `D:/Project/upgrade-component/toolbox/` 是否还存在（可能在 svnlink 迁移时未被删除）。

- [ ] **步骤 2：删除旧项目（确认后）**

```bash
rm -rf D:/Project/upgrade-component/toolbox
```
