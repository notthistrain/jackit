# jacc Plan2：bind / unbind / delete 联动 settings.json 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 bind/unbind/delete/update 命令改造为联动写 settings.json，使 DB 与 settings.json 始终同步。

**架构：** 所有写 settings.json 的代码都通过 `claude_settings::*` API（plan1 已建好）；新增 `preview_delete_impact` 二次确认命令；commands/config.rs 改为 claude_settings 的薄包装。

**技术栈：** Rust, Tauri 2, sqlx 0.8 (SQLite), claude_settings (plan1)

**前置依赖：** plan1 已完成（claude_settings 模块就位）。

**执行顺序提示：** 本 plan 与 plan3 都改 `commands/slots.rs`。**强烈建议串行：先合 plan2，再合 plan3**，避免 merge 冲突。plan4 与本 plan 无冲突，可并行。

**设计文档：** `docs/superpowers/specs/2026-05-30-jacc-backend-consistency-design.md` 第 3 节

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/jacc/src-tauri/src/commands/slots.rs` | 修改：bind/unbind 联动 + 删除 write_slot_to_settings_at |
| `packages/jacc/src-tauri/src/commands/providers.rs` | 修改：delete 联动 + update 同步刷 + preview_delete_impact |
| `packages/jacc/src-tauri/src/commands/api_keys.rs` | 修改：delete 联动 + update 同步刷 + preview_delete_impact |
| `packages/jacc/src-tauri/src/commands/models.rs` | 修改：delete 联动 + preview_delete_impact |
| `packages/jacc/src-tauri/src/commands/config.rs` | 修改：薄包装转调 claude_settings |
| `packages/jacc/src-tauri/src/lib.rs` | 修改：注册 preview_delete_impact 命令 |

---

### 任务 1：commands/config.rs 转薄包装

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/config.rs`

- [ ] **步骤 1：读现状**

`commands/config.rs` 现含 `read_merged_config` / `write_config` / `delete_config` 三个 Tauri 命令以及 `read_settings_file` / `write_settings_file` 两个内部 helper。

- [ ] **步骤 2：删除内部 helper，改调 claude_settings**

完全替换文件内 `read_settings_file` / `write_settings_file` / `get_global_settings_path` / `get_project_settings_path` 四个本地函数。改写 `read_merged_config` / `write_config` / `delete_config` 内部为对 `crate::claude_settings::*` 的调用。`MergedConfig` / `MergedConfigItem` / `ConfigScope` 结构定义保留不变。

`read_merged_config` 函数体改为：

```rust
let global = crate::claude_settings::global_settings_path();
let project = if project_path.is_empty() {
    None
} else {
    Some(crate::claude_settings::project_settings_path(std::path::Path::new(&project_path)))
};
let global_value = crate::claude_settings::read(&global).await?;
let project_value = match project.as_deref() {
    Some(p) => crate::claude_settings::read(p).await?,
    None => serde_json::json!({}),
};
// （保留原有 items 合并逻辑，仅把 read_settings_file 调用替换为上面的值）
```

`write_config` 函数体改为：

```rust
let path = match scope {
    ConfigScope::Global => crate::claude_settings::global_settings_path(),
    ConfigScope::Project => {
        let pp = project_path.ok_or_else(|| crate::error::AppError::Custom("项目路径不能为空".into()))?;
        crate::claude_settings::project_settings_path(std::path::Path::new(&pp))
    }
};
crate::claude_settings::write_kv(&path, &key, value).await?;
tracing::info!(scope = ?scope, key = %key, path = %path.display(), "config written");
Ok(())
```

`delete_config` 类似，调 `crate::claude_settings::delete_kv`。

- [ ] **步骤 3：cargo test 现有测试不受影响**

运行：`cargo test commands::config`
预期：通过（如果原有 config 测试用了内部 helper，相应改为通过 claude_settings 验证；保留原 Tauri 命令名以保前端兼容）。

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/config.rs
git commit -m "refactor(jacc): commands/config 转 claude_settings 薄包装"
```

---

### 任务 1.5：reset_corrupted_settings 命令（前端兜底）

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/config.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：在 commands/config.rs 末尾追加**

```rust
#[tauri::command]
pub async fn reset_corrupted_settings(path: String) -> AppResult<()> {
    log_command!("reset_corrupted_settings", {
        let p = std::path::PathBuf::from(&path);
        // 仅允许 ~/.claude/settings.json 或项目级 .claude/settings.json 末尾匹配
        let global = crate::claude_settings::global_settings_path();
        if p != global && !p.ends_with(".claude/settings.json") && !p.ends_with(".claude\\settings.json") {
            return Err(crate::error::AppError::Custom(format!("INVALID_RESET_PATH:{}", path)));
        }
        crate::claude_settings::write_kv(&p, "_reset_marker", serde_json::json!("ok")).await?;
        crate::claude_settings::delete_kv(&p, "_reset_marker").await?;
        tracing::warn!(path = %p.display(), "settings.json reset to empty by user");
        Ok(())
    })
}
```

> 实现思路：write_kv + delete_kv 走 update 通路，会把空对象原子写回文件，相当于"重置为空对象"。

- [ ] **步骤 2：在 lib.rs invoke_handler 注册命令**

```rust
commands::config::reset_corrupted_settings,
```

- [ ] **步骤 3：cargo build + Commit**

```bash
cargo build
git add packages/jacc/src-tauri/src/commands/config.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): reset_corrupted_settings 命令（损坏兜底）"
```

---

### 任务 2：bind_slot 联动 write_slot_env

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/slots.rs`

- [ ] **步骤 1：编写失败的测试（slots.rs::tests 内追加）**

```rust
#[tokio::test]
async fn bind_slot_writes_settings_env() {
    let pool = setup_test_db().await;
    let mid = insert_full_model(
        &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
    ).await;

    // 临时 HOME 重定向：通过参数化 settings_path 测试更可靠，新增 bind_slot_at
    let dir = tempfile::tempdir().unwrap();
    let settings_path = dir.path().join("settings.json");

    bind_slot_at(&pool, "opus", mid, &settings_path).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://api.anthropic.com");
    assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-ant-aaa");
    assert_eq!(v["env"]["ANTHROPIC_DEFAULT_OPUS_MODEL"], "claude-opus-4-6");
}
```

- [ ] **步骤 2：运行测试确认失败**

运行：`cargo test commands::slots::tests::bind_slot_writes_settings_env`
预期：FAIL，`bind_slot_at` 未定义。

- [ ] **步骤 3：实现 bind_slot_at + 改造 bind_slot_inner**

替换 `bind_slot_inner` 为 `bind_slot_at(pool, slot, model_id, settings_path)`，并让 `bind_slot` 命令调 `bind_slot_at(pool, &slot, model_id, &claude_settings::global_settings_path())`。

新增 slot 白名单校验（plan4 会复用，本 plan 也加）：

```rust
const ALLOWED_SLOTS: &[&str] = &["opus", "sonnet", "haiku"];

pub(crate) async fn bind_slot_at(
    pool: &SqlitePool,
    slot: &str,
    model_id: i64,
    settings_path: &std::path::Path,
) -> AppResult<SlotBindingIntent> {
    if !ALLOWED_SLOTS.contains(&slot) {
        return Err(AppError::Custom(format!("INVALID_SLOT:{}", slot)));
    }
    let row = sqlx::query_as::<_, (String, String, String, String, i64)>(
        "SELECT m.model_name, ak.api_key, p.base_url, p.name, p.id
         FROM models m
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE m.id = ?",
    )
    .bind(model_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Custom(format!("MODEL_NOT_FOUND:{}", model_id)))?;
    let (model_name, api_key, base_url, provider_name, provider_id) = row;

    sqlx::query(
        "INSERT INTO model_slots (slot, model_id, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(slot) DO UPDATE SET model_id = excluded.model_id, updated_at = datetime('now')",
    )
    .bind(slot)
    .bind(model_id)
    .execute(pool)
    .await?;

    crate::claude_settings::write_slot_env(
        settings_path, slot, &base_url, &api_key, &model_name,
    ).await?;

    Ok(SlotBindingIntent {
        slot: slot.to_string(),
        model_id,
        model_name,
        provider_id,
        provider_name,
        base_url,
        api_key_masked: mask_api_key(&api_key),
        context_size: None,
    })
}
```

`SlotBindingIntent` 结构（在 `slots.rs` 顶部新增）。`mask_api_key` helper（4 头 + 4 尾，长度 < 8 时 `***`）放在 `commands/api_keys.rs` 作为单一来源；本任务额外新增以下内容到 `api_keys.rs`：

```rust
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

`slots.rs` 顶部 `use super::api_keys::mask_api_key;` 即可。注意：`api_keys.rs::ApiKeyView::from_api_key` 现有 mask 逻辑保持原样（前 8 + ***），不在本任务里改——plan4 任务 1 才统一替换为调用 `mask_api_key`。

- [ ] **步骤 4：运行测试确认通过**

运行：`cargo test commands::slots::tests`
预期：新测试通过；现有 `test_bind_slot_returns_binding` 等需要小改返回类型断言。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/slots.rs
git commit -m "feat(jacc): bind_slot 联动写 settings env + slot 白名单"
```

---

### 任务 3：unbind_slot 联动 clear_slot_env + 移除 dead 函数

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/slots.rs`

- [ ] **步骤 1：编写失败的测试**

```rust
#[tokio::test]
async fn unbind_slot_clears_settings_env() {
    let pool = setup_test_db().await;
    let mid = insert_full_model(
        &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
    ).await;
    let dir = tempfile::tempdir().unwrap();
    let settings_path = dir.path().join("settings.json");
    bind_slot_at(&pool, "opus", mid, &settings_path).await.unwrap();
    // 顶层 model 也设为 opus
    crate::claude_settings::write_kv(&settings_path, "model", serde_json::json!("opus"))
        .await.unwrap();

    unbind_slot_at(&pool, "opus", &settings_path).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert!(v["env"].get("ANTHROPIC_BASE_URL").is_none());
    assert!(v["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
    assert!(v["env"].get("ANTHROPIC_DEFAULT_OPUS_MODEL").is_none());
    assert!(v.get("model").is_none(), "top-level model should be cleared");
}
```

- [ ] **步骤 2：运行测试确认失败**

运行：`cargo test unbind_slot_clears_settings_env`
预期：FAIL，`unbind_slot_at` 未定义。

- [ ] **步骤 3：实现 unbind_slot_at，删除旧 write_slot_to_settings_at**

```rust
pub(crate) async fn unbind_slot_at(
    pool: &SqlitePool,
    slot: &str,
    settings_path: &std::path::Path,
) -> AppResult<()> {
    if !ALLOWED_SLOTS.contains(&slot) {
        return Err(AppError::Custom(format!("INVALID_SLOT:{}", slot)));
    }
    let rows = sqlx::query("DELETE FROM model_slots WHERE slot = ?")
        .bind(slot)
        .execute(pool)
        .await?;
    if rows.rows_affected() == 0 {
        return Err(AppError::Custom(format!("SLOT_UNBOUND:{}", slot)));
    }
    crate::claude_settings::clear_slot_env(settings_path, slot).await?;
    Ok(())
}
```

`unbind_slot` Tauri 命令改为调 `unbind_slot_at(pool, &slot, &claude_settings::global_settings_path())`。

完整删除原 `write_slot_to_settings_at` 函数（plan1 dead_code 警告由此消失）。

- [ ] **步骤 4：cargo test + clippy**

运行：

```bash
cargo test commands::slots
cargo clippy --all-targets -- -D warnings
```

预期：测试通过，clippy 中 `dead_code: write_slot_to_settings_at` 警告消失。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/slots.rs
git commit -m "feat(jacc): unbind_slot 联动 clear_slot_env + 删除 write_slot_to_settings_at"
```

---

### 任务 4：preview_delete_impact 命令

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/delete_preview.rs`
- 修改：`packages/jacc/src-tauri/src/commands/mod.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：创建 delete_preview.rs（含失败测试）**

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;
use crate::error::{AppError, AppResult};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeleteKind { Provider, ApiKey, Model }

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ImpactedSlot {
    pub slot: String,
    pub model_name: String,
    pub model_id: i64,
}

pub(crate) async fn preview_delete_impact_inner(
    pool: &SqlitePool,
    kind: DeleteKind,
    id: i64,
) -> AppResult<Vec<ImpactedSlot>> {
    let sql = match kind {
        DeleteKind::Provider => {
            "SELECT ms.slot, m.model_name, m.id as model_id
             FROM model_slots ms
             JOIN models m ON ms.model_id = m.id
             JOIN api_keys ak ON m.api_key_id = ak.id
             WHERE ak.provider_id = ?"
        }
        DeleteKind::ApiKey => {
            "SELECT ms.slot, m.model_name, m.id as model_id
             FROM model_slots ms
             JOIN models m ON ms.model_id = m.id
             WHERE m.api_key_id = ?"
        }
        DeleteKind::Model => {
            "SELECT ms.slot, m.model_name, m.id as model_id
             FROM model_slots ms
             JOIN models m ON ms.model_id = m.id
             WHERE m.id = ?"
        }
    };
    let rows = sqlx::query_as::<_, ImpactedSlot>(sql)
        .bind(id)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn preview_delete_impact(
    pool: State<'_, SqlitePool>,
    kind: DeleteKind,
    id: i64,
) -> AppResult<Vec<ImpactedSlot>> {
    log_command!("preview_delete_impact", {
        preview_delete_impact_inner(pool.inner(), kind, id).await
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await.unwrap();
        sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await.unwrap();
        // 复用 slots.rs::tests::setup_test_db 的四表 DDL（providers/api_keys/models/model_slots）
        // 此处省略 DDL，直接复制粘贴该函数的表创建语句即可
        pool
    }

    async fn insert_full_chain(pool: &SqlitePool) -> (i64, i64, i64) {
        let pid = sqlx::query("INSERT INTO providers (name, base_url) VALUES ('A', 'https://a.com')")
            .execute(pool).await.unwrap().last_insert_rowid();
        let ak = sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?, 'k', 'sk-x12345678')")
            .bind(pid).execute(pool).await.unwrap().last_insert_rowid();
        let m = sqlx::query("INSERT INTO models (api_key_id, model_name) VALUES (?, 'm')")
            .bind(ak).execute(pool).await.unwrap().last_insert_rowid();
        sqlx::query("INSERT INTO model_slots (slot, model_id) VALUES ('opus', ?)")
            .bind(m).execute(pool).await.unwrap();
        (pid, ak, m)
    }

    #[tokio::test]
    async fn preview_provider_returns_impacted_slots() {
        let pool = setup_test_db().await;
        let (pid, _, m) = insert_full_chain(&pool).await;
        let r = preview_delete_impact_inner(&pool, DeleteKind::Provider, pid).await.unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].slot, "opus");
        assert_eq!(r[0].model_id, m);
    }

    #[tokio::test]
    async fn preview_apikey_returns_impacted_slots() {
        let pool = setup_test_db().await;
        let (_, ak, _) = insert_full_chain(&pool).await;
        let r = preview_delete_impact_inner(&pool, DeleteKind::ApiKey, ak).await.unwrap();
        assert_eq!(r.len(), 1);
    }

    #[tokio::test]
    async fn preview_model_returns_impacted_slots() {
        let pool = setup_test_db().await;
        let (_, _, m) = insert_full_chain(&pool).await;
        let r = preview_delete_impact_inner(&pool, DeleteKind::Model, m).await.unwrap();
        assert_eq!(r.len(), 1);
    }

    #[tokio::test]
    async fn preview_returns_empty_when_no_slot() {
        let pool = setup_test_db().await;
        let pid = sqlx::query("INSERT INTO providers (name, base_url) VALUES ('A', 'https://a.com')")
            .execute(&pool).await.unwrap().last_insert_rowid();
        let r = preview_delete_impact_inner(&pool, DeleteKind::Provider, pid).await.unwrap();
        assert!(r.is_empty());
    }
}
```

> 测试代码骨架在子代理实现时按 `slots.rs` 的 setup_test_db 模式补齐：分别插入 1 个 provider→api_key→model→bind opus，验证 `Provider`/`ApiKey`/`Model` 三个 kind 都返回 `[{slot:"opus", model_name, model_id}]`。

- [ ] **步骤 2：在 mod.rs 注册**

`commands/mod.rs` 追加：`pub mod delete_preview;`

- [ ] **步骤 3：在 lib.rs 注册命令**

`tauri::generate_handler!` 列表追加 `commands::delete_preview::preview_delete_impact`。

- [ ] **步骤 4：cargo test 通过**

运行：`cargo test commands::delete_preview`

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/delete_preview.rs \
        packages/jacc/src-tauri/src/commands/mod.rs \
        packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): preview_delete_impact 命令"
```

---

### 任务 5：delete_provider/api_key/model 联动 purge_token

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/providers.rs`
- 修改：`packages/jacc/src-tauri/src/commands/api_keys.rs`
- 修改：`packages/jacc/src-tauri/src/commands/models.rs`

- [ ] **步骤 1：编写失败的测试（providers.rs::tests 内追加）**

```rust
#[tokio::test]
async fn delete_provider_purges_settings_env() {
    let pool = setup_test_db().await;
    sqlx::query(
        "CREATE TABLE api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL,
            name TEXT NOT NULL, api_key TEXT NOT NULL, notes TEXT,
            created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE)"
    ).execute(&pool).await.unwrap();
    sqlx::query(
        "CREATE TABLE models (
            id INTEGER PRIMARY KEY AUTOINCREMENT, api_key_id INTEGER NOT NULL,
            model_name TEXT NOT NULL, context_size TEXT,
            created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE)"
    ).execute(&pool).await.unwrap();

    let pid = add_provider_inner(&pool, CreateProviderInput {
        name: "A".into(), base_url: "https://a.com".into(), notes: None
    }).await.unwrap().id;
    let ak_id = sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?,?,?)")
        .bind(pid).bind("k").bind("sk-xx12345678").execute(&pool).await.unwrap().last_insert_rowid();
    sqlx::query("INSERT INTO models (api_key_id, model_name) VALUES (?,?)")
        .bind(ak_id).bind("m").execute(&pool).await.unwrap();

    let dir = tempfile::tempdir().unwrap();
    let settings_path = dir.path().join("settings.json");
    crate::claude_settings::write_slot_env(&settings_path, "opus", "https://a.com", "sk-xx12345678", "m")
        .await.unwrap();

    delete_provider_at(&pool, pid, &settings_path).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert!(v["env"].get("ANTHROPIC_BASE_URL").is_none());
    assert!(v["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
}
```

- [ ] **步骤 2：运行测试确认失败**

运行：`cargo test delete_provider_purges_settings_env`
预期：FAIL。

- [ ] **步骤 3：在 providers.rs 实现 delete_provider_at**

```rust
pub(crate) async fn delete_provider_at(
    pool: &SqlitePool,
    id: i64,
    settings_path: &std::path::Path,
) -> AppResult<()> {
    // 收集受影响 (base_url, api_key)
    let creds: Vec<(String, String)> = sqlx::query_as(
        "SELECT p.base_url, ak.api_key
         FROM providers p JOIN api_keys ak ON ak.provider_id = p.id
         WHERE p.id = ?"
    ).bind(id).fetch_all(pool).await?;

    sqlx::query("DELETE FROM providers WHERE id = ?")
        .bind(id).execute(pool).await?;

    for (base_url, api_key) in &creds {
        crate::claude_settings::purge_token(settings_path, base_url, api_key).await?;
    }
    tracing::info!(id, affected = creds.len(), "provider deleted, settings purged");
    Ok(())
}
```

`delete_provider` Tauri 命令改为调 `delete_provider_at(pool, id, &claude_settings::global_settings_path())`。

- [ ] **步骤 4：在 api_keys.rs 同样实现 delete_api_key_at**

```rust
pub(crate) async fn delete_api_key_at(
    pool: &SqlitePool, id: i64, settings_path: &std::path::Path,
) -> AppResult<()> {
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT p.base_url, ak.api_key
         FROM api_keys ak JOIN providers p ON ak.provider_id = p.id
         WHERE ak.id = ?"
    ).bind(id).fetch_optional(pool).await?;
    sqlx::query("DELETE FROM api_keys WHERE id = ?").bind(id).execute(pool).await?;
    if let Some((base_url, api_key)) = row {
        crate::claude_settings::purge_token(settings_path, &base_url, &api_key).await?;
    }
    Ok(())
}
```

- [ ] **步骤 5：在 models.rs 实现 delete_model_at**

```rust
pub(crate) async fn delete_model_at(
    pool: &SqlitePool, id: i64, settings_path: &std::path::Path,
) -> AppResult<()> {
    // 仅当该 model 被 slot 使用时才需 purge；找出关联 token
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT p.base_url, ak.api_key
         FROM models m JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         JOIN model_slots ms ON ms.model_id = m.id
         WHERE m.id = ?"
    ).bind(id).fetch_optional(pool).await?;
    sqlx::query("DELETE FROM models WHERE id = ?").bind(id).execute(pool).await?;
    if let Some((base_url, api_key)) = row {
        crate::claude_settings::purge_token(settings_path, &base_url, &api_key).await?;
    }
    Ok(())
}
```

三个 Tauri `delete_*` 命令对应改为调 `_at` 版本。

- [ ] **步骤 6：cargo test 全通过**

运行：`cargo test`

- [ ] **步骤 7：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/providers.rs \
        packages/jacc/src-tauri/src/commands/api_keys.rs \
        packages/jacc/src-tauri/src/commands/models.rs
git commit -m "feat(jacc): delete_provider/api_key/model 联动 purge_token"
```

---

### 任务 6：update_provider / update_api_key 同步刷 env

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/providers.rs`
- 修改：`packages/jacc/src-tauri/src/commands/api_keys.rs`

- [ ] **步骤 1：编写失败的测试（providers.rs）**

```rust
#[tokio::test]
async fn update_provider_refreshes_env_for_bound_slots() {
    let pool = setup_test_db().await; // 含 api_keys/models/model_slots 表
    let pid = add_provider_inner(&pool, CreateProviderInput {
        name: "A".into(), base_url: "https://old.com".into(), notes: None
    }).await.unwrap().id;
    let ak_id = sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?,?,?)")
        .bind(pid).bind("k").bind("sk-xx12345678").execute(&pool).await.unwrap().last_insert_rowid();
    let mid = sqlx::query("INSERT INTO models (api_key_id, model_name) VALUES (?,?)")
        .bind(ak_id).bind("m").execute(&pool).await.unwrap().last_insert_rowid();
    sqlx::query("INSERT INTO model_slots (slot, model_id) VALUES ('opus', ?)")
        .bind(mid).execute(&pool).await.unwrap();

    let dir = tempfile::tempdir().unwrap();
    let settings_path = dir.path().join("settings.json");
    crate::claude_settings::write_slot_env(&settings_path, "opus", "https://old.com", "sk-xx12345678", "m")
        .await.unwrap();

    update_provider_at(&pool, pid, UpdateProviderInput {
        name: None,
        base_url: Some("https://new.com".into()),
        notes: None,
    }, &settings_path).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://new.com");
}
```

- [ ] **步骤 2：实现 update_provider_at**

```rust
pub(crate) async fn update_provider_at(
    pool: &SqlitePool, id: i64, input: UpdateProviderInput,
    settings_path: &std::path::Path,
) -> AppResult<()> {
    update_provider_inner(pool, id, input).await?;
    // 同步刷该 provider 关联的所有 slot env
    let bindings: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT ms.slot, m.model_name, ak.api_key, p.base_url
         FROM model_slots ms
         JOIN models m ON ms.model_id = m.id
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE p.id = ?"
    ).bind(id).fetch_all(pool).await?;
    for (slot, model_name, api_key, base_url) in bindings {
        crate::claude_settings::write_slot_env(settings_path, &slot, &base_url, &api_key, &model_name).await?;
    }
    Ok(())
}
```

- [ ] **步骤 3：在 api_keys.rs 同样实现 update_api_key_at**

```rust
pub(crate) async fn update_api_key_at(
    pool: &SqlitePool, id: i64, input: UpdateApiKeyInput,
    settings_path: &std::path::Path,
) -> AppResult<()> {
    update_api_key_inner(pool, id, input).await?;
    let bindings: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT ms.slot, m.model_name, ak.api_key, p.base_url
         FROM model_slots ms
         JOIN models m ON ms.model_id = m.id
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE ak.id = ?"
    ).bind(id).fetch_all(pool).await?;
    for (slot, model_name, api_key, base_url) in bindings {
        crate::claude_settings::write_slot_env(settings_path, &slot, &base_url, &api_key, &model_name).await?;
    }
    Ok(())
}
```

两个 Tauri 命令 `update_provider` / `update_api_key` 改为调 `_at` 版本，传入 `claude_settings::global_settings_path()`。

- [ ] **步骤 4：cargo test 通过**

运行：`cargo test`
预期：所有测试绿。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/providers.rs \
        packages/jacc/src-tauri/src/commands/api_keys.rs
git commit -m "feat(jacc): update_provider/update_api_key 联动刷 env"
```

---

### 任务 7：端到端集成测试

**文件：**
- 创建：`packages/jacc/src-tauri/tests/integration_settings_sync.rs`
- 修改：`packages/jacc/src-tauri/src/commands/providers.rs`（pub 化）
- 修改：`packages/jacc/src-tauri/src/commands/api_keys.rs`（pub 化）
- 修改：`packages/jacc/src-tauri/src/commands/models.rs`（pub 化）
- 修改：`packages/jacc/src-tauri/src/commands/slots.rs`（pub 化）

- [ ] **步骤 1：把 inner / _at 函数从 pub(crate) 改为 pub**

为让外部 `tests/` 集成测试可见，把以下函数的 `pub(crate)` 改为 `pub`：

- `commands/providers.rs::add_provider_inner` / `update_provider_inner` / `delete_provider_inner` / `update_provider_at` / `delete_provider_at`
- `commands/api_keys.rs::add_api_key_inner` / `update_api_key_inner` / `delete_api_key_inner` / `update_api_key_at` / `delete_api_key_at`
- `commands/models.rs::add_model_inner` / `update_model_inner` / `delete_model_inner` / `delete_model_at`
- `commands/slots.rs::bind_slot_at` / `unbind_slot_at` / `set_current_model_at` / `get_slot_bindings_full_at`

输入结构体（如 `CreateProviderInput` / `UpdateProviderInput` / 其他 `*Input`）必须已经是 `pub`（多数已经是，确认一遍即可）。

- [ ] **步骤 2：创建集成测试**

```rust
//! 端到端：add provider → key → model → bind → 改 token → 验 env 已刷 → 删 provider → 验 env 清空
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

async fn setup() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await.unwrap();
    sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, base_url TEXT NOT NULL,
        notes TEXT, created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')))").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL,
        name TEXT NOT NULL, api_key TEXT NOT NULL, notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE)")
        .execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE models (
        id INTEGER PRIMARY KEY AUTOINCREMENT, api_key_id INTEGER NOT NULL,
        model_name TEXT NOT NULL, context_size TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE)")
        .execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE model_slots (
        slot TEXT PRIMARY KEY, model_id INTEGER NOT NULL, context_size TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE)")
        .execute(&pool).await.unwrap();
    pool
}

#[tokio::test]
async fn full_lifecycle_keeps_settings_in_sync() {
    let pool = setup().await;
    let dir = tempfile::tempdir().unwrap();
    let settings_path = dir.path().join("settings.json");

    // 1. add provider/key/model
    let p = jacc_lib::commands::providers::add_provider_inner(
        &pool, jacc_lib::commands::providers::CreateProviderInput {
            name: "A".into(), base_url: "https://a.com".into(), notes: None,
        }).await.unwrap();
    let ak = jacc_lib::commands::api_keys::add_api_key_inner(
        &pool, jacc_lib::commands::api_keys::CreateApiKeyInput {
            provider_id: p.id, name: "k".into(), api_key: "sk-xx12345678".into(), notes: None,
        }).await.unwrap();
    let m = jacc_lib::commands::models::add_model_inner(
        &pool, jacc_lib::commands::models::CreateModelInput {
            api_key_id: ak.id, model_name: "m".into(), context_size: None,
        }).await.unwrap();

    // 2. bind opus
    jacc_lib::commands::slots::bind_slot_at(&pool, "opus", m.id, &settings_path).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://a.com");
    assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-xx12345678");

    // 3. 改 token
    jacc_lib::commands::api_keys::update_api_key_at(
        &pool, ak.id,
        jacc_lib::commands::api_keys::UpdateApiKeyInput {
            name: None, api_key: Some("sk-NEW12345678".into()), notes: None,
        }, &settings_path).await.unwrap();

    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-NEW12345678");

    // 4. 删 provider
    jacc_lib::commands::providers::delete_provider_at(&pool, p.id, &settings_path).await.unwrap();
    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&settings_path).unwrap()).unwrap();
    assert!(v["env"].get("ANTHROPIC_BASE_URL").is_none());
    assert!(v["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
}
```

- [ ] **步骤 3：运行集成测试**

运行：`cd packages/jacc/src-tauri && cargo test --test integration_settings_sync`
预期：通过。

- [ ] **步骤 4：完整 cargo test + clippy**

```bash
cargo test
cargo clippy --all-targets -- -D warnings
```

- [ ] **步骤 5：Commit + tag**

```bash
git add packages/jacc/src-tauri/tests/integration_settings_sync.rs \
        packages/jacc/src-tauri/src/commands/
git commit -m "test(jacc): bind/update/delete settings 同步集成测试 + pub 化 inner 函数"
git tag jacc-plan2-done
```

---

## 完成标准

- [ ] `cargo test` 全绿。
- [ ] `cargo clippy --all-targets -- -D warnings` 通过。
- [ ] settings.json 的所有写路径都通过 `claude_settings::*`。
- [ ] `bind / unbind / delete_* / update_*` 全部联动 settings.json，集成测试覆盖。
- [ ] `commands/config.rs` 转为薄包装。
- [ ] git tag `jacc-plan2-done`。




