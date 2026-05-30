# jacc Plan3：watchfile + drift 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 监听 `~/.claude/settings.json` 与当前项目级 `.claude/settings.json` 的变动，发 Tauri event；扩展 `get_slot_bindings` 返回 intent + actual + matches，前端据此显示 drift 徽标。

**架构：** `notify` + `notify-debouncer-mini` 监听文件变动 → debounce 300ms → Tauri emit `settings-changed`；`get_slot_bindings` 同时读 DB intent 与 settings.json 实际值，后端比明文 api_key，回前端只回 bool。

**技术栈：** Rust, Tauri 2, notify 6, notify-debouncer-mini 0.4

**前置依赖：** plan1 已完成（claude_settings 模块）。可与 plan2 并行（不互相依赖）。

**设计文档：** `docs/superpowers/specs/2026-05-30-jacc-backend-consistency-design.md` 第 4 节

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/jacc/src-tauri/Cargo.toml` | 修改：加 notify + notify-debouncer-mini |
| `packages/jacc/src-tauri/src/settings_watcher.rs` | 创建：watcher + Tauri emit |
| `packages/jacc/src-tauri/src/commands/active_project.rs` | 创建：set_active_project 命令 |
| `packages/jacc/src-tauri/src/commands/slots.rs` | 修改：get_slot_bindings 扩展为 intent+actual+matches |
| `packages/jacc/src-tauri/src/commands/mod.rs` | 修改：注册 active_project 模块 |
| `packages/jacc/src-tauri/src/lib.rs` | 修改：setup 启动 watcher，注册命令 |
| `packages/jacc/src/...` (前端) | 修改：订阅 settings-changed，渲染 drift 徽标 |

---

### 任务 1：引入依赖

**文件：**
- 修改：`packages/jacc/src-tauri/Cargo.toml`

- [ ] **步骤 1：在 [dependencies] 段追加**

```toml
notify = "6"
notify-debouncer-mini = "0.4"
```

- [ ] **步骤 2：cargo build 拉取依赖**

运行：`cd packages/jacc/src-tauri && cargo build`
预期：拉取依赖、编译通过。

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/Cargo.toml packages/jacc/src-tauri/Cargo.lock
git commit -m "chore(jacc): 引入 notify + notify-debouncer-mini"
```

---

### 任务 2：settings_watcher 模块

**文件：**
- 创建：`packages/jacc/src-tauri/src/settings_watcher.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：创建 settings_watcher.rs**

```rust
use notify::{RecursiveMode, RecommendedWatcher};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct SettingsChangedEvent {
    pub scope: String,  // "global" | "project"
    pub path: String,
}

pub struct SettingsWatcher {
    debouncer: Debouncer<RecommendedWatcher>,
    project: Arc<Mutex<Option<PathBuf>>>,
}

impl SettingsWatcher {
    pub fn start(app: AppHandle, global_path: PathBuf) -> notify::Result<Self> {
        let project: Arc<Mutex<Option<PathBuf>>> = Arc::new(Mutex::new(None));
        let project_clone = project.clone();
        let global_clone = global_path.clone();
        let app_clone = app.clone();

        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            move |res: DebounceEventResult| {
                let events = match res {
                    Ok(e) => e,
                    Err(err) => {
                        tracing::warn!(?err, "watcher debounce error");
                        return;
                    }
                };
                for ev in events {
                    let p = ev.path.clone();
                    let scope = if p == global_clone {
                        Some("global")
                    } else if let Ok(guard) = project_clone.lock() {
                        match &*guard {
                            Some(pp) if &p == pp => Some("project"),
                            _ => None,
                        }
                    } else { None };
                    if let Some(scope) = scope {
                        let payload = SettingsChangedEvent {
                            scope: scope.to_string(),
                            path: p.to_string_lossy().to_string(),
                        };
                        if let Err(err) = app_clone.emit("settings-changed", &payload) {
                            tracing::warn!(?err, "failed to emit settings-changed");
                        } else {
                            tracing::info!(scope, path = %payload.path, "settings-changed emitted");
                        }
                    }
                }
            },
        )?;

        // 监听全局：注意 watch 的是父目录非文件本身（notify 限制）
        if let Some(parent) = global_path.parent() {
            std::fs::create_dir_all(parent).ok();
            debouncer.watcher().watch(parent, RecursiveMode::NonRecursive)?;
        }

        Ok(Self { debouncer, project })
    }

    pub fn set_active_project(&self, path: Option<PathBuf>) -> notify::Result<()> {
        let mut guard = self.project.lock().unwrap();
        // 卸载旧 project watch
        if let Some(old) = guard.take() {
            if let Some(parent) = old.parent() {
                let _ = self.debouncer.watcher().unwatch(parent);
            }
        }
        // 装载新 project watch
        if let Some(new_path) = path {
            if let Some(parent) = new_path.parent() {
                std::fs::create_dir_all(parent).ok();
                self.debouncer.watcher().watch(parent, RecursiveMode::NonRecursive)?;
            }
            *guard = Some(new_path);
        }
        Ok(())
    }
}
```

- [ ] **步骤 2：在 lib.rs 注册模块 + setup 中启动 watcher**

`lib.rs` 顶部：

```rust
mod settings_watcher;
```

`setup` 闭包内（已有 `app.manage(pool)` 之后）追加：

```rust
let global = claude_settings::global_settings_path();
match settings_watcher::SettingsWatcher::start(app.handle().clone(), global) {
    Ok(w) => { app.manage(std::sync::Mutex::new(w)); tracing::info!("settings watcher started"); }
    Err(e) => tracing::error!(?e, "settings watcher start failed"),
}
```

- [ ] **步骤 3：cargo build 通过**

运行：`cargo build`
预期：编译通过。

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/settings_watcher.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): settings_watcher 监听全局 settings.json"
```

---

### 任务 3：set_active_project 命令

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/active_project.rs`
- 修改：`packages/jacc/src-tauri/src/commands/mod.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：创建 active_project.rs**

```rust
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn set_active_project(
    watcher: State<'_, Mutex<crate::settings_watcher::SettingsWatcher>>,
    path: Option<String>,
) -> AppResult<()> {
    log_command!("set_active_project", {
        let project_path = match path {
            None => None,
            Some(s) if s.is_empty() => None,
            Some(s) => {
                let p = PathBuf::from(&s);
                if !p.is_dir() {
                    return Err(AppError::Custom(format!("INVALID_PROJECT_PATH:{}", s)));
                }
                Some(crate::claude_settings::project_settings_path(&p))
            }
        };
        let w = watcher.lock().map_err(|e| AppError::Custom(format!("watcher lock: {e}")))?;
        w.set_active_project(project_path).map_err(|e| AppError::Custom(format!("watcher: {e}")))?;
        Ok(())
    })
}
```

- [ ] **步骤 2：在 mod.rs 注册**

`commands/mod.rs` 追加：`pub mod active_project;`

- [ ] **步骤 3：在 lib.rs invoke_handler 注册命令**

```rust
commands::active_project::set_active_project,
```

- [ ] **步骤 4：cargo build 通过**

运行：`cargo build`

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/active_project.rs \
        packages/jacc/src-tauri/src/commands/mod.rs \
        packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): set_active_project 命令"
```

---

### 任务 4：get_slot_bindings 扩展为 intent + actual + matches

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/slots.rs`

- [ ] **步骤 1：编写失败的测试**

```rust
#[tokio::test]
async fn get_slot_bindings_full_returns_match_when_aligned() {
    let pool = setup_test_db().await;
    let mid = insert_full_model(&pool, "A", "https://a.com", "sk-aaa12345", "m").await;
    let dir = tempfile::tempdir().unwrap();
    let settings_path = dir.path().join("settings.json");
    bind_slot_at(&pool, "opus", mid, &settings_path).await.unwrap();

    let full = get_slot_bindings_full_at(&pool, &settings_path).await.unwrap();
    assert_eq!(full.len(), 1);
    let b = &full[0];
    assert_eq!(b.intent.slot, "opus");
    assert_eq!(b.actual.model_name.as_deref(), Some("m"));
    assert!(b.matches.model_name);
    assert!(b.matches.base_url);
    assert!(b.matches.api_key);
}

#[tokio::test]
async fn get_slot_bindings_full_detects_drift() {
    let pool = setup_test_db().await;
    let mid = insert_full_model(&pool, "A", "https://a.com", "sk-aaa12345", "m").await;
    let dir = tempfile::tempdir().unwrap();
    let settings_path = dir.path().join("settings.json");
    bind_slot_at(&pool, "opus", mid, &settings_path).await.unwrap();
    // 模拟外部修改：把 token 改了
    crate::claude_settings::write_slot_env(
        &settings_path, "opus", "https://a.com", "sk-EXTERNAL", "m"
    ).await.unwrap();

    let full = get_slot_bindings_full_at(&pool, &settings_path).await.unwrap();
    assert!(!full[0].matches.api_key);
    assert!(full[0].matches.model_name);
    assert!(full[0].matches.base_url);
}
```

- [ ] **步骤 2：运行测试确认失败**

运行：`cargo test get_slot_bindings_full`
预期：FAIL，函数未定义。

- [ ] **步骤 3：实现 SlotBindingFull / get_slot_bindings_full_at**

在 `slots.rs` 顶部新增类型定义：

```rust
#[derive(Debug, Serialize)]
pub struct ActualSlotEnv {
    pub model_name: Option<String>,
    pub base_url: Option<String>,
    pub api_key_masked: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SlotMatchFlags {
    pub model_name: bool,
    pub base_url: bool,
    pub api_key: bool,
}

#[derive(Debug, Serialize)]
pub struct SlotBindingFull {
    pub intent: SlotBindingIntent,
    pub actual: ActualSlotEnv,
    pub matches: SlotMatchFlags,
}
```

实现：

```rust
fn slot_default_env_key(slot: &str) -> &'static str {
    match slot {
        "opus" => "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "sonnet" => "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "haiku" => "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        _ => "ANTHROPIC_MODEL",
    }
}

pub(crate) async fn get_slot_bindings_full_at(
    pool: &SqlitePool,
    settings_path: &std::path::Path,
) -> AppResult<Vec<SlotBindingFull>> {
    // intent
    let rows = sqlx::query_as::<_, (String, i64, String, Option<String>, String, String, String, i64)>(
        "SELECT ms.slot, ms.model_id, m.model_name, ms.context_size,
                ak.api_key, p.base_url, p.name, p.id
         FROM model_slots ms
         JOIN models m ON ms.model_id = m.id
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         ORDER BY ms.slot",
    ).fetch_all(pool).await?;

    let settings = crate::claude_settings::read(settings_path).await
        .unwrap_or_else(|_| serde_json::json!({}));
    let env = settings.get("env").cloned().unwrap_or(serde_json::json!({}));

    let mut out = Vec::new();
    for (slot, model_id, model_name, _ctx, api_key, base_url, provider_name, provider_id) in rows {
        let env_model_key = slot_default_env_key(&slot);
        let actual_model = env.get(env_model_key).and_then(|v| v.as_str()).map(String::from);
        let actual_base = env.get("ANTHROPIC_BASE_URL").and_then(|v| v.as_str()).map(String::from);
        let actual_token = env.get("ANTHROPIC_AUTH_TOKEN").and_then(|v| v.as_str()).map(String::from);

        let matches = SlotMatchFlags {
            model_name: actual_model.as_deref() == Some(model_name.as_str()),
            base_url: actual_base.as_deref() == Some(base_url.as_str()),
            api_key: actual_token.as_deref() == Some(api_key.as_str()),
        };
        let actual = ActualSlotEnv {
            model_name: actual_model,
            base_url: actual_base,
            api_key_masked: actual_token.as_deref().map(mask_api_key),
        };
        out.push(SlotBindingFull {
            intent: SlotBindingIntent {
                slot,
                model_id,
                model_name,
                provider_id,
                provider_name,
                base_url,
                api_key_masked: mask_api_key(&api_key),
                context_size: None,
            },
            actual,
            matches,
        });
    }
    Ok(out)
}
```

`get_slot_bindings` Tauri 命令改为返回 `Vec<SlotBindingFull>`，调 `get_slot_bindings_full_at(pool, &claude_settings::global_settings_path())`。

- [ ] **步骤 4：cargo test 通过**

运行：`cargo test commands::slots`

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/slots.rs
git commit -m "feat(jacc): get_slot_bindings 扩展 intent+actual+matches"
```

---

### 任务 5：watchfile 集成测试

**文件：**
- 创建：`packages/jacc/src-tauri/tests/integration_watcher.rs`

- [ ] **步骤 1：编写集成测试**

```rust
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use notify::RecursiveMode;
use notify_debouncer_mini::new_debouncer;

#[test]
fn watcher_emits_event_on_external_modify() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("settings.json");
    std::fs::write(&target, b"{}").unwrap();

    let received: Arc<Mutex<Vec<PathBuf>>> = Arc::new(Mutex::new(Vec::new()));
    let received_clone = received.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(300), move |res: notify_debouncer_mini::DebounceEventResult| {
        if let Ok(events) = res {
            for e in events {
                received_clone.lock().unwrap().push(e.path);
            }
        }
    }).unwrap();
    debouncer.watcher().watch(dir.path(), RecursiveMode::NonRecursive).unwrap();

    // 触发修改
    std::fs::write(&target, br#"{"model":"opus"}"#).unwrap();

    // Windows CI debounce + IO 延迟可能 ~1.5s，等 5s
    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    while std::time::Instant::now() < deadline {
        if !received.lock().unwrap().is_empty() {
            break;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    let r = received.lock().unwrap();
    assert!(!r.is_empty(), "expected at least one event within 5s");
    assert!(r.iter().any(|p| p == &target), "expected event for target file");
}
```

> Windows CI 上偶现 flake，允许 retry 一次（可在 GH Actions 工作流加 `continue-on-error: false` + 单步 retry，或在测试用 `#[ignore]` 标记后改为本地手动验证）。

- [ ] **步骤 2：运行集成测试**

运行：`cd packages/jacc/src-tauri && cargo test --test integration_watcher`
预期：通过。

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/tests/integration_watcher.rs
git commit -m "test(jacc): watchfile 集成测试"
```

---

### 任务 6：前端订阅 + drift 徽标渲染（前端）

**文件：**
- 修改：`packages/jacc/src/` 下涉及 slot 列表的组件（具体文件由实施时按现有 React 代码定位）
- 修改：前端调用 `set_active_project` 的位置（项目切换时）

- [ ] **步骤 1：定位 slot 列表组件**

在 `packages/jacc/src/` 内 grep `get_slot_bindings` 找到调用方；该组件即是要改的位置。

- [ ] **步骤 2：订阅 settings-changed event**

在该组件 `useEffect` 内：

```ts
import { listen } from '@tauri-apps/api/event';
useEffect(() => {
  const unlisten = listen<{ scope: string; path: string }>('settings-changed', () => {
    // 重新拉
    refreshBindings();
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

- [ ] **步骤 3：渲染 drift 徽标**

`SlotBindingFull` 的 TS 类型新增：

```ts
export interface ActualSlotEnv { model_name?: string; base_url?: string; api_key_masked?: string; }
export interface SlotMatchFlags { model_name: boolean; base_url: boolean; api_key: boolean; }
export interface SlotBindingFull {
  intent: SlotBindingIntent;
  actual: ActualSlotEnv;
  matches: SlotMatchFlags;
}
```

UI：当 `!matches.model_name || !matches.base_url || !matches.api_key` 时，在 slot 卡片右上角显示一个小徽标 `已偏离`，悬停 tooltip 列出哪几项不匹配（actual 实际值与 intent 配置值）。点击现有"应用"按钮（即 `bind_slot`）即可恢复一致。

- [ ] **步骤 4：项目切换时调 set_active_project**

在前端项目切换/打开 项目的入口：

```ts
import { invoke } from '@tauri-apps/api/core';
await invoke('set_active_project', { path: newProjectPath });
```

退出项目时 `invoke('set_active_project', { path: null })`。

- [ ] **步骤 5：手动验证**

- 启动 jacc dev：`pnpm tauri dev`（在 `packages/jacc/`）
- 绑定一个 opus → 验证 settings.json 已写
- 手编 settings.json 改 token → 验证前端 1 秒内出现"已偏离"徽标
- 点应用 → 徽标消失

- [ ] **步骤 6：Commit + tag**

```bash
git add packages/jacc/src/
git commit -m "feat(jacc): 前端订阅 settings-changed + drift 徽标"
git tag jacc-plan3-done
```

---

## 完成标准

- [ ] `cargo test` 全绿（含 integration_watcher）。
- [ ] notify + notify-debouncer-mini 已加入依赖。
- [ ] `settings_watcher` 在 setup 中启动，全局 settings.json 被监听。
- [ ] `set_active_project` 命令可切换项目级 watch。
- [ ] `get_slot_bindings` 返回 intent+actual+matches。
- [ ] 前端 drift 徽标按 matches 字段渲染。
- [ ] git tag `jacc-plan3-done`。



