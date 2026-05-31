# jacc 后端一致性 / 安全 / 健壮性总体设计

- 日期：2026-05-30
- 范围：`packages/jacc/src-tauri/`
- 起源：代码审查报告（30+ 条 P0~P3 问题，跨 settings 一致性、并发与原子性、安全、日志、重复代码、clippy）
- 目标：把审查问题用一份大设计承接，分 4 个独立 plan 落地

---

## 1. 核心架构

### 1.1 两类视图，单向写 + 反向通知

- **配置意图（intent）= DB `model_slots`**：用户最近一次"我希望 slot=X 绑到 model=Y"的配置。
- **执行状态（state）= `settings.json`**：Claude Code 实际读取的文件；可能被外部工具改动。

数据流：

```
DB 变动  ──同步写──▶  settings.json
settings.json 外部变动  ──notify──▶  Tauri event  ──▶  前端刷新
```

### 1.2 进程内全局 Mutex

所有 settings.json 的"读 → 改 → 写"必须经过 `static SETTINGS_LOCK: tokio::sync::Mutex<()>` 串行化，避免 race / lost update。

**不变量**：持锁期内不得 spawn 任何会再次锁同一个 Mutex 的任务，否则死锁。

### 1.3 原子写

`tempfile::NamedTempFile::new_in(parent_dir)` 同目录创建 → 写内容 → `persist(target)`。Windows / Unix 行为均一致；不跨盘符。

---

## 2. claude_settings 新模块

新文件 `src-tauri/src/claude_settings.rs`，作为所有 settings.json 操作的唯一出口。

### 2.1 对外 API

```rust
// 读
pub async fn read(path: &Path) -> AppResult<serde_json::Value>;
pub async fn read_merged(global: &Path, project: Option<&Path>) -> AppResult<MergedConfig>;
// 注：MergedConfig / MergedConfigItem / ConfigScope 复用 commands/config.rs 已有类型。

// 通用闭包式写（所有写操作的底座）
pub async fn update<F>(path: &Path, mutator: F) -> AppResult<()>
where
    F: FnOnce(&mut serde_json::Map<String, serde_json::Value>) -> AppResult<()>;

// 业务封装（内部均调 update，统一走 Mutex + 原子写）
pub async fn write_slot_env(
    path: &Path,
    slot: &str,
    base_url: &str,
    api_key: &str,
    model_name: &str,
) -> AppResult<()>;

pub async fn clear_slot_env(path: &Path, slot: &str) -> AppResult<()>;

pub async fn set_current_model(
    path: &Path,
    slot: &str,
    context_size: Option<&str>,
) -> AppResult<()>;
// model_name 内部从 DB 查询，不再由调用方传入

pub async fn write_kv(path: &Path, key: &str, value: serde_json::Value) -> AppResult<()>;
pub async fn delete_kv(path: &Path, key: &str) -> AppResult<()>;

// 删除 token 时清环境
pub async fn purge_token(path: &Path, base_url: &str, api_key: &str) -> AppResult<()>;

// 路径
pub fn global_settings_path() -> PathBuf;       // ~/.claude/settings.json
pub fn project_settings_path(project: &Path) -> PathBuf;  // <project>/.claude/settings.json
```

### 2.2 关键约束

- 全局 `static SETTINGS_LOCK: tokio::sync::Mutex<()>`，每次 `update` 都持锁。
- 解析失败 → rename 原文件为 `settings.json.broken-{unix_ts}` 作为备份，写一条 `tracing::warn`，返回 `AppError::SettingsCorrupted { path, backup_path, reason }`。
- 顶层不是 JSON object 时 reset 为空对象 + 一条 warn。
- `commands/config.rs` 的 Tauri 命令入口（`read_merged_config` / `write_config` / `delete_config`）保留命令名作为薄包装，内部全部转调 `claude_settings::*`，前端无感知改动。

---

## 3. bind / unbind / delete 流程改造

### 3.1 bind_slot（绑定即生效）

1. 校验 `slot ∈ {opus, sonnet, haiku}`，否则 `AppError::Custom(format!("INVALID_SLOT:{}", slot))`。
2. 三层 JOIN 查 `model + api_key + provider`。
3. 写 `model_slots`（intent）。
4. 调 `claude_settings::write_slot_env(global, slot, base_url, api_key, model_name)` 写 env。
5. 返回 mask 后的 `SlotBindingIntent`（结构定义见 4.3 节），**不含明文 api_key**。

> 前端拿到 intent 后由 watchfile event 自动触发 `get_slot_bindings` 重拉，从而获得带 actual + matches 的完整数据。

### 3.2 unbind_slot

1. `DELETE FROM model_slots WHERE slot = ?`。
2. `claude_settings::clear_slot_env(global, slot)` 清三个 env 字段（`ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_DEFAULT_*_MODEL`）。
3. 若 settings 顶层 `model == slot`，一并清空 `model` 字段（避免 Claude Code 仍试图用此 slot 但 env 已空）。

### 3.3 delete_provider / delete_api_key / delete_model（统一二次确认）

新增命令：

```rust
preview_delete_impact(kind: "provider"|"api_key"|"model", id: i64)
    -> Vec<ImpactedSlot { slot: String, model_name: String, model_id: i64 }>
```

前端流程：
1. 调 `preview_delete_impact` 拿到受影响 slot 列表；
2. 弹框展示影响项（包括"会同步清理 settings.json env 字段"）；
3. 用户确认后调 `delete_*`：
   - SELECT 出受影响的 `(base_url, api_key)` 列表；
   - DB DELETE（CASCADE 自动清 model_slots）；
   - 对每个 token 调 `purge_token(global, base_url, api_key)`：扫 env，命中即清相关 slot 三件套；
   - 若被清的 slot 当前是 settings 顶层 `model`，一并清。

> 范围限定：删除联动只清理 **全局 settings.json**（`~/.claude/settings.json`），不动任何项目级 `.claude/settings.json`。项目级配置由用户自行管理；watchfile 仍会监测项目级文件变动并通知前端，但后端不主动改写。

### 3.4 update_provider / update_api_key（修改 base_url 或 token）

**update_provider（改 base_url 或 name）**：
1. 先 SELECT 旧 base_url。
2. UPDATE DB。
3. JOIN 找出该 provider 下所有 api_key 关联的 model 关联的 slot，对每个 slot 调 `write_slot_env` 用新 base_url 刷新 env。

**update_api_key（改 api_key 或 name）**：
1. 先 SELECT 旧 api_key。
2. UPDATE DB。
3. JOIN 找出该 api_key 关联的 model 关联的 slot，对每个 slot 调 `write_slot_env` 用新 token 刷新 env。

二者均 **不动** `ANTHROPIC_DEFAULT_*_MODEL`（仅 `update_model.model_name` 变更才会刷 DEFAULT）。

---

## 4. watchfile + drift

### 4.1 依赖

- `notify = "6"`
- `notify-debouncer-mini = "0.4"`（debounce 300ms）

### 4.2 结构

新文件 `src-tauri/src/settings_watcher.rs`：

```rust
pub struct SettingsWatcher { /* … */ }

impl SettingsWatcher {
    pub fn start(app_handle: AppHandle, global_path: PathBuf) -> Self;
    pub fn set_active_project(&self, project_path: Option<PathBuf>);
    pub fn stop(self);
}
```

- `lib.rs::setup` 阶段创建全局 watcher，监听 `~/.claude/settings.json`。
- 新增 Tauri 命令 `set_active_project(path: Option<String>)`：前端打开/切换项目时调用，watcher 内部 swap 项目级 watcher。
- 收到事件 → debounce 300ms → 发 Tauri event：

```jsonc
"settings-changed": { "scope": "global"|"project", "path": "..." }
```

- 前端订阅 `settings-changed`，重新拉 `get_slot_bindings` / `read_merged_config`。

### 4.3 drift 判定（在后端进行）

`get_slot_bindings` 返回扩展结构：

```rust
pub struct SlotBindingIntent {
    pub slot: String,
    pub model_id: i64,
    pub model_name: String,
    pub provider_id: i64,
    pub provider_name: String,
    pub base_url: String,
    pub api_key_masked: String,
    pub context_size: Option<String>,
}

pub struct SlotBindingFull {
    pub intent: SlotBindingIntent,         // 来自 DB JOIN，api_key 已 mask
    pub actual: ActualSlotEnv,             // 来自 settings.json，api_key 已 mask
    pub matches: SlotMatchFlags,           // 后端比明文得出的 bool
}

pub struct ActualSlotEnv {
    pub model_name: Option<String>,
    pub base_url: Option<String>,
    pub api_key_masked: Option<String>,
}

pub struct SlotMatchFlags {
    pub model_name: bool,
    pub base_url: bool,
    pub api_key: bool,
}
```

- 后端在内部用明文比较 api_key，但**只回 bool**给前端，明文不出后端。
- 前端任一 `matches.* == false` → 显示 drift 徽标；用户点现有"应用"按钮（即 `bind_slot`）即可恢复一致。

---

## 5. 安全与健壮性

### 5.1 api_key 全量 mask

- mask 格式：4 头 + 4 尾，例 `sk-ant***ef89`；长度 < 8 时 `***`。
- 移除 `ApiKey` / `SlotBinding` 中暴露明文的字段；前端永远只见 `api_key_masked`。
- 写 settings.json 含明文 token 的逻辑只在后端 `claude_settings` 模块内部完成。

### 5.2 path_guard 模块

新文件 `src-tauri/src/path_guard.rs`：

```rust
pub fn validate_project_path(s: &str) -> AppResult<PathBuf>;
pub fn validate_skill_name(s: &str) -> AppResult<String>;
pub fn validate_temp_dir(s: &str) -> AppResult<PathBuf>;
```

**`validate_project_path`**：必须存在、是目录、canonicalize 后不在系统敏感前缀里。
- Windows 黑名单：`C:\Windows`、`C:\Program Files`、`C:\Program Files (x86)`、`C:\ProgramData`
- Unix 黑名单：`/etc`、`/usr`、`/bin`、`/sbin`、`/System`、`/private`、`/var`

**`validate_skill_name`**：正则 `^[a-zA-Z0-9_-]{1,64}$`。

**`validate_temp_dir`**：canonicalize 后必须 `starts_with(std::env::temp_dir().canonicalize()?)`。

所有命令入口先过 path_guard。

### 5.3 HOME 找不到 → 启动 panic

启动早期：

```rust
let home = dirs::home_dir().expect("HOME not found, jacc cannot start");
tracing::error!(...) // 只有失败时才会打，配 panic_hook
```

移除现有所有 `unwrap_or_else(|| PathBuf::from("."))` 兜底。

### 5.4 test_model 改造

- `Client::builder().timeout(Duration::from_secs(10)).build()`
- 仅 2xx → `CONNECTION_SUCCESS`
- 401/403 → `AUTH_FAILED`
- 其他 → `HTTP_ERROR:{status}`，body 截断 200 字符并把 `sk-` 开头 token-like 子串替换为 `***`

### 5.5 slot 白名单

```rust
pub const ALLOWED_SLOTS: &[&str] = &["opus", "sonnet", "haiku"];

fn validate_slot(s: &str) -> AppResult<()> {
    if ALLOWED_SLOTS.contains(&s) { Ok(()) }
    else { Err(AppError::Custom(format!("INVALID_SLOT:{}", s))) }
}
```

`bind_slot` / `unbind_slot` / `set_current_model` / `clear_slot_env` 入口校验。

### 5.6 install_skill_from_github 防滥用

后端持有：

```rust
use std::sync::OnceLock;
use parking_lot::Mutex;

static INSTALL_TOKENS: OnceLock<Mutex<HashMap<String, (PathBuf, Instant)>>> = OnceLock::new();
```

- `install_skill_from_github` 完成 `git clone` 后生成 UUID token，存入 map，返回 token；
- `confirm_install_skill(token, skill_names)` 通过 token 取出真实路径，校验 path 仍在 `std::env::temp_dir()` 下；
- GC：每次 install/confirm 调用前清扫超过 30 分钟未使用的条目并 `remove_dir_all` 对应临时目录；
- 进程重启时 map 清空 → spec 文档说明"装一半重启需要重新发起 install"。

---

## 6. 迁移 + 日志 + 错误兜底

### 6.1 迁移事务化

- `db.rs::migrate_flat_models` 整体包入 `pool.begin()` … `tx.commit()`；
- 事务内 `PRAGMA defer_foreign_keys = ON`（per-transaction，SQLite 支持）；
- 关键节点 `tracing::info`：开始、旧表行数、provider 去重数、新 model 数、slot 重映射数、完成耗时；
- 失败 `tx.rollback()` + `tracing::error` + panic（启动期只能 panic）；
- 新增"事务回滚"单元测试：注入 INSERT unique 冲突，断言旧表完整保留。

### 6.2 日志改造

- 拆 `log_read_command!`（debug）和 `log_write_command!`（info）两个宏；现有 `log_command!` 调用按读/写归类替换。
- 前端日志限流（`commands/log.rs`）：

```rust
use std::sync::OnceLock;
use parking_lot::Mutex;

// 自实现的简单计数器版 TokenBucket（无需引入 governor 等 crate）：
//   { last_flush: Instant, count_in_window: u32, dropped: u32 }
static FRONTEND_LOG_BUCKET: OnceLock<Mutex<TokenBucket>> = OnceLock::new();
```

- 1s 100 条上限；超额计数器累加；
- 同步检测：每次 `log_*` 调用时检查 `(now - last_flush) > 5s`，是则 flush 一条 warn `"frontend log rate-limited: {N} dropped"` 并清零；
- 不开后台 task。

- 关键写操作日志加 `path` 字段（哪个 settings.json 被写）。

### 6.3 错误兜底

```rust
#[derive(thiserror::Error, Debug)]
pub enum AppError {
    // … 现有 variants …
    #[error("settings.json corrupted at {path}: {reason}")]
    SettingsCorrupted {
        path: String,
        backup_path: String,
        reason: String,  // 来自 serde_json::Error::to_string()
    },
}
```

前端收到此错误弹框：`「settings.json 已损坏，已备份为 {backup_path}，原因：{reason}。是否重置？」`，点"重置"调新增命令 `reset_corrupted_settings(path)` 写空对象。

### 6.4 clippy 清零

- 4 处 `needless_borrows`：去 `&`（api_keys.rs:75 / models.rs:41 / providers.rs:42 + 1 个）；
- 1 处 `manual_strip`（skills.rs:194-195）：改 `strip_prefix`；
- 1 处 dead_code：`write_slot_to_settings_at` 移除（功能并入 `claude_settings::write_slot_env`）；
- CI 加 `cargo clippy --all-targets -- -D warnings`。

---

## 7. 测试策略

**单元测试**：
- `claude_settings::update`：并发写不丢更新、临时文件失败回滚、解析失败时备份并报错；
- `write_slot_env` / `clear_slot_env` / `purge_token` 各一组；
- `path_guard` 三个 validator 各覆盖正/负路径；
- `bind_slot_inner` 改造后：成功时 settings.json 三件套同时写；
- `delete_provider` 删除关联 slot env；
- `update_api_key` 改 token 后 env 同步刷新。

**集成测试**（`tests/` 目录）：
- 完整业务流程：add provider → key → model → bind → 改 token → 验 env 已刷 → 删 provider → 验 env 清空。

**watchfile 集成测试**：
- 临时目录 → 启动 watcher → fs::write 修改 settings.json → 等 event。
- Windows CI 上 timeout ≥ 5s，允许 flaky retry 一次。

**迁移事务测试**：
- 注入 INSERT unique 冲突 → 断言整个回滚 + 旧 models 表完整保留。

---

## 8. 依赖与落地节奏

### 8.1 Cargo.toml 增减

新增：
- `notify = "6"`
- `notify-debouncer-mini = "0.4"`
- `parking_lot = "0.12"`

调整：
- `tempfile` 从 `dev-dependencies` 移到 `dependencies`（生产路径需要用）。

### 8.2 落地 plan 拆分

**plan1: claude-settings-module（底座，~6 task）**
- `claude_settings.rs` 模块创建
- `AtomicJsonWriter`（tempfile + persist）
- 全局 Mutex
- 解析失败备份机制
- `AppError::SettingsCorrupted`
- `path_guard.rs` 模块创建（仅创建 + 单元测试，**不接入命令**）

**plan2: bind-and-delete-cascade（~7 task，依赖 plan1）**
- bind_slot 改造为同步写 settings env
- unbind_slot 联动清理
- `preview_delete_impact` 新命令
- delete_provider/api_key/model 联动 purge_token
- update_provider/update_api_key 同步刷
- 集成测试

**plan3: watchfile-and-drift（~6 task，依赖 plan1）**
- 引入 `notify` + `notify-debouncer-mini` 依赖
- `settings_watcher.rs`
- `set_active_project` 命令
- `get_slot_bindings` 扩展为 `intent + actual + matches`
- watchfile 集成测试
- 前端 drift 渲染（标注「前端」task）

**plan4: security-and-cleanup（~9 task，独立）**
- mask 4+4
- path_guard 接入所有命令入口
- HOME panic
- test_model 超时 + 仅 2xx + 脱敏
- slot 白名单
- install token map + GC
- 迁移事务化 + 启动日志
- 读写宏拆分 + 前端限流
- clippy 清零 + CI gate

### 8.3 回滚预案

- 每个 plan 完成时打 git tag：`jacc-plan1-done` / `jacc-plan2-done` / …
- plan 内严格 commit-by-task，便于单步 revert。
- plan2/3 共依赖 plan1 完成，但二者之间互不依赖，可并行。
- plan4 全程独立，可与 plan1~3 并行。

---

## 9. 不在本设计范围内

- 前端组件库重构（drift 徽标用现有组件）。
- Tauri 升级、sqlx 升级。
- 新增"导出/导入配置"、"配置文件版本号"等新功能。
- jacc 之外的 toolbox / jackcom 改造。
