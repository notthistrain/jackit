# 统一日志模块设计

## 背景

jackit monorepo 的三个 Tauri 桌面应用（toolbox、jackcom、jacc）缺乏统一的日志系统。JackCom 有 tauri-plugin-log 但路径不符合规范，Toolbox 有插件但未使用，Jacc 完全没有日志。需要统一为 tracing 方案，日志写入各自工作目录的 `log/` 子目录。

## 目标

1. 三个 app 统一使用 `tracing` + `tracing-subscriber` + `tracing-appender` 作为日志后端
2. 日志文件保存在各自工作目录的 `log/` 子目录
3. 前端通过 Tauri command 桥接到 tracing 系统
4. 按天轮转 + 大小限制双重策略
5. dev 模式输出 DEBUG 到 stdout + 文件，release 模式输出 INFO 到文件

## 日志路径

按项目数据目录规范（`~/.jackit/` 下）：

| App | 日志目录 |
|-----|---------|
| toolbox | `~/.jackit/toolbox/log/` |
| jackcom | `~/.jackit/toolbox/tools/jackcom/log/` |
| jacc | `~/.jackit/toolbox/tools/jacc/log/` |

## 架构

### Rust 后端

每个 app 在启动时初始化 tracing subscriber：

```rust
use tracing_appender::rolling;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init_logging(app_name: &str, log_dir: &Path) {
    let file_appender = rolling::daily(log_dir, format!("{app_name}.log"));
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

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

    let registry = tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer);

    if cfg!(debug_assertions) {
        registry.with(fmt::layer().with_writer(std::io::stdout)).init();
    } else {
        registry.init();
    }
}
```

`_guard` 必须保持存活直到应用退出（存储在 Tauri managed state 中）。

### 日志级别策略

| 环境 | 级别 | 输出目标 |
|------|------|---------|
| dev（`debug_assertions`） | DEBUG+ | stdout + 文件 |
| release | INFO+ | 仅文件 |

### 轮转策略

- **按天轮转**：`tracing_appender::rolling::daily()` — 每天生成新文件
- **文件命名**：`{app}.2026-05-17.log`
- **大小限制**：桌面应用日志量有限，按天轮转已足够。如后续单日日志过大，再引入 `rolling-file` crate 补充大小限制。

### 前端桥接

暴露 Tauri command 供前端调用：

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

前端封装 `logger.ts`：

```typescript
import { invoke } from '@tauri-apps/api/core'

export const logger = {
  info: (module: string, message: string) => invoke('log_info', { module, message }),
  warn: (module: string, message: string) => invoke('log_warn', { module, message }),
  error: (module: string, message: string) => invoke('log_error', { module, message }),
}
```

### 后端日志点

| 类别 | 级别 | 示例消息 |
|------|------|---------|
| 应用启动 | INFO | `"app started"` |
| 应用关闭 | INFO | `"app shutting down"` |
| 数据库初始化成功 | INFO | `"database initialized"` |
| 数据库初始化失败 | ERROR | `"database init failed: {err}"` |
| 数据库迁移 | INFO | `"migration completed"` |
| HTTP 请求 | DEBUG | `"HTTP {method} {url}"` |
| 文件系统操作失败 | ERROR | `"file write failed: {path}: {err}"` |
| 模型绑定（jacc） | INFO | `"model bound: {alias} -> {slot}"` |
| 串口连接（jackcom） | INFO | `"serial port opened: {port}"` |
| 串口断开（jackcom） | INFO | `"serial port closed: {port}"` |

## 变更范围

### Jacc（新增）

- `Cargo.toml`：添加 `tracing`, `tracing-subscriber`, `tracing-appender` 依赖
- `src/lib.rs`：初始化 tracing，注册 log command
- 新增 `src/logging.rs`：日志初始化逻辑
- 新增 `src/commands/log.rs`：前端桥接 command
- 前端新增 `src/lib/logger.ts`
- 在关键操作处添加日志调用

### JackCom（迁移）

- `Cargo.toml`：移除 `tauri-plugin-log`，添加 `tracing`, `tracing-subscriber`, `tracing-appender`
- `src/lib.rs`：替换 plugin 初始化为 tracing 初始化，注册 log command
- 新增 `src/logging.rs`：日志初始化逻辑
- 新增 `src/commands/log.rs`：前端桥接 command
- 将现有 `log::info!()` / `log::error!()` / `log::warn!()` 替换为 `tracing::info!()` 等
- `tauri.conf.json`：移除 `plugins.log` 配置
- `package.json`：移除 `@tauri-apps/plugin-log` 依赖
- 前端新增 `src/lib/logger.ts`

### Toolbox（迁移）

- `Cargo.toml`：移除 `tauri-plugin-log`，添加 `tracing`, `tracing-subscriber`, `tracing-appender`
- `src/lib.rs`：替换 plugin 初始化为 tracing 初始化，注册 log command
- 新增 `src/logging.rs`：日志初始化逻辑
- 新增 `src/commands/log.rs`：前端桥接 command
- `package.json`：移除 `@tauri-apps/plugin-log` 依赖
- 前端新增 `src/lib/logger.ts`

### 共享（可选）

三个 app 的 `logging.rs` 和前端 `logger.ts` 逻辑相同，但由于各 app 是独立 crate/package，不抽取共享库，各自维护一份（代码量小，约 30 行 Rust + 10 行 TS）。

## 依赖版本

```toml
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"
```

## 不变更

- 数据库 schema
- 前端 UI
- 现有功能逻辑
- tauri.conf.json 的 capabilities/permissions（log command 不需要额外权限）
