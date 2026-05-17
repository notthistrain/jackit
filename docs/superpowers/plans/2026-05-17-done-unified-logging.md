# 统一日志模块实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为三个 Tauri 桌面应用统一配置 tracing 日志系统，日志写入各自工作目录的 `log/` 子目录，前端通过 Tauri command 桥接。

**架构：** 每个 app 新增 `logging.rs`（初始化 tracing subscriber）和 `commands/log.rs`（前端桥接 command）。移除现有 tauri-plugin-log 依赖，替换为 tracing + tracing-subscriber + tracing-appender。前端新增 `logger.ts` 封装 invoke 调用。

**技术栈：** tracing 0.1, tracing-subscriber 0.3 (env-filter), tracing-appender 0.2, Tauri 2 commands

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/jacc/src-tauri/src/logging.rs` | 创建：jacc 日志初始化 |
| `packages/jacc/src-tauri/src/commands/log.rs` | 创建：jacc 前端桥接 command |
| `packages/jacc/src-tauri/src/commands/mod.rs` | 修改：注册 log 模块 |
| `packages/jacc/src-tauri/src/lib.rs` | 修改：初始化 logging + 注册 command + 添加日志点 |
| `packages/jacc/src-tauri/Cargo.toml` | 修改：添加 tracing 依赖 |
| `packages/jacc/src/lib/logger.ts` | 创建：前端 logger 封装 |
| `packages/jackcom/src-tauri/src/logging.rs` | 创建：jackcom 日志初始化 |
| `packages/jackcom/src-tauri/src/commands/log.rs` | 创建：jackcom 前端桥接 command |
| `packages/jackcom/src-tauri/src/commands/mod.rs` | 修改：注册 log 模块 |
| `packages/jackcom/src-tauri/src/lib.rs` | 修改：替换 plugin-log + 添加日志点 |
| `packages/jackcom/src-tauri/src/channel/broker.rs` | 修改：log:: → tracing:: |
| `packages/jackcom/src-tauri/Cargo.toml` | 修改：替换依赖 |
| `packages/jackcom/package.json` | 修改：移除 @tauri-apps/plugin-log |
| `packages/jackcom/src-tauri/tauri.conf.json` | 修改：移除 plugins.log |
| `packages/jackcom/src/lib/logger.ts` | 创建：前端 logger 封装 |
| `packages/toolbox/src-tauri/src/logging.rs` | 创建：toolbox 日志初始化 |
| `packages/toolbox/src-tauri/src/lib.rs` | 修改：替换 plugin-log + 注册 command + 添加日志点 |
| `packages/toolbox/src-tauri/Cargo.toml` | 修改：替换依赖 |
| `packages/toolbox/package.json` | 修改：移除 @tauri-apps/plugin-log |
| `packages/toolbox/src/lib/logger.ts` | 创建：前端 logger 封装 |

---

### 任务 1：Jacc 日志模块（新增）

**文件：**
- 修改：`packages/jacc/src-tauri/Cargo.toml`
- 创建：`packages/jacc/src-tauri/src/logging.rs`
- 创建：`packages/jacc/src-tauri/src/commands/log.rs`
- 修改：`packages/jacc/src-tauri/src/commands/mod.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`
- 创建：`packages/jacc/src/lib/logger.ts`

- [ ] **步骤 1：添加 Cargo 依赖**

在 `packages/jacc/src-tauri/Cargo.toml` 的 `[dependencies]` 末尾添加：

```toml
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"
```

- [ ] **步骤 2：创建 logging.rs**

创建 `packages/jacc/src-tauri/src/logging.rs`：

```rust
use std::path::Path;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// 初始化 tracing 日志系统
/// 返回 WorkerGuard，必须保持存活直到应用退出
pub fn init(app_name: &str, log_dir: &Path) -> WorkerGuard {
    std::fs::create_dir_all(log_dir).ok();

    let file_appender = rolling::daily(log_dir, format!("{app_name}.log"));
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = if cfg!(debug_assertions) {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("info")
    };

    let file_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false);

    // dev 模式同时输出到 stdout，release 模式仅写文件
    let stdout_layer = if cfg!(debug_assertions) {
        Some(fmt::layer().with_writer(std::io::stdout))
    } else {
        None
    };

    tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer)
        .with(stdout_layer)
        .init();

    guard
}

/// 获取 jacc 日志目录: ~/.jackit/toolbox/tools/jacc/log/
pub fn get_log_dir() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".jackit").join("toolbox").join("tools").join("jacc").join("log")
}
```

- [ ] **步骤 3：创建 commands/log.rs**

创建 `packages/jacc/src-tauri/src/commands/log.rs`：

```rust
#[tauri::command]
pub fn log_info(module: String, message: String) {
    tracing::info!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
pub fn log_warn(module: String, message: String) {
    tracing::warn!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
pub fn log_error(module: String, message: String) {
    tracing::error!(target: "frontend", "[{}] {}", module, message);
}
```

- [ ] **步骤 4：注册 log 模块到 commands/mod.rs**

修改 `packages/jacc/src-tauri/src/commands/mod.rs`，添加一行：

```rust
pub mod config;
pub mod log;
pub mod models;
pub mod preferences;
pub mod projects;
pub mod skills;
```

- [ ] **步骤 5：修改 lib.rs 初始化日志并注册 command**

修改 `packages/jacc/src-tauri/src/lib.rs`：

```rust
mod commands;
mod db;
mod error;
mod logging;

use tracing_appender::non_blocking::WorkerGuard;
use tauri::Manager;

/// 持有日志 guard，防止被 drop
struct LogGuard(WorkerGuard);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志（必须在 Builder 之前，确保整个启动过程都有日志）
    let log_dir = logging::get_log_dir();
    let guard = logging::init("jacc", &log_dir);

    tracing::info!("app started");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(LogGuard(guard))
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::init_pool())
                .expect("failed to init database");
            app.manage(pool);
            tracing::info!("database initialized");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // log
            commands::log::log_info,
            commands::log::log_warn,
            commands::log::log_error,
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
            commands::models::bind_model,
            commands::models::activate_slot,
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

- [ ] **步骤 6：创建前端 logger.ts**

创建 `packages/jacc/src/lib/logger.ts`：

```typescript
import { invoke } from '@tauri-apps/api/core'

export const logger = {
  info: (module: string, message: string) => invoke('log_info', { module, message }),
  warn: (module: string, message: string) => invoke('log_warn', { module, message }),
  error: (module: string, message: string) => invoke('log_error', { module, message }),
}
```

- [ ] **步骤 7：验证编译**

运行：`cd packages/jacc/src-tauri && cargo check`
预期：编译通过，无错误

- [ ] **步骤 8：Commit**

```bash
git add packages/jacc/src-tauri/Cargo.toml packages/jacc/src-tauri/src/logging.rs packages/jacc/src-tauri/src/commands/log.rs packages/jacc/src-tauri/src/commands/mod.rs packages/jacc/src-tauri/src/lib.rs packages/jacc/src/lib/logger.ts
git commit -m "feat(jacc): 添加 tracing 日志模块"
```

---

### 任务 2：JackCom 日志迁移（plugin-log → tracing）

**文件：**
- 修改：`packages/jackcom/src-tauri/Cargo.toml`
- 创建：`packages/jackcom/src-tauri/src/logging.rs`
- 创建：`packages/jackcom/src-tauri/src/commands/log.rs`
- 修改：`packages/jackcom/src-tauri/src/commands/mod.rs`
- 修改：`packages/jackcom/src-tauri/src/lib.rs`
- 修改：`packages/jackcom/src-tauri/src/channel/broker.rs`
- 修改：`packages/jackcom/src-tauri/tauri.conf.json`
- 修改：`packages/jackcom/package.json`
- 创建：`packages/jackcom/src/lib/logger.ts`

- [ ] **步骤 1：修改 Cargo.toml 依赖**

在 `packages/jackcom/src-tauri/Cargo.toml` 中：
- 移除 `tauri-plugin-log = "2"` 行
- 移除 `log = "0.4"` 行
- 在 `[dependencies]` 末尾添加：

```toml
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"
```

- [ ] **步骤 2：创建 logging.rs**

创建 `packages/jackcom/src-tauri/src/logging.rs`：

```rust
use std::path::Path;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// 初始化 tracing 日志系统
/// 返回 WorkerGuard，必须保持存活直到应用退出
pub fn init(app_name: &str, log_dir: &Path) -> WorkerGuard {
    std::fs::create_dir_all(log_dir).ok();

    let file_appender = rolling::daily(log_dir, format!("{app_name}.log"));
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = if cfg!(debug_assertions) {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("info")
    };

    let file_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false);

    // dev 模式同时输出到 stdout，release 模式仅写文件
    let stdout_layer = if cfg!(debug_assertions) {
        Some(fmt::layer().with_writer(std::io::stdout))
    } else {
        None
    };

    tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer)
        .with(stdout_layer)
        .init();

    guard
}

/// 获取 jackcom 日志目录: ~/.jackit/toolbox/tools/jackcom/log/
pub fn get_log_dir() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".jackit").join("toolbox").join("tools").join("jackcom").join("log")
}
```

- [ ] **步骤 3：创建 commands/log.rs**

创建 `packages/jackcom/src-tauri/src/commands/log.rs`：

```rust
#[tauri::command]
pub fn log_info(module: String, message: String) {
    tracing::info!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
pub fn log_warn(module: String, message: String) {
    tracing::warn!(target: "frontend", "[{}] {}", module, message);
}

#[tauri::command]
pub fn log_error(module: String, message: String) {
    tracing::error!(target: "frontend", "[{}] {}", module, message);
}
```

- [ ] **步骤 4：注册 log 模块到 commands/mod.rs**

修改 `packages/jackcom/src-tauri/src/commands/mod.rs`：

```rust
pub mod config;
pub mod data;
pub mod log;
pub mod serial;
pub mod types;

pub use config::{get_config, list_recent_sessions, save_config};
pub use data::{export_data, query_history};
pub use serial::{close_all, close_port, enumerate_ports, open_port, send_data};
```

- [ ] **步骤 5：替换 broker.rs 中的 log:: 调用**

在 `packages/jackcom/src-tauri/src/channel/broker.rs` 中，将所有 `log::warn!`、`log::debug!`、`log::info!` 替换为 `tracing::warn!`、`tracing::debug!`、`tracing::info!`。

具体替换（6 处）：
- `log::warn!("Broker: 数据事件发布失败` → `tracing::warn!("Broker: 数据事件发布失败`
- `log::warn!("Broker: 端口打开事件发布失败` → `tracing::warn!("Broker: 端口打开事件发布失败`
- `log::warn!("Broker: 端口关闭事件发布失败` → `tracing::warn!("Broker: 端口关闭事件发布失败`
- `log::warn!("Broker: 端口错误事件发布失败` → `tracing::warn!("Broker: 端口错误事件发布失败`
- `log::warn!("Broker: 端口变更事件发布失败` → `tracing::warn!("Broker: 端口变更事件发布失败`
- `log::debug!("Broker: 清理` → `tracing::debug!("Broker: 清理`

- [ ] **步骤 6：修改 lib.rs**

修改 `packages/jackcom/src-tauri/src/lib.rs`：

1. 添加 `mod logging;` 声明
2. 添加 `use tracing_appender::non_blocking::WorkerGuard;`
3. 添加 `struct LogGuard(WorkerGuard);`
4. 在 `pub fn run()` 开头初始化日志：
   ```rust
   let log_dir = logging::get_log_dir();
   let guard = logging::init("jackcom", &log_dir);
   tracing::info!("app started");
   ```
5. 移除 `.plugin(tauri_plugin_log::Builder::new().build())` 行
6. 添加 `.manage(LogGuard(guard))`（在 `.manage(AppState::new(...))` 之前）
7. 将 `log::info!("数据库初始化成功")` 替换为 `tracing::info!("database initialized")`
8. 将 `log::error!("数据库初始化失败: {}", e)` 替换为 `tracing::error!("database init failed: {}", e)`
9. 将 `log::info!("Tauri event bridge stopped")` 替换为 `tracing::info!("tauri event bridge stopped")`
10. 在 `invoke_handler` 中添加 log command：
    ```rust
    commands::log::log_info,
    commands::log::log_warn,
    commands::log::log_error,
    ```

- [ ] **步骤 7：移除 tauri.conf.json 中的 plugins.log**

在 `packages/jackcom/src-tauri/tauri.conf.json` 的 `plugins` 对象中，移除 `"log": null` 行。

- [ ] **步骤 8：移除前端 @tauri-apps/plugin-log 依赖**

在 `packages/jackcom/package.json` 中，移除 `"@tauri-apps/plugin-log": "catalog:"` 行。

- [ ] **步骤 9：创建前端 logger.ts**

创建 `packages/jackcom/src/lib/logger.ts`：

```typescript
import { invoke } from '@tauri-apps/api/core'

export const logger = {
  info: (module: string, message: string) => invoke('log_info', { module, message }),
  warn: (module: string, message: string) => invoke('log_warn', { module, message }),
  error: (module: string, message: string) => invoke('log_error', { module, message }),
}
```

- [ ] **步骤 10：验证编译**

运行：`cd packages/jackcom/src-tauri && cargo check`
预期：编译通过，无错误

- [ ] **步骤 11：Commit**

```bash
git add packages/jackcom/
git commit -m "feat(jackcom): 迁移日志系统从 tauri-plugin-log 到 tracing"
```

---

### 任务 3：Toolbox 日志迁移（plugin-log → tracing）

**文件：**
- 修改：`packages/toolbox/src-tauri/Cargo.toml`
- 创建：`packages/toolbox/src-tauri/src/logging.rs`
- 修改：`packages/toolbox/src-tauri/src/lib.rs`
- 修改：`packages/toolbox/package.json`
- 创建：`packages/toolbox/src/lib/logger.ts`

注意：Toolbox 的 lib.rs 结构不同于 jacc/jackcom——它没有 `commands/` 目录，所有 command 直接定义在 `lib.rs` 中。因此 log command 也直接写在 `lib.rs` 中。

- [ ] **步骤 1：修改 Cargo.toml 依赖**

在 `packages/toolbox/src-tauri/Cargo.toml` 中：
- 移除 `tauri-plugin-log = "2"` 行
- 在 `[dependencies]` 末尾添加：

```toml
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"
```

- [ ] **步骤 2：创建 logging.rs**

创建 `packages/toolbox/src-tauri/src/logging.rs`：

```rust
use std::path::Path;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// 初始化 tracing 日志系统
/// 返回 WorkerGuard，必须保持存活直到应用退出
pub fn init(app_name: &str, log_dir: &Path) -> WorkerGuard {
    std::fs::create_dir_all(log_dir).ok();

    let file_appender = rolling::daily(log_dir, format!("{app_name}.log"));
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = if cfg!(debug_assertions) {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("info")
    };

    let file_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false);

    // dev 模式同时输出到 stdout，release 模式仅写文件
    let stdout_layer = if cfg!(debug_assertions) {
        Some(fmt::layer().with_writer(std::io::stdout))
    } else {
        None
    };

    tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer)
        .with(stdout_layer)
        .init();

    guard
}

/// 获取 toolbox 日志目录: ~/.jackit/toolbox/log/
pub fn get_log_dir() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".jackit").join("toolbox").join("log")
}
```

- [ ] **步骤 3：修改 lib.rs**

修改 `packages/toolbox/src-tauri/src/lib.rs`：

1. 在文件顶部添加 `mod logging;`
2. 添加 `use tracing_appender::non_blocking::WorkerGuard;`
3. 在 `AppState` struct 之前添加：
   ```rust
   struct LogGuard(WorkerGuard);
   ```
4. 在 `AppState` 之后、第一个 `#[tauri::command]` 之前添加 log command：
   ```rust
   #[tauri::command]
   fn log_info(module: String, message: String) {
       tracing::info!(target: "frontend", "[{}] {}", module, message);
   }

   #[tauri::command]
   fn log_warn(module: String, message: String) {
       tracing::warn!(target: "frontend", "[{}] {}", module, message);
   }

   #[tauri::command]
   fn log_error(module: String, message: String) {
       tracing::error!(target: "frontend", "[{}] {}", module, message);
   }
   ```
5. 在 `pub fn run()` 中：
   - 在 `let cfg = config::load()...` 之前添加：
     ```rust
     let log_dir = logging::get_log_dir();
     let guard = logging::init("toolbox", &log_dir);
     tracing::info!("app started");
     ```
   - 移除 `.plugin(tauri_plugin_log::Builder::new().build())` 行
   - 在 `.manage(AppState { db, cfg })` 之前添加 `.manage(LogGuard(guard))`
   - 在 `let db = db::Database::new(&cfg)...` 之后添加 `tracing::info!("database initialized");`
   - 在 `invoke_handler` 的 handler 列表开头添加：
     ```rust
     log_info,
     log_warn,
     log_error,
     ```

- [ ] **步骤 4：移除前端 @tauri-apps/plugin-log 依赖**

在 `packages/toolbox/package.json` 中，移除 `"@tauri-apps/plugin-log": "catalog:"` 行。

- [ ] **步骤 5：创建前端 logger.ts**

创建 `packages/toolbox/src/lib/logger.ts`：

```typescript
import { invoke } from '@tauri-apps/api/core'

export const logger = {
  info: (module: string, message: string) => invoke('log_info', { module, message }),
  warn: (module: string, message: string) => invoke('log_warn', { module, message }),
  error: (module: string, message: string) => invoke('log_error', { module, message }),
}
```

- [ ] **步骤 6：验证编译**

运行：`cd packages/toolbox/src-tauri && cargo check`
预期：编译通过，无错误

- [ ] **步骤 7：Commit**

```bash
git add packages/toolbox/
git commit -m "feat(toolbox): 迁移日志系统从 tauri-plugin-log 到 tracing"
```

---

## 规格覆盖度自检

| 规格需求 | 对应任务 |
|---------|---------|
| tracing + tracing-subscriber + tracing-appender | 任务 1-3 步骤 1 |
| 日志路径 ~/.jackit/toolbox/log/ | 任务 3 步骤 2 (get_log_dir) |
| 日志路径 ~/.jackit/toolbox/tools/jackcom/log/ | 任务 2 步骤 2 (get_log_dir) |
| 日志路径 ~/.jackit/toolbox/tools/jacc/log/ | 任务 1 步骤 2 (get_log_dir) |
| 前端 Tauri command 桥接 | 任务 1-3 (commands/log.rs 或 lib.rs 内 command) |
| 前端 logger.ts 封装 | 任务 1-3 (logger.ts) |
| 按天轮转 | 任务 1-3 步骤 2 (rolling::daily) |
| dev DEBUG + stdout / release INFO + 文件 | 任务 1-3 步骤 2 (cfg!(debug_assertions) 分支) |
| 移除 tauri-plugin-log | 任务 2 步骤 1,6,7,8 / 任务 3 步骤 1,3,4 |
| log:: → tracing:: 迁移 | 任务 2 步骤 5,6 |
| WorkerGuard 保持存活 | 任务 1-3 (LogGuard struct + manage) |
| 应用启动日志 | 任务 1-3 (tracing::info!("app started")) |
| 数据库初始化日志 | 任务 1 步骤 5, 任务 2 步骤 6 |
| 不变更 capabilities/permissions | 确认：log command 不需要额外权限 ✓ |
