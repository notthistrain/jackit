# jacc Plan1：claude_settings 模块（底座）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 新建 `claude_settings` 与 `path_guard` 模块，集中处理 settings.json 的并发安全 + 原子写 + 解析失败备份。

**架构：** 全局 `tokio::sync::Mutex` 串行化所有 settings.json 读改写；`tempfile::NamedTempFile::persist` 实现原子替换；解析失败时把原文件 rename 为 `.broken-{ts}` 备份并抛 `AppError::SettingsCorrupted`。`path_guard` 仅创建 + 单元测试，本 plan 不接入命令。

**技术栈：** Rust, tokio, serde_json, tempfile, thiserror

**前置依赖：** 无（独立模块，不改动现有命令）

**设计文档：** `docs/superpowers/specs/2026-05-30-jacc-backend-consistency-design.md` 第 1、2、5.2 节

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/jacc/src-tauri/src/claude_settings.rs` | 创建：settings.json 集中读写模块 |
| `packages/jacc/src-tauri/src/path_guard.rs` | 创建：路径校验工具（仅创建+测试） |
| `packages/jacc/src-tauri/src/error.rs` | 修改：新增 `SettingsCorrupted` variant |
| `packages/jacc/src-tauri/src/lib.rs` | 修改：注册 `mod claude_settings; mod path_guard;` |
| `packages/jacc/src-tauri/Cargo.toml` | 修改：`tempfile` 从 dev 移到正式依赖 |

---

### 任务 1：扩展 AppError 与依赖项

**文件：**
- 修改：`packages/jacc/src-tauri/src/error.rs`
- 修改：`packages/jacc/src-tauri/Cargo.toml`

- [ ] **步骤 1：编辑 Cargo.toml，把 tempfile 移到正式依赖**

把 `tempfile = "3"` 从 `[dev-dependencies]` 段移到 `[dependencies]` 段（保持版本不变）。

- [ ] **步骤 2：扩展 error.rs**

在 `AppError` enum 末尾追加新 variant：

```rust
#[error("settings.json corrupted at {path}: {reason}")]
SettingsCorrupted {
    path: String,
    backup_path: String,
    reason: String,
},
```

- [ ] **步骤 3：cargo check 确认编译**

运行：`cd packages/jacc/src-tauri && cargo check`
预期：通过，仅可能有 dead_code 警告（`SettingsCorrupted` 暂未使用）。

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/Cargo.toml packages/jacc/src-tauri/src/error.rs
git commit -m "chore(jacc): tempfile 升正式依赖 + AppError::SettingsCorrupted"
```

---

### 任务 2：claude_settings 模块骨架 + 全局 Mutex + 路径函数

**文件：**
- 创建：`packages/jacc/src-tauri/src/claude_settings.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：创建 claude_settings.rs 骨架**

```rust
use std::path::{Path, PathBuf};
use tokio::sync::Mutex;

/// 全局互斥锁，串行化所有 settings.json 读改写。
/// 不变量：持锁期内绝不 spawn 任何会再次锁此 Mutex 的任务。
static SETTINGS_LOCK: Mutex<()> = Mutex::const_new(());

/// 全局 settings.json 路径：~/.claude/settings.json
pub fn global_settings_path() -> PathBuf {
    let home = dirs::home_dir().expect("HOME not found, jacc cannot start");
    home.join(".claude").join("settings.json")
}

/// 项目级 settings.json 路径：<project>/.claude/settings.json
pub fn project_settings_path(project: &Path) -> PathBuf {
    project.join(".claude").join("settings.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn global_path_ends_with_settings_json() {
        let p = global_settings_path();
        assert!(p.ends_with(".claude/settings.json") || p.ends_with(".claude\\settings.json"));
    }

    #[test]
    fn project_path_under_project_root() {
        let p = project_settings_path(Path::new("/tmp/proj"));
        assert!(p.to_string_lossy().contains(".claude"));
        assert!(p.ends_with("settings.json"));
    }
}
```

- [ ] **步骤 2：在 lib.rs 注册模块**

在 `mod commands;` 同级追加：

```rust
mod claude_settings;
```

- [ ] **步骤 3：cargo test 确认通过**

运行：`cd packages/jacc/src-tauri && cargo test claude_settings::tests`
预期：2 个测试通过。

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/claude_settings.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): claude_settings 模块骨架 + 全局 Mutex + 路径函数"
```

---

### 任务 3：read + 解析失败备份机制

**文件：**
- 修改：`packages/jacc/src-tauri/src/claude_settings.rs`

- [ ] **步骤 1：编写失败的测试**

在 `claude_settings.rs` 的 `mod tests` 内追加：

```rust
#[tokio::test]
async fn read_returns_empty_object_when_missing() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    let v = read(&path).await.unwrap();
    assert!(v.as_object().unwrap().is_empty());
}

#[tokio::test]
async fn read_corrupted_backs_up_and_returns_error() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    std::fs::write(&path, b"{ not json").unwrap();

    let err = read(&path).await.unwrap_err();
    let msg = err.to_string();
    assert!(msg.contains("corrupted"), "got: {msg}");

    // 原文件应已被 rename 为 .broken-{ts}
    let entries: Vec<_> = std::fs::read_dir(dir.path()).unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy().contains(".broken-"))
        .collect();
    assert_eq!(entries.len(), 1);
}
```

- [ ] **步骤 2：运行测试确认失败**

运行：`cargo test claude_settings::tests::read_ -- --nocapture`
预期：FAIL，`read` 函数未定义。

- [ ] **步骤 3：实现 read 函数**

在 `claude_settings.rs` 顶部 `use` 区追加：

```rust
use crate::error::{AppError, AppResult};
use std::time::{SystemTime, UNIX_EPOCH};
```

在路径函数下方追加 `read`：

```rust
pub async fn read(path: &Path) -> AppResult<serde_json::Value> {
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = std::fs::read_to_string(path)?;
    if content.trim().is_empty() {
        return Ok(serde_json::json!({}));
    }
    match serde_json::from_str::<serde_json::Value>(&content) {
        Ok(v) => Ok(v),
        Err(e) => {
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let backup = path.with_extension(format!("json.broken-{ts}"));
            if let Err(rename_err) = std::fs::rename(path, &backup) {
                tracing::error!(
                    path = %path.display(),
                    err = %rename_err,
                    "failed to backup corrupted settings.json"
                );
            } else {
                tracing::warn!(
                    path = %path.display(),
                    backup = %backup.display(),
                    reason = %e,
                    "settings.json corrupted, backed up"
                );
            }
            Err(AppError::SettingsCorrupted {
                path: path.to_string_lossy().to_string(),
                backup_path: backup.to_string_lossy().to_string(),
                reason: e.to_string(),
            })
        }
    }
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`cargo test claude_settings::tests::read_`
预期：2 个测试通过。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/claude_settings.rs
git commit -m "feat(jacc): claude_settings::read + 解析失败备份"
```

---

### 任务 4：update 闭包式 + 原子写

**文件：**
- 修改：`packages/jacc/src-tauri/src/claude_settings.rs`

- [ ] **步骤 1：编写失败的测试**

在 `mod tests` 内追加：

```rust
#[tokio::test]
async fn update_creates_file_when_missing() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");

    update(&path, |obj| {
        obj.insert("model".into(), serde_json::json!("opus"));
        Ok(())
    }).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(v["model"], "opus");
}

#[tokio::test]
async fn update_preserves_other_keys() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    std::fs::write(&path, r#"{"foo":"bar","model":"old"}"#).unwrap();

    update(&path, |obj| {
        obj.insert("model".into(), serde_json::json!("new"));
        Ok(())
    }).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(v["foo"], "bar");
    assert_eq!(v["model"], "new");
}

#[tokio::test]
async fn update_concurrent_writes_serialize() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");

    let p1 = path.clone();
    let p2 = path.clone();
    let h1 = tokio::spawn(async move {
        for i in 0..20 {
            update(&p1, move |obj| {
                obj.insert(format!("a{i}"), serde_json::json!(i));
                Ok(())
            }).await.unwrap();
        }
    });
    let h2 = tokio::spawn(async move {
        for i in 0..20 {
            update(&p2, move |obj| {
                obj.insert(format!("b{i}"), serde_json::json!(i));
                Ok(())
            }).await.unwrap();
        }
    });
    h1.await.unwrap();
    h2.await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    let obj = v.as_object().unwrap();
    // 40 个 key 都不应丢失
    assert_eq!(obj.len(), 40);
}
```

- [ ] **步骤 2：运行测试确认失败**

运行：`cargo test claude_settings::tests::update_`
预期：FAIL，`update` 未定义。

- [ ] **步骤 3：实现 update + 原子写**

在 `read` 下方追加：

```rust
pub async fn update<F>(path: &Path, mutator: F) -> AppResult<()>
where
    F: FnOnce(&mut serde_json::Map<String, serde_json::Value>) -> AppResult<()>,
{
    let _guard = SETTINGS_LOCK.lock().await;

    let mut value = read(path).await?;
    if !value.is_object() {
        tracing::warn!(path = %path.display(), "settings.json top-level is not an object, resetting");
        value = serde_json::json!({});
    }
    let obj = value.as_object_mut().expect("guaranteed object above");
    mutator(obj)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
    let content = serde_json::to_string_pretty(&value)?;
    use std::io::Write;
    tmp.write_all(content.as_bytes())?;
    tmp.flush()?;
    tmp.persist(path).map_err(|e| std::io::Error::other(e.to_string()))?;

    tracing::info!(path = %path.display(), "settings.json written");
    Ok(())
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`cargo test claude_settings::tests::update_`
预期：3 个测试通过。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/claude_settings.rs
git commit -m "feat(jacc): claude_settings::update 闭包式 + 原子写 + Mutex"
```

---

### 任务 5：业务封装函数（write_slot_env / clear_slot_env / write_kv / delete_kv / purge_token）

**文件：**
- 修改：`packages/jacc/src-tauri/src/claude_settings.rs`

- [ ] **步骤 1：编写失败的测试**

在 `mod tests` 内追加：

```rust
fn read_value(path: &Path) -> serde_json::Value {
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

#[tokio::test]
async fn write_slot_env_writes_three_keys() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");

    write_slot_env(&path, "opus", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6")
        .await.unwrap();

    let v = read_value(&path);
    assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://api.anthropic.com");
    assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-ant-aaa");
    assert_eq!(v["env"]["ANTHROPIC_DEFAULT_OPUS_MODEL"], "claude-opus-4-6");
}

#[tokio::test]
async fn clear_slot_env_removes_keys_and_top_model() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    write_slot_env(&path, "opus", "https://x.com", "sk-x", "m").await.unwrap();
    write_kv(&path, "model", serde_json::json!("opus")).await.unwrap();

    clear_slot_env(&path, "opus").await.unwrap();

    let v = read_value(&path);
    assert!(v["env"].get("ANTHROPIC_BASE_URL").is_none());
    assert!(v["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
    assert!(v["env"].get("ANTHROPIC_DEFAULT_OPUS_MODEL").is_none());
    assert!(v.get("model").is_none(), "top-level model should be cleared when matches slot");
}

#[tokio::test]
async fn purge_token_clears_all_slots_with_matching_creds() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    write_slot_env(&path, "opus", "https://a.com", "sk-aaa", "m1").await.unwrap();

    purge_token(&path, "https://a.com", "sk-aaa").await.unwrap();

    let v = read_value(&path);
    assert!(v["env"].get("ANTHROPIC_BASE_URL").is_none());
    assert!(v["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
    assert!(v["env"].get("ANTHROPIC_DEFAULT_OPUS_MODEL").is_none());
}

#[tokio::test]
async fn write_kv_and_delete_kv() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    write_kv(&path, "foo", serde_json::json!("bar")).await.unwrap();
    assert_eq!(read_value(&path)["foo"], "bar");
    delete_kv(&path, "foo").await.unwrap();
    assert!(read_value(&path).get("foo").is_none());
}
```

- [ ] **步骤 2：运行测试确认失败**

运行：`cargo test claude_settings::tests`
预期：上述 4 个新测试 FAIL（函数未定义）。

- [ ] **步骤 3：实现业务封装**

在 `update` 下方追加：

```rust
fn slot_env_key(slot: &str) -> &'static str {
    match slot {
        "opus" => "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "sonnet" => "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "haiku" => "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        _ => "ANTHROPIC_MODEL",
    }
}

pub async fn write_slot_env(
    path: &Path,
    slot: &str,
    base_url: &str,
    api_key: &str,
    model_name: &str,
) -> AppResult<()> {
    let env_key = slot_env_key(slot);
    update(path, |obj| {
        let env = obj.entry("env").or_insert_with(|| serde_json::json!({}));
        let env_obj = env.as_object_mut().ok_or_else(|| {
            AppError::Custom("env is not an object".into())
        })?;
        env_obj.insert("ANTHROPIC_BASE_URL".into(), serde_json::json!(base_url));
        env_obj.insert("ANTHROPIC_AUTH_TOKEN".into(), serde_json::json!(api_key));
        env_obj.insert(env_key.into(), serde_json::json!(model_name));
        Ok(())
    }).await
}

pub async fn clear_slot_env(path: &Path, slot: &str) -> AppResult<()> {
    let env_key = slot_env_key(slot);
    update(path, |obj| {
        if let Some(env) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
            env.remove("ANTHROPIC_BASE_URL");
            env.remove("ANTHROPIC_AUTH_TOKEN");
            env.remove(env_key);
        }
        if obj.get("model").and_then(|v| v.as_str()) == Some(slot) {
            obj.remove("model");
        }
        Ok(())
    }).await
}

pub async fn write_kv(path: &Path, key: &str, value: serde_json::Value) -> AppResult<()> {
    update(path, |obj| {
        obj.insert(key.to_string(), value);
        Ok(())
    }).await
}

pub async fn delete_kv(path: &Path, key: &str) -> AppResult<()> {
    update(path, |obj| {
        obj.remove(key);
        Ok(())
    }).await
}

pub async fn purge_token(path: &Path, base_url: &str, api_key: &str) -> AppResult<()> {
    update(path, |obj| {
        let env_match = obj.get("env").and_then(|v| v.as_object()).map(|env| {
            env.get("ANTHROPIC_BASE_URL").and_then(|v| v.as_str()) == Some(base_url)
                && env.get("ANTHROPIC_AUTH_TOKEN").and_then(|v| v.as_str()) == Some(api_key)
        }).unwrap_or(false);

        if env_match {
            if let Some(env) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
                env.remove("ANTHROPIC_BASE_URL");
                env.remove("ANTHROPIC_AUTH_TOKEN");
                env.remove("ANTHROPIC_DEFAULT_OPUS_MODEL");
                env.remove("ANTHROPIC_DEFAULT_SONNET_MODEL");
                env.remove("ANTHROPIC_DEFAULT_HAIKU_MODEL");
            }
        }
        Ok(())
    }).await
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`cargo test claude_settings::tests`
预期：所有测试通过。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/claude_settings.rs
git commit -m "feat(jacc): claude_settings 业务封装函数 (write_slot_env/clear/purge/kv)"
```

---

### 任务 6：path_guard 模块（仅创建+测试，不接入命令）

**文件：**
- 创建：`packages/jacc/src-tauri/src/path_guard.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：创建 path_guard.rs 含失败的测试**

```rust
use std::path::PathBuf;
use crate::error::{AppError, AppResult};

#[cfg(target_os = "windows")]
const SYSTEM_PREFIXES: &[&str] = &[
    "C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\ProgramData",
];

#[cfg(not(target_os = "windows"))]
const SYSTEM_PREFIXES: &[&str] = &[
    "/etc", "/usr", "/bin", "/sbin", "/System", "/private", "/var",
];

/// 校验项目路径：必须存在、是目录、canonicalize 后不在系统敏感前缀
pub fn validate_project_path(s: &str) -> AppResult<PathBuf> {
    if s.is_empty() {
        return Err(AppError::Custom("INVALID_PROJECT_PATH:empty".into()));
    }
    let p = PathBuf::from(s);
    if !p.exists() || !p.is_dir() {
        return Err(AppError::Custom(format!("INVALID_PROJECT_PATH:not_a_directory:{}", s)));
    }
    let canonical = p.canonicalize()
        .map_err(|e| AppError::Custom(format!("INVALID_PROJECT_PATH:canonicalize_failed:{}", e)))?;
    let canon_str = canonical.to_string_lossy().to_string();
    for prefix in SYSTEM_PREFIXES {
        if canon_str.starts_with(prefix) {
            return Err(AppError::Custom(format!("INVALID_PROJECT_PATH:system_path:{}", canon_str)));
        }
    }
    Ok(canonical)
}

/// 校验 skill 名：仅允许 ^[a-zA-Z0-9_-]{1,64}$
pub fn validate_skill_name(s: &str) -> AppResult<String> {
    if s.is_empty() || s.len() > 64 {
        return Err(AppError::Custom("INVALID_SKILL_NAME:length".into()));
    }
    if !s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err(AppError::Custom(format!("INVALID_SKILL_NAME:bad_chars:{}", s)));
    }
    Ok(s.to_string())
}

/// 校验临时目录：必须 starts_with std::env::temp_dir() canonicalize 后的前缀
pub fn validate_temp_dir(s: &str) -> AppResult<PathBuf> {
    let p = PathBuf::from(s);
    if !p.exists() {
        return Err(AppError::Custom(format!("INVALID_TEMP_DIR:not_exist:{}", s)));
    }
    let canonical = p.canonicalize()
        .map_err(|e| AppError::Custom(format!("INVALID_TEMP_DIR:canonicalize_failed:{}", e)))?;
    let temp_root = std::env::temp_dir().canonicalize()
        .map_err(|e| AppError::Custom(format!("INVALID_TEMP_DIR:temp_root:{}", e)))?;
    if !canonical.starts_with(&temp_root) {
        return Err(AppError::Custom(format!(
            "INVALID_TEMP_DIR:outside_temp:{}", canonical.to_string_lossy()
        )));
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_path_rejects_empty() {
        assert!(validate_project_path("").is_err());
    }

    #[test]
    fn project_path_rejects_nonexistent() {
        assert!(validate_project_path("/nonexistent/zzz/yyy").is_err());
    }

    #[test]
    fn project_path_accepts_tempdir() {
        let dir = tempfile::tempdir().unwrap();
        let s = dir.path().to_string_lossy().to_string();
        assert!(validate_project_path(&s).is_ok());
    }

    #[test]
    fn skill_name_accepts_normal() {
        assert!(validate_skill_name("brainstorming").is_ok());
        assert!(validate_skill_name("my_skill-2").is_ok());
    }

    #[test]
    fn skill_name_rejects_path_traversal() {
        assert!(validate_skill_name("../etc").is_err());
        assert!(validate_skill_name("foo/bar").is_err());
        assert!(validate_skill_name("foo\\bar").is_err());
        assert!(validate_skill_name("").is_err());
    }

    #[test]
    fn temp_dir_accepts_subdir_of_temp() {
        let dir = tempfile::tempdir().unwrap();
        let s = dir.path().to_string_lossy().to_string();
        assert!(validate_temp_dir(&s).is_ok());
    }

    #[test]
    fn temp_dir_rejects_outside_temp() {
        let home = dirs::home_dir().unwrap();
        let s = home.to_string_lossy().to_string();
        assert!(validate_temp_dir(&s).is_err());
    }
}
```

- [ ] **步骤 2：在 lib.rs 注册模块**

在 `mod claude_settings;` 同级追加：

```rust
mod path_guard;
```

- [ ] **步骤 3：运行测试确认通过**

运行：`cargo test path_guard::tests`
预期：所有测试通过。

- [ ] **步骤 4：完整跑 cargo test + clippy**

运行：

```bash
cargo test
cargo clippy --all-targets -- -D warnings
```

预期：测试全通过；clippy 没有 plan1 引入的新警告（旧的 dead_code/needless_borrows 等留待 plan4 清理）。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/path_guard.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): path_guard 模块（仅创建+单测，未接入命令）"
```

---

## 完成标准

- [ ] `cargo test` 全绿，新增 ~12 个测试。
- [ ] `cargo build --release` 通过。
- [ ] `claude_settings` 与 `path_guard` 两个模块就位但未被任何 Tauri 命令调用（plan2/3/4 才接入）。
- [ ] `AppError::SettingsCorrupted` variant 已加入。
- [ ] 打 git tag `jacc-plan1-done`。





