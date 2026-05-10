# Plan 3: Rust 工具操作与自更新

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。

**目标：** 实现工具安装/卸载/启动和自更新（检查/下载/应用/清理）模块，注册 Tauri commands

**架构：** fs 模块负责文件系统操作（下载、解压、启动进程），updater 模块复用 fs 的下载能力实现自更新。下载进度通过 Tauri Event 系统推送到前端。自更新不使用 tauri-plugin-updater，而是复刻 Go 的 bat 脚本方案。

**技术栈：** reqwest（HTTP 下载）、tauri::Emitter（进度事件）、std::process（进程启动）

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 修改 | `src-tauri/Cargo.toml` | 添加 reqwest 依赖 |
| 修改 | `src-tauri/src/lib.rs` | 注册新 commands |
| 创建 | `src-tauri/src/fs/mod.rs` | fs 模块入口 |
| 创建 | `src-tauri/src/fs/install.rs` | 工具安装（下载 + 写入） |
| 创建 | `src-tauri/src/fs/uninstall.rs` | 工具卸载（清理文件） |
| 创建 | `src-tauri/src/fs/launch.rs` | 启动工具（spawn 进程） |
| 创建 | `src-tauri/src/updater/mod.rs` | updater 模块入口 |
| 创建 | `src-tauri/src/updater/check.rs` | 检查新版本 |
| 创建 | `src-tauri/src/updater/download.rs` | 下载 .new 文件 + 进度事件 |
| 创建 | `src-tauri/src/updater/apply.rs` | 生成 bat 脚本 → 重启 |
| 创建 | `src-tauri/src/updater/cleanup.rs` | 清理 .old/.new 残留 |

---

### 任务 1：添加 reqwest 依赖

**文件：**
- 修改：`packages/toolbox/src-tauri/Cargo.toml`

- [ ] **步骤 1：添加 reqwest**

在 `[dependencies]` 追加：

```toml
reqwest = { version = "0.12", features = ["blocking"] }
```

- [ ] **步骤 2：cargo check 下载依赖**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo check 2>&1 | tail -5
```

---

### 任务 2：fs 模块 — 工具安装

**文件：**
- 创建：`packages/toolbox/src-tauri/src/fs/mod.rs`
- 创建：`packages/toolbox/src-tauri/src/fs/install.rs`

- [ ] **步骤 1：创建 fs/mod.rs**

```rust
pub mod install;
pub mod uninstall;
pub mod launch;
```

- [ ] **步骤 2：创建 fs/install.rs**

移植 Go 的 `tool_installer.go` 核心逻辑。下载使用 reqwest blocking + 进度回调：

```rust
use std::path::Path;
use std::fs;
use std::io::{self, Read, Write};
use reqwest::blocking::Client;

use crate::db::models;

fn get_signed_url(server_addr: &str, s3_port: i32, version_id: i64) -> Result<String, String> {
    let url = format!("{}/api/tools/download/{}", server_addr, version_id);
    let resp = Client::new().get(&url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("API returned {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let download_url = body["data"]["url"].as_str().unwrap_or("").to_string();
    if download_url.is_empty() {
        return Err("empty download URL".into());
    }
    // 替换端口为 S3 端口
    let parsed = url::Url::parse(&download_url).map_err(|e| e.to_string())?;
    let server_parsed = url::Url::parse(server_addr).map_err(|e| e.to_string())?;
    let host = server_parsed.host_str().unwrap_or("localhost");
    let mut new_url = parsed;
    new_url.set_port(Some(s3_port as u16)).ok();
    // 也需要设置 host 保持一致
    let final_url = new_url.to_string().replace(
        &format!("://{}:", parsed.host_str().unwrap_or("")),
        &format!("://{}:", host),
    );
    Ok(final_url)
}

struct ProgressWriter<W: Write> {
    inner: W,
    total: u64,
    read: u64,
    last_percent: i32,
    on_progress: Box<dyn Fn(i32)>,
}

impl<W: Write> Write for ProgressWriter<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let n = self.inner.write(buf)?;
        self.read += n as u64;
        if self.total > 0 {
            let percent = (self.read as f64 / self.total as f64 * 100.0) as i32;
            if percent != self.last_percent && percent % 5 == 0 {
                (self.on_progress)(percent);
                self.last_percent = percent;
            }
        }
        Ok(n)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

pub fn install_tool(
    server_addr: &str,
    s3_port: i32,
    install_base: &str,
    tool: &models::Tool,
    version: &models::ToolVersion,
    on_progress: Box<dyn Fn(i32)>,
) -> Result<String, String> {
    let dir = Path::new(install_base)
        .join(&tool.display_name)
        .join(&version.sequence);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let file_name = if tool.ext.is_empty() {
        tool.name.clone()
    } else {
        format!("{}.{}", tool.name, tool.ext)
    };
    let file_path = dir.join(&file_name);

    // 如果已下载，跳过
    if version.downloaded && file_path.exists() {
        return Ok(file_path.to_string_lossy().into());
    }

    let download_url = get_signed_url(server_addr, s3_port, version.version_id)?;

    let resp = Client::new().get(&download_url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("download failed: {}", resp.status()));
    }
    let total = version.size as u64;

    let tmp_path = file_path.with_extension("tmp");
    let file = fs::File::create(&tmp_path).map_err(|e| e.to_string())?;
    let mut writer = ProgressWriter {
        inner: file,
        total,
        read: 0,
        last_percent: 0,
        on_progress,
    };

    let mut reader = resp;
    io::copy(&mut reader, &mut writer).map_err(|e| e.to_string())?;

    fs::rename(&tmp_path, &file_path).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().into())
}
```

注意：需要在 Cargo.toml 添加 `url` crate：
```toml
url = "2"
```

---

### 任务 3：fs 模块 — 卸载与启动

**文件：**
- 创建：`packages/toolbox/src-tauri/src/fs/uninstall.rs`
- 创建：`packages/toolbox/src-tauri/src/fs/launch.rs`

- [ ] **步骤 1：创建 fs/uninstall.rs**

移植 Go 的 `Uninstall` 方法（仅清除数据库状态，不删文件——与 Go 行为一致）：

```rust
use std::fs;

pub fn remove_install_dir(path: &str) -> Result<(), String> {
    let p = std::path::Path::new(path);
    if p.exists() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

- [ ] **步骤 2：创建 fs/launch.rs**

移植 Go 的 `Run` 方法：

```rust
use std::process::Command;

pub fn launch_tool(file_path: &str) -> Result<u32, String> {
    let path = std::path::Path::new(file_path);
    if !path.exists() {
        return Err(format!("file not found: {}", file_path));
    }
    let work_dir = path.parent().unwrap_or(std::path::Path::new(".")).to_string_lossy().into();
    let child = Command::new(file_path)
        .current_dir(work_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(child.id())
}
```

- [ ] **步骤 3：cargo check**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo check 2>&1 | tail -5
```

---

### 任务 4：updater 模块

**文件：**
- 创建：`packages/toolbox/src-tauri/src/updater/mod.rs`
- 创建：`packages/toolbox/src-tauri/src/updater/check.rs`
- 创建：`packages/toolbox/src-tauri/src/updater/download.rs`
- 创建：`packages/toolbox/src-tauri/src/updater/apply.rs`
- 创建：`packages/toolbox/src-tauri/src/updater/cleanup.rs`

- [ ] **步骤 1：创建 updater/mod.rs**

```rust
pub mod check;
pub mod download;
pub mod apply;
pub mod cleanup;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub version_id: i64,
    pub size: i64,
    pub release_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub status: String,
    pub progress: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}
```

- [ ] **步骤 2：创建 updater/check.rs**

移植 Go 的 `CheckUpdate`。从本地 DB 查找 toolbox 工具的最新版本，与当前版本对比：

```rust
use rusqlite::Connection;

use crate::db::models;
use super::UpdateInfo;

const TOOLBOX_TOOL_NAME: &str = "toolbox";

pub fn check_update(conn: &Connection, current_version: &str) -> Result<Option<UpdateInfo>, String> {
    let tools = models::query_tools(conn, "all")?;
    let toolbox = tools.iter().find(|t| t.name == TOOLBOX_TOOL_NAME)
        .ok_or("toolbox tool not found in database")?;

    if toolbox.versions.is_empty() {
        return Err("no versions available for toolbox".into());
    }

    // 找最新版本（版本号最大的）
    let mut versions = toolbox.versions.clone();
    versions.sort_by(|a, b| compare_versions(&b.sequence, &a.sequence));
    let latest = &versions[0];

    if compare_versions(&latest.sequence, current_version) <= 0 {
        return Ok(None);
    }

    Ok(Some(UpdateInfo {
        version: latest.sequence.clone(),
        version_id: latest.version_id,
        size: latest.size,
        release_note: "新版本可用".into(),
    }))
}

fn compare_versions(a: &str, b: &str) -> i32 {
    let parse = |v: &str| -> Vec<i64> {
        v.split('.').filter_map(|s| s.parse().ok()).collect()
    };
    let va = parse(a);
    let vb = parse(b);
    let max_len = va.len().max(vb.len());
    for i in 0..max_len {
        let na = va.get(i).unwrap_or(&0);
        let nb = vb.get(i).unwrap_or(&0);
        if na != nb {
            return (na - nb) as i32;
        }
    }
    0
}
```

- [ ] **步骤 3：创建 updater/download.rs**

移植 Go 的 `DownloadUpdate`。下载新版本到 `<exe_path>.new`：

```rust
use std::fs;
use std::io::{self, Read, Write};
use reqwest::blocking::Client;

use crate::config::Config;
use super::UpdateProgress;

pub fn download_update(
    cfg: &Config,
    version_id: i64,
    size: i64,
    exe_path: &str,
    on_progress: Box<dyn Fn(UpdateProgress)>,
) -> Result<String, String> {
    let new_path = format!("{}.new", exe_path);

    // 获取签名 URL（复用 install 模块的逻辑）
    let url = crate::fs::install::get_signed_url_internal(
        &cfg.server.address,
        cfg.server.s3_port,
        version_id,
    )?;

    on_progress(UpdateProgress {
        status: "downloading".into(),
        progress: 0,
        message: "开始下载更新".into(),
        version: None,
    });

    let resp = Client::new().get(&url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("download failed: {}", resp.status()));
    }

    let file = fs::File::create(&new_path).map_err(|e| e.to_string())?;
    // ... 进度写入逻辑（类似 install.rs 的 ProgressWriter）

    on_progress(UpdateProgress {
        status: "ready".into(),
        progress: 100,
        message: "下载完成，准备更新".into(),
        version: None,
    });

    Ok(new_path)
}
```

注意：需要将 `get_signed_url` 从 `install.rs` 提取为公共函数 `get_signed_url_internal` 以便 updater 复用。在实际实现时，将 URL 获取逻辑提取到一个共享位置。

- [ ] **步骤 4：创建 updater/apply.rs**

移植 Go 的 `apply.go` + `script.go`。生成 bat 脚本并执行：

```rust
use std::fs;
use std::process::Command;
use std::path::Path;

pub fn generate_update_script(exe_path: &str, pid: u32) -> String {
    let old_path = format!("{}.old", exe_path);
    let new_path = format!("{}.new", exe_path);
    let exe_name = Path::new(exe_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();

    format!(r#"@echo off
chcp 65001 >nul
echo Toolbox Updater
echo Waiting for process {pid} to exit...

:wait_loop
tasklist /FI "PID eq {pid}" 2>nul | find "{pid}" >nul
if %errorlevel% equ 0 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

echo Process exited, applying update...

if exist "{old_path}" del /f /q "{old_path}"

if exist "{exe_path}" (
    ren "{exe_path}" "{exe_name}.old"
)

if exist "{new_path}" (
    move /y "{new_path}" "{exe_path}"
)

echo Update completed, starting application...
start "" "{exe_path}"
"#)
}

pub fn apply_update(exe_path: &str) -> Result<(), String> {
    let new_path = format!("{}.new", exe_path);
    if !Path::new(&new_path).exists() {
        return Err("new version file not found".into());
    }
    Ok(())
}

pub fn restart_for_update(exe_path: &str) -> Result<(), String> {
    let pid = std::process::id();
    let script = generate_update_script(exe_path, pid);
    let script_path = std::env::temp_dir().join("toolbox_update.bat");
    fs::write(&script_path, &script).map_err(|e| e.to_string())?;

    Command::new("cmd.exe")
        .arg("/c")
        .arg(&script_path)
        .spawn()
        .map_err(|e| e.to_string())?;

    std::process::exit(0);
}
```

- [ ] **步骤 5：创建 updater/cleanup.rs**

移植 Go 的 `CleanupOldVersions`：

```rust
use std::fs;
use std::path::Path;

pub fn cleanup_old_versions(exe_path: &str) {
    let dir = match Path::new(exe_path).parent() {
        Some(d) => d,
        None => return,
    };
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into();
            if name.ends_with(".old") || name.ends_with(".new") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}
```

- [ ] **步骤 6：cargo check**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo check 2>&1 | tail -5
```

---

### 任务 5：注册新 Commands 到 lib.rs

**文件：**
- 修改：`packages/toolbox/src-tauri/src/lib.rs`

在现有 lib.rs 中添加新模块和 commands。在 `mod config;` 和 `mod db;` 之后添加：

```rust
mod fs;
mod updater;
```

添加新 commands：

```rust
#[tauri::command]
fn tl_install(state: tauri::State<AppState>, app: tauri::AppHandle, tool_id: i64, version: Option<String>) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let tool = db::models::query_tool_by_id(&conn, tool_id)?;
    let target_version = if let Some(v) = version {
        tool.versions.iter().find(|ver| ver.sequence == v)
            .ok_or_else(|| format!("version {} not found", v))?.clone()
    } else {
        tool.versions.first().ok_or("no versions available")?.clone()
    };
    drop(conn); // 释放锁

    let file_path = fs::install::install_tool(
        &state.cfg.server.address,
        state.cfg.server.s3_port,
        &state.cfg.tool.install_path,
        &tool,
        &target_version,
        Box::new(move |percent| {
            let _ = app.emit("tool:install:progress", serde_json::json!({
                "toolId": tool_id,
                "status": "downloading",
                "progress": percent,
                "message": format!("下载中 {}%", percent),
            }));
        }),
    )?;

    // 更新数据库
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    let mut updated_tool = tool.clone();
    updated_tool.version = target_version.sequence;
    updated_tool.file_path = file_path;
    updated_tool.installed_at = now;
    db::models::upsert_tool(&conn, &updated_tool)?;

    let _ = app.emit("tool:install:progress", serde_json::json!({
        "toolId": tool_id,
        "status": "completed",
        "progress": 100,
        "message": "安装完成",
    }));
    Ok(())
}

#[tauri::command]
fn tl_uninstall(state: tauri::State<AppState>, tool_id: i64) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut tool = db::models::query_tool_by_id(&conn, tool_id)?;
    if tool.installed_at.is_empty() {
        return Err("tool not installed".into());
    }
    tool.version = String::new();
    tool.file_path = String::new();
    tool.installed_at = String::new();
    db::models::upsert_tool(&conn, &tool)
}

#[tauri::command]
fn tl_launch(file_path: String) -> Result<u32, String> {
    fs::launch::launch_tool(&file_path)
}

#[tauri::command]
fn updater_check(state: tauri::State<AppState>) -> Result<Option<updater::UpdateInfo>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    updater::check::check_update(&conn, env!("CARGO_PKG_VERSION"))
}

#[tauri::command]
fn updater_download(state: tauri::State<AppState>, app: tauri::AppHandle, version_id: i64, size: i64) -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?.to_string_lossy().into();
    updater::download::download_update(
        &state.cfg,
        version_id,
        size,
        &exe_path,
        Box::new(move |progress| {
            let _ = app.emit("app:update:progress", &progress);
        }),
    )?;
    Ok(())
}

#[tauri::command]
fn updater_apply() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?.to_string_lossy().into();
    updater::apply::restart_for_update(&exe_path)
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    // 简单格式化，实际可使用 chrono crate
    format!("{}", now.as_secs())
}
```

将新 commands 添加到 `invoke_handler`：

```rust
.invoke_handler(tauri::generate_handler![
    config_get, config_set,
    db_query_tools, db_upsert_tool, db_delete_tool,
    tl_install, tl_uninstall, tl_launch,
    updater_check, updater_download, updater_apply,
])
```

- [ ] **cargo check 验证全部编译**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo check 2>&1 | tail -10
```

预期：`Finished` 无 error
