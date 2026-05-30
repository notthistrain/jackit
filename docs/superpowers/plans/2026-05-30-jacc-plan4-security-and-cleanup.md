# jacc Plan4：安全 / 健壮性 / 清理 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** mask 4+4、path_guard 接入命令、HOME panic、test_model 超时+脱敏、slot 白名单、install token map、迁移事务化、读写宏拆分+前端日志限流、clippy 清零 + CI gate。

**架构：** 独立的多个小改动；逐项消除审查报告中 P1~P3 问题。可与 plan1~3 完全并行（不修改 settings.json 联动主路径）。

**技术栈：** Rust, Tauri 2, parking_lot, std::sync::OnceLock, reqwest

**前置依赖：** 无（独立）。但若 plan2 已合，slot 白名单部分会自然合并；若 plan1 已合，path_guard 接入是补完。

**设计文档：** `docs/superpowers/specs/2026-05-30-jacc-backend-consistency-design.md` 第 5、6 节

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/jacc/src-tauri/src/commands/api_keys.rs` | mask 4+4、`needless_borrows` 清理 |
| `packages/jacc/src-tauri/src/commands/models.rs` | `needless_borrows` 清理 |
| `packages/jacc/src-tauri/src/commands/providers.rs` | `needless_borrows` 清理 |
| `packages/jacc/src-tauri/src/commands/skills.rs` | install token map + GC、`manual_strip` 清理、path_guard 接入 |
| `packages/jacc/src-tauri/src/commands/models.rs` | test_model 超时 + 仅 2xx + 脱敏 |
| `packages/jacc/src-tauri/src/commands/log.rs` | 前端日志限流 |
| `packages/jacc/src-tauri/src/macros.rs` | 拆 log_read_command! / log_write_command! |
| `packages/jacc/src-tauri/src/db.rs` | 迁移事务化 + 启动日志 |
| `packages/jacc/src-tauri/src/lib.rs` | HOME panic 入口 |
| `packages/jacc/src-tauri/Cargo.toml` | 加 parking_lot |
| `.github/workflows/*.yml` | CI 加 cargo clippy gate |

---

### 任务 1：api_key mask 改为 4 头 + 4 尾

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/api_keys.rs`

- [ ] **步骤 1：编辑测试到新格式**

将现有 `test_mask_short_key` / `test_mask_long_key` 改为：

```rust
#[tokio::test]
async fn test_mask_long_key_4_4() {
    let v = ApiKeyView::from_api_key(&ApiKey {
        id: 1, provider_id: 1, name: "t".into(),
        api_key: "sk-ant-api123ef89".into(), notes: None,
        created_at: "x".into(), updated_at: "x".into(),
    });
    assert_eq!(v.api_key_masked, "sk-a***ef89");
}

#[tokio::test]
async fn test_mask_short_key() {
    let v = ApiKeyView::from_api_key(&ApiKey {
        id: 1, provider_id: 1, name: "t".into(),
        api_key: "short".into(), notes: None,
        created_at: "x".into(), updated_at: "x".into(),
    });
    assert_eq!(v.api_key_masked, "***");
}
```

- [ ] **步骤 2：实现新 mask 逻辑**

```rust
impl ApiKeyView {
    pub fn from_api_key(ak: &ApiKey) -> Self {
        Self {
            id: ak.id,
            provider_id: ak.provider_id,
            name: ak.name.clone(),
            api_key_masked: mask_api_key(&ak.api_key),
            notes: ak.notes.clone(),
            created_at: ak.created_at.clone(),
            updated_at: ak.updated_at.clone(),
        }
    }
}

pub fn mask_api_key(s: &str) -> String {
    if s.len() < 8 {
        "***".to_string()
    } else {
        let head = &s[..4];
        let tail = &s[s.len() - 4..];
        format!("{head}***{tail}")
    }
}
```

> plan2 中 `slots.rs::mask_api_key` 与此重复——本任务里把 `slots.rs` 的本地 mask 删掉，改 `use super::api_keys::mask_api_key;`，确保单一来源。

- [ ] **步骤 3：cargo test 通过**

运行：`cargo test commands::api_keys`

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/api_keys.rs \
        packages/jacc/src-tauri/src/commands/slots.rs
git commit -m "feat(jacc): api_key mask 改为 4 头 + 4 尾，统一函数"
```

---

### 任务 2：path_guard 接入所有命令入口

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/skills.rs`
- 修改：`packages/jacc/src-tauri/src/commands/config.rs`
- 修改：`packages/jacc/src-tauri/src/commands/projects.rs`
- 修改：`packages/jacc/src-tauri/src/commands/active_project.rs`（如 plan3 已合）

- [ ] **步骤 1：在 skills.rs 各命令入口接入**

`list_skills` / `toggle_skill` / `import_skill` / `confirm_install_skill` 的 `project_path` 参数过 `path_guard::validate_project_path`；`name` / `skill_names` 过 `validate_skill_name`；`temp_dir` 过 `validate_temp_dir`。

例：

```rust
#[tauri::command]
pub async fn toggle_skill(project_path: String, name: String, enabled: bool) -> AppResult<()> {
    log_command!("toggle_skill", {
        let project = crate::path_guard::validate_project_path(&project_path)?;
        let name = crate::path_guard::validate_skill_name(&name)?;
        let skills_dir = project.join(".claude").join("skills");
        // ... 后续逻辑用 skills_dir / name
    })
}
```

- [ ] **步骤 2：在 config.rs / projects.rs 中接入**

`write_config` / `delete_config` 的 `project_path: Option<String>` 非空时过 validate；`add_project` / `open_project` / `remove_project` 的 path 过 validate。

- [ ] **步骤 3：cargo test + clippy**

运行：

```bash
cargo test
cargo clippy --all-targets -- -D warnings
```

注意：原有测试若用了 `/tmp/foo` 这种不存在路径调命令，要改为 `tempfile::tempdir()` 创建真实目录。

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/
git commit -m "feat(jacc): path_guard 接入所有命令入口"
```

---

### 任务 3：HOME 找不到 → 启动 panic + 移除所有 `unwrap_or_else(|| ".")`

**文件：**
- 修改：`packages/jacc/src-tauri/src/lib.rs`
- 修改：`packages/jacc/src-tauri/src/db.rs`
- 修改：`packages/jacc/src-tauri/src/logging.rs`
- 修改：`packages/jacc/src-tauri/src/commands/skills.rs`
- 修改：`packages/jacc/src-tauri/src/commands/config.rs`（如 plan2 已转薄包装则此处可能不再需要）

- [ ] **步骤 1：lib.rs::run 早期校验 HOME**

在 `tracing::info!("app started");` 之前加：

```rust
let _home = dirs::home_dir().unwrap_or_else(|| {
    tracing::error!("HOME not found, jacc cannot start");
    panic!("HOME not found, jacc cannot start");
});
```

- [ ] **步骤 2：替换所有 `unwrap_or_else(|| PathBuf::from("."))`**

在以下文件搜索 `unwrap_or_else(|| PathBuf::from("."))` 并替换为 `expect("HOME not found, jacc cannot start")`：
- `db.rs::get_db_path`
- `logging.rs::get_log_dir`
- `commands/skills.rs::list_skills`
- `commands/config.rs::get_global_settings_path`（如仍存在）
- `commands/slots.rs::get_global_settings_path`（如仍存在）

注意 `claude_settings.rs` 中已是 `expect`，无需改。

- [ ] **步骤 3：调整测试**

`logging.rs::tests::get_log_dir_returns_correct_path` 已用 `dirs::home_dir().unwrap()`，无需改。其他测试若依赖 `unwrap_or_else(.)` 兜底，改为先 set HOME env / skip。

- [ ] **步骤 4：cargo test 通过**

运行：`cargo test`

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/
git commit -m "fix(jacc): HOME 找不到时启动 panic，移除静默兜底"
```

---

### 任务 4：test_model 超时 + 仅 2xx 成功 + 错误脱敏

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/models.rs`

- [ ] **步骤 1：编写脱敏单元测试**

```rust
#[test]
fn redact_sk_tokens_in_body() {
    let s = "error: invalid token sk-ant-abcdefg12345 in request";
    let r = redact_sensitive(s);
    assert!(!r.contains("sk-ant-abcdefg12345"));
    assert!(r.contains("***"));
}

#[test]
fn body_truncated_to_200_chars() {
    let s = "x".repeat(500);
    let r = redact_sensitive(&s);
    assert!(r.len() <= 210);  // 200 + "...(trimmed)" 之类
}
```

- [ ] **步骤 2：实现 redact + 改 test_model_inner**

```rust
pub fn redact_sensitive(body: &str) -> String {
    let truncated: String = body.chars().take(200).collect();
    // 替换 sk- 开头的 token-like 子串
    let re = regex::Regex::new(r"sk-[A-Za-z0-9_\-]{6,}").unwrap();
    re.replace_all(&truncated, "***").to_string()
}

pub(crate) async fn test_model_inner(pool: &SqlitePool, id: i64) -> AppResult<String> {
    let row = sqlx::query_as::<_, (String, String, String)>(
        "SELECT p.base_url, ak.api_key, m.model_name
         FROM models m
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE m.id = ?",
    ).bind(id).fetch_one(pool).await
    .map_err(|_| AppError::Custom("MODEL_NOT_FOUND".into()))?;
    let (base_url, api_key, model_name) = row;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Custom(format!("CLIENT_BUILD_FAILED:{e}")))?;
    let url = format!("{}/v1/messages", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model_name, "max_tokens": 1,
        "messages": [{"role": "user", "content": "hi"}]
    });
    let resp = client.post(&url)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .body(body.to_string())
        .send().await
        .map_err(|e| AppError::Custom(format!("CONNECTION_FAILED:{}", e)))?;
    let status = resp.status();
    if status.is_success() {
        Ok("CONNECTION_SUCCESS".into())
    } else if status.as_u16() == 401 || status.as_u16() == 403 {
        Err(AppError::Custom(format!("AUTH_FAILED:{}", status.as_u16())))
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(AppError::Custom(format!("HTTP_ERROR:{}:{}", status.as_u16(), redact_sensitive(&body))))
    }
}
```

> Cargo.toml 加 `regex = "1"` 依赖。

- [ ] **步骤 3：cargo test 通过**

运行：`cargo test commands::models`

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/models.rs packages/jacc/src-tauri/Cargo.toml
git commit -m "fix(jacc): test_model 加超时 + 仅 2xx 成功 + 错误脱敏"
```

---

### 任务 5：slot 白名单接入（若 plan2 已做则补完）

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/slots.rs`

- [ ] **步骤 1：检查现状**

如果 plan2 已在 `bind_slot_at` 加了 `ALLOWED_SLOTS` 校验，本任务只需补充 `unbind_slot_at` / `set_current_model` 的入口校验，并把 `ALLOWED_SLOTS` 提到模块顶部 `pub`。

- [ ] **步骤 2：补 unbind_slot_at / set_current_model 校验**

`unbind_slot_at` 顶部加：

```rust
if !ALLOWED_SLOTS.contains(&slot) {
    return Err(AppError::Custom(format!("INVALID_SLOT:{}", slot)));
}
```

`set_current_model_at` 同样。

- [ ] **步骤 3：补失败测试**

```rust
#[tokio::test]
async fn bind_invalid_slot_rejected() {
    let pool = setup_test_db().await;
    let mid = insert_full_model(&pool, "A", "https://a.com", "sk-x12345678", "m").await;
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("settings.json");
    let r = bind_slot_at(&pool, "evil", mid, &p).await;
    assert!(r.unwrap_err().to_string().contains("INVALID_SLOT:evil"));
}
```

- [ ] **步骤 4：cargo test + Commit**

```bash
cargo test commands::slots
git add packages/jacc/src-tauri/src/commands/slots.rs
git commit -m "feat(jacc): slot 白名单全面接入 unbind/set_current_model"
```

---

### 任务 6：install_skill_from_github 改 token map + GC

**文件：**
- 修改：`packages/jacc/src-tauri/Cargo.toml`（加 parking_lot、uuid）
- 修改：`packages/jacc/src-tauri/src/commands/skills.rs`

- [ ] **步骤 1：Cargo.toml 加依赖**

```toml
parking_lot = "0.12"
uuid = { version = "1", features = ["v4"] }
```

- [ ] **步骤 2：改造 install_skill_from_github**

```rust
use std::sync::OnceLock;
use std::time::Instant;
use std::collections::HashMap;
use std::path::PathBuf;

static INSTALL_TOKENS: OnceLock<parking_lot::Mutex<HashMap<String, (PathBuf, Instant)>>> = OnceLock::new();

fn tokens_map() -> &'static parking_lot::Mutex<HashMap<String, (PathBuf, Instant)>> {
    INSTALL_TOKENS.get_or_init(|| parking_lot::Mutex::new(HashMap::new()))
}

fn gc_tokens() {
    let now = Instant::now();
    let mut map = tokens_map().lock();
    let stale: Vec<_> = map.iter()
        .filter(|(_, (_, t))| now.duration_since(*t) > std::time::Duration::from_secs(30 * 60))
        .map(|(k, _)| k.clone())
        .collect();
    for k in stale {
        if let Some((path, _)) = map.remove(&k) {
            let _ = std::fs::remove_dir_all(&path);
            tracing::info!(path = %path.display(), "stale install token GC'd");
        }
    }
}
```

`install_skill_from_github` 改为生成 UUID token，存 map 后返回结构含 `token` 字段：

```rust
#[derive(Debug, Serialize)]
pub struct GithubInstallResult {
    pub token: String,
    pub skills: Vec<SkillInfo>,
}

#[tauri::command]
pub async fn install_skill_from_github(
    project_path: String,
    repo_url: String,
) -> AppResult<GithubInstallResult> {
    log_command!("install_skill_from_github", {
        let _ = crate::path_guard::validate_project_path(&project_path)?;
        gc_tokens();
        let temp_dir = std::env::temp_dir().join(format!("jacc-skill-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)?;

        // 异步跑 git
        let url = repo_url.clone();
        let tmp_path = temp_dir.clone();
        let output = tokio::task::spawn_blocking(move || {
            std::process::Command::new("git")
                .args(["clone", "--depth", "1", &url, &tmp_path.to_string_lossy()])
                .output()
        }).await
        .map_err(|e| AppError::Custom(format!("git spawn: {}", e)))?
        .map_err(|e| AppError::Custom(format!("git clone failed: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Custom(format!("git clone 失败: {}", stderr)));
        }

        let mut available_skills = vec![];
        scan_for_skills(&temp_dir, &mut available_skills)?;

        let token = uuid::Uuid::new_v4().to_string();
        tokens_map().lock().insert(token.clone(), (temp_dir.clone(), Instant::now()));

        tracing::info!(url = %repo_url, count = available_skills.len(), token = %token, "skills fetched");
        Ok(GithubInstallResult { token, skills: available_skills })
    })
}
```

`confirm_install_skill` 改为按 token 取路径：

```rust
#[tauri::command]
pub async fn confirm_install_skill(
    project_path: String,
    token: String,
    skill_names: Vec<String>,
) -> AppResult<()> {
    log_command!("confirm_install_skill", {
        let project = crate::path_guard::validate_project_path(&project_path)?;
        let names: Vec<String> = skill_names.iter()
            .map(|n| crate::path_guard::validate_skill_name(n))
            .collect::<AppResult<_>>()?;
        gc_tokens();
        let temp_path = {
            let map = tokens_map().lock();
            map.get(&token).map(|(p, _)| p.clone())
                .ok_or_else(|| AppError::Custom("INSTALL_TOKEN_EXPIRED".into()))?
        };
        // 二次校验路径仍在 temp 下
        crate::path_guard::validate_temp_dir(&temp_path.to_string_lossy())?;

        let dst_base = project.join(".claude").join("skills");
        std::fs::create_dir_all(&dst_base)?;
        for name in &names {
            let src = find_skill_dir(&temp_path, name)?;
            let dst = dst_base.join(name);
            copy_dir_recursive(&src, &dst)?;
        }
        let _ = std::fs::remove_dir_all(&temp_path);
        tokens_map().lock().remove(&token);
        Ok(())
    })
}
```

- [ ] **步骤 3：cargo build + test**

运行：`cargo test commands::skills && cargo clippy --all-targets -- -D warnings`

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/Cargo.toml packages/jacc/src-tauri/src/commands/skills.rs
git commit -m "fix(jacc): install_skill_from_github 改 token map + GC + 异步 git + path_guard"
```

---

### 任务 7：DB 迁移事务化 + 启动日志

**文件：**
- 修改：`packages/jacc/src-tauri/src/db.rs`

- [ ] **步骤 1：编写"事务回滚"测试**

在 `db.rs::tests` 内追加：

```rust
#[tokio::test]
async fn migrate_rolls_back_on_error() {
    let pool = setup_old_schema().await;
    sqlx::query(
        "INSERT INTO models (alias, base_url, api_key, model_name)
         VALUES ('A', 'https://a.com', 'k1', 'm1')"
    ).execute(&pool).await.unwrap();

    // 在 providers 表里预先塞一行同 base_url，并加 unique 约束
    sqlx::query("CREATE UNIQUE INDEX uniq_pburl ON providers(base_url)")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO providers (name, base_url) VALUES ('Existing', 'https://a.com')")
        .execute(&pool).await.unwrap();

    // 迁移会因 base_url unique 冲突失败
    let r = migrate_flat_models(&pool).await;
    assert!(r.is_err());

    // 旧 models 表必须仍在
    let (count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='models'"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(count, 1, "old models table should still exist after rollback");
}
```

- [ ] **步骤 2：把 migrate_flat_models 包入事务**

```rust
async fn migrate_flat_models(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let start = std::time::Instant::now();
    tracing::info!("flat-models migration started");

    let mut tx = pool.begin().await?;
    sqlx::query("PRAGMA defer_foreign_keys = ON").execute(&mut *tx).await?;

    sqlx::query("ALTER TABLE models RENAME TO models_old")
        .execute(&mut *tx).await?;
    sqlx::query(
        "CREATE TABLE models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key_id INTEGER NOT NULL,
            model_name TEXT NOT NULL,
            context_size TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
        )"
    ).execute(&mut *tx).await?;

    let old_models = sqlx::query_as::<_, OldModel>(
        "SELECT id, alias, base_url, api_key, model_name, context_size FROM models_old ORDER BY id"
    ).fetch_all(&mut *tx).await?;
    tracing::info!(count = old_models.len(), "old models loaded");

    let mut provider_map: HashMap<String, i64> = HashMap::new();
    for m in &old_models {
        if !provider_map.contains_key(&m.base_url) {
            let id = sqlx::query("INSERT INTO providers (name, base_url) VALUES (?, ?)")
                .bind(format!("{} Provider", m.alias))
                .bind(&m.base_url)
                .execute(&mut *tx).await?
                .last_insert_rowid();
            provider_map.insert(m.base_url.clone(), id);
        }
    }
    tracing::info!(provider_count = provider_map.len(), "providers created");

    let mut id_map: HashMap<i64, i64> = HashMap::new();
    for m in &old_models {
        let provider_id = provider_map[&m.base_url];
        let ak_id = sqlx::query(
            "INSERT INTO api_keys (provider_id, name, api_key) VALUES (?, ?, ?)"
        ).bind(provider_id).bind(format!("{} Key", m.alias)).bind(&m.api_key)
        .execute(&mut *tx).await?.last_insert_rowid();
        let new_id = sqlx::query(
            "INSERT INTO models (api_key_id, model_name, context_size) VALUES (?, ?, ?)"
        ).bind(ak_id).bind(&m.model_name).bind(&m.context_size)
        .execute(&mut *tx).await?.last_insert_rowid();
        id_map.insert(m.id, new_id);
    }
    tracing::info!(model_count = id_map.len(), "new models created");

    for (old_id, new_id) in &id_map {
        sqlx::query("UPDATE model_slots SET model_id = ? WHERE model_id = ?")
            .bind(new_id).bind(old_id).execute(&mut *tx).await?;
    }
    tracing::info!(remap_count = id_map.len(), "slots remapped");

    sqlx::query("DROP TABLE models_old").execute(&mut *tx).await?;
    tx.commit().await?;

    tracing::info!(elapsed_ms = start.elapsed().as_millis() as u64, "flat-models migration done");
    Ok(())
}
```

- [ ] **步骤 3：cargo test 通过**

运行：`cargo test db::tests`

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/db.rs
git commit -m "fix(jacc): 迁移函数事务化 + 启动日志"
```

---

### 任务 8：log_command 拆读/写宏 + 前端日志限流

**文件：**
- 修改：`packages/jacc/src-tauri/src/macros.rs`
- 修改：`packages/jacc/src-tauri/src/commands/log.rs`
- 修改：所有 `log_command!` 调用方（按读/写归类替换）

- [ ] **步骤 1：在 macros.rs 中拆宏**

把 `log_command!` 拆成 `log_read_command!`（debug）与 `log_write_command!`（info）：

```rust
#[macro_export]
macro_rules! log_read_command {
    ($name:expr, $($body:tt)*) => {{
        let start = std::time::Instant::now();
        tracing::debug!(command = $name, "→ invoked");
        let result = async { $($body)* }.await;
        let elapsed = start.elapsed();
        match &result {
            Ok(_) => tracing::debug!(command = $name, elapsed_ms = elapsed.as_millis() as u64, "✓ completed"),
            Err(e) => tracing::warn!(command = $name, elapsed_ms = elapsed.as_millis() as u64, error = %e, "✗ failed"),
        }
        result
    }};
}

#[macro_export]
macro_rules! log_write_command {
    ($name:expr, $($body:tt)*) => {{
        let start = std::time::Instant::now();
        tracing::info!(command = $name, "→ invoked");
        let result = async { $($body)* }.await;
        let elapsed = start.elapsed();
        match &result {
            Ok(_) => tracing::info!(command = $name, elapsed_ms = elapsed.as_millis() as u64, "✓ completed"),
            Err(e) => tracing::warn!(command = $name, elapsed_ms = elapsed.as_millis() as u64, error = %e, "✗ failed"),
        }
        result
    }};
}

// 兼容老调用，保留 log_command! 等同 log_write_command!
#[macro_export]
macro_rules! log_command {
    ($($t:tt)*) => { $crate::log_write_command!($($t)*) };
}
```

- [ ] **步骤 2：把读命令调用替换为 log_read_command!**

应用到：`get_preference`、`list_projects`、`list_providers`、`list_api_keys`、`list_models`、`get_slot_bindings`、`read_merged_config`、`list_skills`。

写命令保持 `log_command!` / `log_write_command!`。

- [ ] **步骤 3：实现前端日志限流**

`commands/log.rs` 改为：

```rust
use std::sync::OnceLock;
use std::time::Instant;
use parking_lot::Mutex;

struct TokenBucket {
    last_flush: Instant,
    count_in_window: u32,  // 1 秒内已通过条数
    window_start: Instant,
    dropped: u32,
}

static FRONTEND_LOG_BUCKET: OnceLock<Mutex<TokenBucket>> = OnceLock::new();

fn bucket() -> &'static Mutex<TokenBucket> {
    FRONTEND_LOG_BUCKET.get_or_init(|| Mutex::new(TokenBucket {
        last_flush: Instant::now(),
        count_in_window: 0,
        window_start: Instant::now(),
        dropped: 0,
    }))
}

/// 返回 true 表示放行，false 表示丢弃
fn check_rate_limit() -> bool {
    let mut b = bucket().lock();
    let now = Instant::now();

    // 5s 一次 flush
    if now.duration_since(b.last_flush) > std::time::Duration::from_secs(5) && b.dropped > 0 {
        tracing::warn!(target: "frontend", "frontend log rate-limited: {} dropped", b.dropped);
        b.dropped = 0;
        b.last_flush = now;
    }

    // 1s 滑动窗口
    if now.duration_since(b.window_start) > std::time::Duration::from_secs(1) {
        b.window_start = now;
        b.count_in_window = 0;
    }
    if b.count_in_window >= 100 {
        b.dropped += 1;
        false
    } else {
        b.count_in_window += 1;
        true
    }
}

#[tauri::command]
pub fn log_debug(module: String, message: String) {
    if check_rate_limit() {
        tracing::debug!(target: "frontend", "[{}] {}", module, message);
    }
}
// log_info / log_warn / log_error 同样套上 check_rate_limit
```

- [ ] **步骤 4：cargo test + clippy**

```bash
cargo test
cargo clippy --all-targets -- -D warnings
```

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/macros.rs \
        packages/jacc/src-tauri/src/commands/log.rs \
        packages/jacc/src-tauri/src/commands/
git commit -m "feat(jacc): 读写日志宏拆分 + 前端日志限流"
```

---

### 任务 9：clippy 清零 + CI gate

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/api_keys.rs`
- 修改：`packages/jacc/src-tauri/src/commands/models.rs`
- 修改：`packages/jacc/src-tauri/src/commands/providers.rs`
- 修改：`packages/jacc/src-tauri/src/commands/skills.rs`
- 修改：`.github/workflows/<相关 CI 配置>.yml`

- [ ] **步骤 1：清 needless_borrows**

将以下处的 `.bind(&xxx)` 改为 `.bind(xxx)`（去掉 `&`）：
- `commands/api_keys.rs:75` `.bind(&notes)` → `.bind(notes)`
- `commands/models.rs:41` `.bind(&context_size)` → `.bind(context_size)`
- `commands/providers.rs:42` `.bind(&notes)` → `.bind(notes)`
- 以及 clippy 提示的第 4 处（运行 `cargo clippy` 找具体位置）

- [ ] **步骤 2：清 manual_strip**

`commands/skills.rs::extract_description` 内：

```rust
if let Some(rest) = content.strip_prefix("---") {
    if let Some(end) = rest.find("---") {
        let frontmatter = &rest[..end];
        // ...
    }
}
```

替代原来的 `if content.starts_with("---") { let rest = &content[3..]; ... }`。

- [ ] **步骤 3：dead_code 已在 plan2 任务 3 处理，确认无残留**

运行 `cargo clippy --all-targets -- -D warnings`，应当 0 警告。

- [ ] **步骤 4：CI 增加 clippy gate**

打开仓库根 `.github/workflows/` 下相关 jacc CI 文件（参考已有 jackcom 的同名 gate）。在 `jobs.<name>.steps` 末尾加：

```yaml
- name: Clippy gate
  run: |
    cd packages/jacc/src-tauri
    cargo clippy --all-targets -- -D warnings
```

- [ ] **步骤 5：cargo test + clippy 完整跑**

```bash
cargo test
cargo clippy --all-targets -- -D warnings
cargo build --release
```

预期：全绿。

- [ ] **步骤 6：Commit + tag**

```bash
git add packages/jacc/src-tauri/src/ .github/workflows/
git commit -m "chore(jacc): clippy 清零 + CI gate"
git tag jacc-plan4-done
```

---

## 完成标准

- [ ] `cargo test` 全绿。
- [ ] `cargo clippy --all-targets -- -D warnings` 通过；CI 同步守门。
- [ ] api_key mask 4+4。
- [ ] path_guard 接入所有相关命令。
- [ ] HOME 找不到时启动 panic。
- [ ] test_model 加超时 + 仅 2xx + 错误脱敏。
- [ ] slot 白名单全面接入。
- [ ] install_skill_from_github 用 token map + GC + path_guard 防滥用。
- [ ] 迁移函数事务化 + 启动日志。
- [ ] 读写日志宏拆分；前端日志限流。
- [ ] git tag `jacc-plan4-done`。




