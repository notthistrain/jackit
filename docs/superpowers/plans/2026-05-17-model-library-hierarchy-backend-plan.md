# 模型库层级数据模型 - 后端实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将扁平 models 表重构为 Provider → APIKey → Model 三层结构，重写所有后端 CRUD + slot 绑定命令。

**架构：** 3 张新表（providers、api_keys、models）替代扁平 models 表。拆分 commands/models.rs 为 4 个文件（providers.rs、api_keys.rs、models.rs、slots.rs）。每个文件提取可测试的 `_inner` 函数，Tauri 命令是薄包装。TDD：先写测试再实现。

**技术栈：** Rust (Tauri 2 + sqlx + SQLite)、tokio（异步测试）、tempfile（文件系统测试）

---

## 文件结构

### 创建
- `packages/jacc/src-tauri/src/commands/providers.rs` — Provider CRUD + `#[cfg(test)]`
- `packages/jacc/src-tauri/src/commands/api_keys.rs` — APIKey CRUD（key 掩码）+ `#[cfg(test)]`
- `packages/jacc/src-tauri/src/commands/slots.rs` — Slot 绑定（从 models.rs 提取）+ `#[cfg(test)]`

### 修改
- `packages/jacc/src-tauri/src/db.rs` — 新建 providers/api_keys 表 + 迁移旧数据
- `packages/jacc/src-tauri/src/commands/models.rs` — 重写为 Model CRUD（仅关联 api_key_id）
- `packages/jacc/src-tauri/src/commands/mod.rs` — 添加新模块
- `packages/jacc/src-tauri/src/lib.rs` — 更新命令注册

---

### 任务 1：数据库 Schema + 迁移

**文件：**
- 修改：`packages/jacc/src-tauri/src/db.rs`

- [ ] **步骤 1：编写迁移测试**

在 `db.rs` 底部添加 `#[cfg(test)] mod tests`，编写测试验证旧 schema → 新 schema 迁移。

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    /// 创建旧版扁平 schema（模拟升级前状态）
    async fn setup_old_schema() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();

        // 旧版扁平 models 表
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alias TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE model_slots (
                slot TEXT PRIMARY KEY,
                model_id INTEGER NOT NULL,
                context_size TEXT,
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_migrate_flat_to_hierarchy() {
        let pool = setup_old_schema().await;

        // 插入旧数据：两个模型共享同一个 base_url
        sqlx::query(
            "INSERT INTO models (alias, base_url, api_key, model_name, context_size)
             VALUES ('Anthropic Opus', 'https://api.anthropic.com', 'sk-ant-aaa', 'claude-opus-4-6', '200k')",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO models (alias, base_url, api_key, model_name)
             VALUES ('Anthropic Sonnet', 'https://api.anthropic.com', 'sk-ant-bbb', 'claude-sonnet-4-6')",
        )
        .execute(&pool)
        .await
        .unwrap();

        // 绑定 slot 到旧模型 id=1
        sqlx::query("INSERT INTO model_slots (slot, model_id) VALUES ('opus', 1)")
            .execute(&pool)
            .await
            .unwrap();

        // 运行迁移
        migrate_flat_models(&pool).await.unwrap();

        // 验证：1 个 provider（共享 base_url）
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM providers")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1);

        let (name, base_url): (String, String) =
            sqlx::query_as("SELECT name, base_url FROM providers LIMIT 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(base_url, "https://api.anthropic.com");

        // 验证：2 个 api_key
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM api_keys")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 2);

        // 验证：2 个 model
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM models")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 2);

        // 验证：model_slots 仍然有效（model_id 已更新）
        let (slot, model_name): (String, String) = sqlx::query_as(
            "SELECT ms.slot, m.model_name
             FROM model_slots ms JOIN models m ON ms.model_id = m.id
             WHERE ms.slot = 'opus'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(slot, "opus");
        assert_eq!(model_name, "claude-opus-4-6");

        // 验证：旧表已删除
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='models_old'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_migrate_empty_old_table() {
        let pool = setup_old_schema().await;
        // 不插入任何数据
        migrate_flat_models(&pool).await.unwrap();

        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM providers")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);

        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM models")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_migrate_different_providers() {
        let pool = setup_old_schema().await;

        sqlx::query(
            "INSERT INTO models (alias, base_url, api_key, model_name)
             VALUES ('Anthropic', 'https://api.anthropic.com', 'sk-ant-aaa', 'claude-opus-4-6')",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO models (alias, base_url, api_key, model_name)
             VALUES ('DeepSeek', 'https://api.deepseek.com', 'ds-bbb', 'deepseek-v3')",
        )
        .execute(&pool)
        .await
        .unwrap();

        migrate_flat_models(&pool).await.unwrap();

        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM providers")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 2);
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc/src-tauri && cargo test --lib db::tests -- --nocapture`
预期：编译失败，`migrate_flat_models` 未定义

- [ ] **步骤 3：实现数据库 schema 和迁移**

重写 `db.rs`。完整替换为：

```rust
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::collections::HashMap;
use std::path::PathBuf;

/// 获取数据库文件路径: ~/.jackit/toolbox/tools/jacc/data/jacc.db
pub fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".jackit").join("toolbox").join("tools").join("jacc").join("data");
    std::fs::create_dir_all(&dir).ok();
    dir.join("jacc.db")
}

pub async fn init_pool() -> Result<SqlitePool, sqlx::Error> {
    let db_path = get_db_path();
    let url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    migrate(&pool).await?;
    Ok(pool)
}

async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;

    // 新表：providers
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    // 新表：api_keys
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            api_key TEXT NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    // model_slots 表（不变）
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS model_slots (
            slot TEXT PRIMARY KEY,
            model_id INTEGER NOT NULL,
            context_size TEXT,
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    // projects 表（不变）
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            name TEXT,
            last_opened_at TEXT DEFAULT (datetime('now')),
            pinned INTEGER DEFAULT 0
        )",
    )
    .execute(pool)
    .await?;

    // preferences 表（不变）
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    // 检查是否需要从旧扁平 schema 迁移
    let models_exists: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='models'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0) > 0;

    if models_exists {
        let has_base_url: bool = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM pragma_table_info('models') WHERE name = 'base_url'",
        )
        .fetch_one(pool)
        .await
        .unwrap_or(0) > 0;

        if has_base_url {
            migrate_flat_models(pool).await?;
        }
    } else {
        // 全新安装，创建新的 models 表
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key_id INTEGER NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
            )",
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// 旧版扁平 models 表行结构（仅迁移用）
#[derive(sqlx::FromRow)]
struct OldModel {
    id: i64,
    alias: String,
    base_url: String,
    api_key: String,
    model_name: String,
    context_size: Option<String>,
}

/// 将旧版扁平 models 表迁移为 Provider → APIKey → Model 三层结构
async fn migrate_flat_models(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // 1. 重命名旧表
    sqlx::query("ALTER TABLE models RENAME TO models_old")
        .execute(pool)
        .await?;

    // 2. 创建新 models 表
    sqlx::query(
        "CREATE TABLE models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key_id INTEGER NOT NULL,
            model_name TEXT NOT NULL,
            context_size TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    // 3. 读取所有旧数据
    let old_models = sqlx::query_as::<_, OldModel>(
        "SELECT id, alias, base_url, api_key, model_name, context_size FROM models_old ORDER BY id",
    )
    .fetch_all(pool)
    .await?;

    // 4. 按 base_url 分组创建 Provider
    let mut provider_map: HashMap<String, i64> = HashMap::new();
    for m in &old_models {
        if !provider_map.contains_key(&m.base_url) {
            let id = sqlx::query("INSERT INTO providers (name, base_url) VALUES (?, ?)")
                .bind(format!("{} Provider", m.alias))
                .bind(&m.base_url)
                .execute(pool)
                .await?
                .last_insert_rowid();
            provider_map.insert(m.base_url.clone(), id);
        }
    }

    // 5. 为每行旧数据创建 APIKey + Model，建立 id 映射
    let mut id_map: HashMap<i64, i64> = HashMap::new();
    for m in &old_models {
        let provider_id = provider_map[&m.base_url];

        let ak_id = sqlx::query(
            "INSERT INTO api_keys (provider_id, name, api_key) VALUES (?, ?, ?)",
        )
        .bind(provider_id)
        .bind(format!("{} Key", m.alias))
        .bind(&m.api_key)
        .execute(pool)
        .await?
        .last_insert_rowid();

        let new_id = sqlx::query(
            "INSERT INTO models (api_key_id, model_name, context_size) VALUES (?, ?, ?)",
        )
        .bind(ak_id)
        .bind(&m.model_name)
        .bind(&m.context_size)
        .execute(pool)
        .await?
        .last_insert_rowid();

        id_map.insert(m.id, new_id);
    }

    // 6. 更新 model_slots 的 model_id
    for (old_id, new_id) in &id_map {
        sqlx::query("UPDATE model_slots SET model_id = ? WHERE model_id = ?")
            .bind(new_id)
            .bind(old_id)
            .execute(pool)
            .await?;
    }

    // 7. 删除旧表
    sqlx::query("DROP TABLE models_old")
        .execute(pool)
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    // ... (步骤 1 中的测试代码)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jacc/src-tauri && cargo test --lib db::tests -- --nocapture`
预期：3 个测试全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/db.rs
git commit -m "refactor(jacc/db): 新建 providers/api_keys 表，迁移扁平 models 为三层结构"
```

---

### 任务 2：Provider CRUD

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/providers.rs`

- [ ] **步骤 1：编写 Provider 测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn test_add_provider() {
        let pool = setup_test_db().await;
        let input = CreateProviderInput {
            name: "Anthropic".to_string(),
            base_url: "https://api.anthropic.com".to_string(),
            notes: Some("Official API".to_string()),
        };
        let p = add_provider_inner(&pool, input).await.unwrap();
        assert_eq!(p.name, "Anthropic");
        assert_eq!(p.base_url, "https://api.anthropic.com");
        assert_eq!(p.notes.as_deref(), Some("Official API"));
        assert!(p.id > 0);
    }

    #[tokio::test]
    async fn test_list_providers_empty() {
        let pool = setup_test_db().await;
        let list = list_providers_inner(&pool).await.unwrap();
        assert!(list.is_empty());
    }

    #[tokio::test]
    async fn test_list_providers_ordered() {
        let pool = setup_test_db().await;
        add_provider_inner(&pool, CreateProviderInput {
            name: "B Provider".to_string(),
            base_url: "https://b.com".to_string(),
            notes: None,
        }).await.unwrap();
        add_provider_inner(&pool, CreateProviderInput {
            name: "A Provider".to_string(),
            base_url: "https://a.com".to_string(),
            notes: None,
        }).await.unwrap();

        let list = list_providers_inner(&pool).await.unwrap();
        assert_eq!(list.len(), 2);
        // 按 created_at DESC（后插入的在前）
        assert_eq!(list[0].name, "A Provider");
        assert_eq!(list[1].name, "B Provider");
    }

    #[tokio::test]
    async fn test_update_provider() {
        let pool = setup_test_db().await;
        let p = add_provider_inner(&pool, CreateProviderInput {
            name: "Old".to_string(),
            base_url: "https://old.com".to_string(),
            notes: None,
        }).await.unwrap();

        update_provider_inner(&pool, p.id, UpdateProviderInput {
            name: Some("New".to_string()),
            base_url: Some("https://new.com".to_string()),
            notes: Some("updated".to_string()),
        }).await.unwrap();

        let list = list_providers_inner(&pool).await.unwrap();
        assert_eq!(list[0].name, "New");
        assert_eq!(list[0].base_url, "https://new.com");
        assert_eq!(list[0].notes.as_deref(), Some("updated"));
    }

    #[tokio::test]
    async fn test_delete_provider() {
        let pool = setup_test_db().await;
        let p = add_provider_inner(&pool, CreateProviderInput {
            name: "ToDelete".to_string(),
            base_url: "https://del.com".to_string(),
            notes: None,
        }).await.unwrap();

        delete_provider_inner(&pool, p.id).await.unwrap();
        let list = list_providers_inner(&pool).await.unwrap();
        assert!(list.is_empty());
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc/src-tauri && cargo test --lib commands::providers::tests -- --nocapture`
预期：编译失败，文件不存在

- [ ] **步骤 3：实现 Provider CRUD**

创建 `packages/jacc/src-tauri/src/commands/providers.rs`：

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppResult;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Provider {
    pub id: i64,
    pub name: String,
    pub base_url: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProviderInput {
    pub name: String,
    pub base_url: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProviderInput {
    pub name: Option<String>,
    pub base_url: Option<String>,
    pub notes: Option<String>,
}

pub(crate) async fn add_provider_inner(
    pool: &SqlitePool,
    input: CreateProviderInput,
) -> AppResult<Provider> {
    let notes = input.notes.as_deref().filter(|s| !s.is_empty());

    sqlx::query(
        "INSERT INTO providers (name, base_url, notes) VALUES (?, ?, ?)",
    )
    .bind(&input.name)
    .bind(&input.base_url)
    .bind(&notes)
    .execute(pool)
    .await?;

    let provider = sqlx::query_as::<_, Provider>(
        "SELECT * FROM providers WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;
    Ok(provider)
}

pub(crate) async fn list_providers_inner(pool: &SqlitePool) -> AppResult<Vec<Provider>> {
    let providers = sqlx::query_as::<_, Provider>(
        "SELECT * FROM providers ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(providers)
}

pub(crate) async fn update_provider_inner(
    pool: &SqlitePool,
    id: i64,
    input: UpdateProviderInput,
) -> AppResult<()> {
    let mut query = String::from("UPDATE providers SET updated_at = datetime('now')");
    let mut binds: Vec<String> = vec![];

    if let Some(ref name) = input.name {
        query.push_str(", name = ?");
        binds.push(name.clone());
    }
    if let Some(ref base_url) = input.base_url {
        query.push_str(", base_url = ?");
        binds.push(base_url.clone());
    }
    if let Some(ref notes) = input.notes {
        if notes.is_empty() {
            query.push_str(", notes = NULL");
        } else {
            query.push_str(", notes = ?");
            binds.push(notes.clone());
        }
    }

    query.push_str(" WHERE id = ?");

    let mut q = sqlx::query(&query);
    for b in &binds {
        q = q.bind(b);
    }
    q = q.bind(id);
    q.execute(pool).await?;
    Ok(())
}

pub(crate) async fn delete_provider_inner(pool: &SqlitePool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM providers WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// Tauri 命令（薄包装）
#[tauri::command]
pub async fn add_provider(pool: State<'_, SqlitePool>, input: CreateProviderInput) -> AppResult<Provider> {
    add_provider_inner(pool.inner(), input).await
}

#[tauri::command]
pub async fn list_providers(pool: State<'_, SqlitePool>) -> AppResult<Vec<Provider>> {
    list_providers_inner(pool.inner()).await
}

#[tauri::command]
pub async fn update_provider(pool: State<'_, SqlitePool>, id: i64, input: UpdateProviderInput) -> AppResult<()> {
    update_provider_inner(pool.inner(), id, input).await
}

#[tauri::command]
pub async fn delete_provider(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    delete_provider_inner(pool.inner(), id).await
}

#[cfg(test)]
mod tests {
    // ... (步骤 1 中的测试代码)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jacc/src-tauri && cargo test --lib commands::providers::tests -- --nocapture`
预期：5 个测试全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/providers.rs
git commit -m "feat(jacc): 添加 Provider CRUD 命令及测试"
```

---

### 任务 3：APIKey CRUD

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/api_keys.rs`

- [ ] **步骤 1：编写 APIKey 测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TABLE api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                api_key TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn insert_test_provider(pool: &SqlitePool, name: &str) -> i64 {
        sqlx::query("INSERT INTO providers (name, base_url) VALUES (?, 'https://api.test.com')")
            .bind(name)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid()
    }

    #[tokio::test]
    async fn test_add_api_key() {
        let pool = setup_test_db().await;
        let pid = insert_test_provider(&pool, "TestProvider").await;

        let input = CreateApiKeyInput {
            provider_id: pid,
            name: "Main Key".to_string(),
            api_key: "sk-ant-api123456789".to_string(),
            notes: Some("production".to_string()),
        };
        let ak = add_api_key_inner(&pool, input).await.unwrap();
        assert_eq!(ak.name, "Main Key");
        assert_eq!(ak.provider_id, pid);
        assert_eq!(ak.notes.as_deref(), Some("production"));
    }

    #[tokio::test]
    async fn test_list_api_keys_masks_key() {
        let pool = setup_test_db().await;
        let pid = insert_test_provider(&pool, "TestProvider").await;

        add_api_key_inner(&pool, CreateApiKeyInput {
            provider_id: pid,
            name: "Key1".to_string(),
            api_key: "sk-ant-123456789abc".to_string(),
            notes: None,
        }).await.unwrap();

        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        assert_eq!(views.len(), 1);
        assert_eq!(views[0].api_key_masked, "sk-ant-1***");
        assert_eq!(views[0].name, "Key1");
    }

    #[tokio::test]
    async fn test_list_api_keys_filters_by_provider() {
        let pool = setup_test_db().await;
        let pid_a = insert_test_provider(&pool, "A").await;
        let pid_b = insert_test_provider(&pool, "B").await;

        add_api_key_inner(&pool, CreateApiKeyInput {
            provider_id: pid_a,
            name: "Key A".to_string(),
            api_key: "key-a-12345678".to_string(),
            notes: None,
        }).await.unwrap();
        add_api_key_inner(&pool, CreateApiKeyInput {
            provider_id: pid_b,
            name: "Key B".to_string(),
            api_key: "key-b-12345678".to_string(),
            notes: None,
        }).await.unwrap();

        let views_a = list_api_keys_inner(&pool, pid_a).await.unwrap();
        assert_eq!(views_a.len(), 1);
        assert_eq!(views_a[0].name, "Key A");
    }

    #[tokio::test]
    async fn test_update_api_key() {
        let pool = setup_test_db().await;
        let pid = insert_test_provider(&pool, "TestProvider").await;

        add_api_key_inner(&pool, CreateApiKeyInput {
            provider_id: pid,
            name: "Old".to_string(),
            api_key: "old-key-12345678".to_string(),
            notes: None,
        }).await.unwrap();

        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        let id = views[0].id;

        update_api_key_inner(&pool, id, UpdateApiKeyInput {
            name: Some("New Name".to_string()),
            api_key: None,
            notes: Some("updated notes".to_string()),
        }).await.unwrap();

        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        assert_eq!(views[0].name, "New Name");
        assert_eq!(views[0].notes.as_deref(), Some("updated notes"));
    }

    #[tokio::test]
    async fn test_delete_api_key() {
        let pool = setup_test_db().await;
        let pid = insert_test_provider(&pool, "TestProvider").await;

        add_api_key_inner(&pool, CreateApiKeyInput {
            provider_id: pid,
            name: "ToDelete".to_string(),
            api_key: "del-key-12345678".to_string(),
            notes: None,
        }).await.unwrap();

        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        let id = views[0].id;

        delete_api_key_inner(&pool, id).await.unwrap();
        let views = list_api_keys_inner(&pool, pid).await.unwrap();
        assert!(views.is_empty());
    }

    #[tokio::test]
    async fn test_mask_short_key() {
        let view = ApiKeyView::from_api_key(&ApiKey {
            id: 1,
            provider_id: 1,
            name: "test".to_string(),
            api_key: "short".to_string(),
            notes: None,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
        });
        assert_eq!(view.api_key_masked, "***");
    }

    #[tokio::test]
    async fn test_mask_long_key() {
        let view = ApiKeyView::from_api_key(&ApiKey {
            id: 1,
            provider_id: 1,
            name: "test".to_string(),
            api_key: "sk-ant-api123456789abcdef".to_string(),
            notes: None,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
        });
        assert_eq!(view.api_key_masked, "sk-ant-a***");
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc/src-tauri && cargo test --lib commands::api_keys::tests -- --nocapture`
预期：编译失败，文件不存在

- [ ] **步骤 3：实现 APIKey CRUD**

创建 `packages/jacc/src-tauri/src/commands/api_keys.rs`：

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppResult;

#[derive(Debug, sqlx::FromRow)]
pub struct ApiKey {
    pub id: i64,
    pub provider_id: i64,
    pub name: String,
    pub api_key: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyView {
    pub id: i64,
    pub provider_id: i64,
    pub name: String,
    pub api_key_masked: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl ApiKeyView {
    pub fn from_api_key(ak: &ApiKey) -> Self {
        let masked = if ak.api_key.len() > 8 {
            format!("{}***", &ak.api_key[..8])
        } else {
            "***".to_string()
        };
        Self {
            id: ak.id,
            provider_id: ak.provider_id,
            name: ak.name.clone(),
            api_key_masked: masked,
            notes: ak.notes.clone(),
            created_at: ak.created_at.clone(),
            updated_at: ak.updated_at.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateApiKeyInput {
    pub provider_id: i64,
    pub name: String,
    pub api_key: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateApiKeyInput {
    pub name: Option<String>,
    pub api_key: Option<String>,
    pub notes: Option<String>,
}

pub(crate) async fn add_api_key_inner(
    pool: &SqlitePool,
    input: CreateApiKeyInput,
) -> AppResult<ApiKey> {
    let notes = input.notes.as_deref().filter(|s| !s.is_empty());

    sqlx::query(
        "INSERT INTO api_keys (provider_id, name, api_key, notes) VALUES (?, ?, ?, ?)",
    )
    .bind(input.provider_id)
    .bind(&input.name)
    .bind(&input.api_key)
    .bind(&notes)
    .execute(pool)
    .await?;

    let ak = sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_keys WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;
    Ok(ak)
}

pub(crate) async fn list_api_keys_inner(
    pool: &SqlitePool,
    provider_id: i64,
) -> AppResult<Vec<ApiKeyView>> {
    let keys = sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_keys WHERE provider_id = ? ORDER BY created_at DESC",
    )
    .bind(provider_id)
    .fetch_all(pool)
    .await?;
    Ok(keys.iter().map(ApiKeyView::from_api_key).collect())
}

pub(crate) async fn update_api_key_inner(
    pool: &SqlitePool,
    id: i64,
    input: UpdateApiKeyInput,
) -> AppResult<()> {
    let mut query = String::from("UPDATE api_keys SET updated_at = datetime('now')");
    let mut binds: Vec<String> = vec![];

    if let Some(ref name) = input.name {
        query.push_str(", name = ?");
        binds.push(name.clone());
    }
    if let Some(ref api_key) = input.api_key {
        query.push_str(", api_key = ?");
        binds.push(api_key.clone());
    }
    if let Some(ref notes) = input.notes {
        if notes.is_empty() {
            query.push_str(", notes = NULL");
        } else {
            query.push_str(", notes = ?");
            binds.push(notes.clone());
        }
    }

    query.push_str(" WHERE id = ?");

    let mut q = sqlx::query(&query);
    for b in &binds {
        q = q.bind(b);
    }
    q = q.bind(id);
    q.execute(pool).await?;
    Ok(())
}

pub(crate) async fn delete_api_key_inner(pool: &SqlitePool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM api_keys WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn add_api_key(pool: State<'_, SqlitePool>, input: CreateApiKeyInput) -> AppResult<ApiKeyView> {
    let ak = add_api_key_inner(pool.inner(), input).await?;
    Ok(ApiKeyView::from_api_key(&ak))
}

#[tauri::command]
pub async fn list_api_keys(pool: State<'_, SqlitePool>, provider_id: i64) -> AppResult<Vec<ApiKeyView>> {
    list_api_keys_inner(pool.inner(), provider_id).await
}

#[tauri::command]
pub async fn update_api_key(pool: State<'_, SqlitePool>, id: i64, input: UpdateApiKeyInput) -> AppResult<()> {
    update_api_key_inner(pool.inner(), id, input).await
}

#[tauri::command]
pub async fn delete_api_key(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    delete_api_key_inner(pool.inner(), id).await
}

#[cfg(test)]
mod tests {
    // ... (步骤 1 中的测试代码)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jacc/src-tauri && cargo test --lib commands::api_keys::tests -- --nocapture`
预期：7 个测试全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/api_keys.rs
git commit -m "feat(jacc): 添加 APIKey CRUD 命令及测试（含 key 掩码）"
```

---

### 任务 4：Model CRUD 重写

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/models.rs`

将现有 models.rs 完全重写。旧代码包含扁平 Model struct + slot 绑定命令。新代码只保留 Model CRUD，slot 命令移到 slots.rs（任务 5）。

- [ ] **步骤 1：编写 Model 测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TABLE api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                api_key TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key_id INTEGER NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn insert_test_api_key(pool: &SqlitePool) -> i64 {
        let pid = sqlx::query("INSERT INTO providers (name, base_url) VALUES ('Test', 'https://api.test.com')")
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid();
        sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?, 'Key', 'sk-test-12345678')")
            .bind(pid)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid()
    }

    #[tokio::test]
    async fn test_add_model() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let input = CreateModelInput {
            api_key_id: ak_id,
            model_name: "claude-opus-4-6".to_string(),
            context_size: Some("200k".to_string()),
        };
        let m = add_model_inner(&pool, input).await.unwrap();
        assert_eq!(m.model_name, "claude-opus-4-6");
        assert_eq!(m.context_size.as_deref(), Some("200k"));
        assert_eq!(m.api_key_id, ak_id);
    }

    #[tokio::test]
    async fn test_list_models_by_api_key() {
        let pool = setup_test_db().await;
        let ak1 = insert_test_api_key(&pool).await;
        let ak2 = insert_test_api_key(&pool).await;

        add_model_inner(&pool, CreateModelInput {
            api_key_id: ak1,
            model_name: "model-a".to_string(),
            context_size: None,
        }).await.unwrap();
        add_model_inner(&pool, CreateModelInput {
            api_key_id: ak2,
            model_name: "model-b".to_string(),
            context_size: None,
        }).await.unwrap();

        let models = list_models_inner(&pool, ak1).await.unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].model_name, "model-a");
    }

    #[tokio::test]
    async fn test_update_model() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let m = add_model_inner(&pool, CreateModelInput {
            api_key_id: ak_id,
            model_name: "old-name".to_string(),
            context_size: None,
        }).await.unwrap();

        update_model_inner(&pool, m.id, UpdateModelInput {
            model_name: Some("new-name".to_string()),
            context_size: Some("1m".to_string()),
        }).await.unwrap();

        let models = list_models_inner(&pool, ak_id).await.unwrap();
        assert_eq!(models[0].model_name, "new-name");
        assert_eq!(models[0].context_size.as_deref(), Some("1m"));
    }

    #[tokio::test]
    async fn test_update_model_clear_context() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let m = add_model_inner(&pool, CreateModelInput {
            api_key_id: ak_id,
            model_name: "test".to_string(),
            context_size: Some("200k".to_string()),
        }).await.unwrap();

        update_model_inner(&pool, m.id, UpdateModelInput {
            model_name: None,
            context_size: Some("".to_string()),
        }).await.unwrap();

        let models = list_models_inner(&pool, ak_id).await.unwrap();
        assert!(models[0].context_size.is_none());
    }

    #[tokio::test]
    async fn test_delete_model() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let m = add_model_inner(&pool, CreateModelInput {
            api_key_id: ak_id,
            model_name: "to-delete".to_string(),
            context_size: None,
        }).await.unwrap();

        delete_model_inner(&pool, m.id).await.unwrap();
        let models = list_models_inner(&pool, ak_id).await.unwrap();
        assert!(models.is_empty());
    }

    #[tokio::test]
    async fn test_test_model_success() {
        let pool = setup_test_db().await;
        let ak_id = insert_test_api_key(&pool).await;

        let m = add_model_inner(&pool, CreateModelInput {
            api_key_id: ak_id,
            model_name: "test-model".to_string(),
            context_size: None,
        }).await.unwrap();

        // test_model 会发 HTTP 请求，这里只验证它能正确查找 3 层关联
        // 实际 HTTP 调用会失败，但错误消息应该包含 base_url
        let result = test_model_inner(&pool, m.id).await;
        // 预期连接失败（测试环境无真实 API），但能找到正确的凭证
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("https://api.test.com"));
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc/src-tauri && cargo test --lib commands::models::tests -- --nocapture`
预期：编译失败（现有代码与新测试不匹配）

- [ ] **步骤 3：重写 models.rs**

完全重写 `packages/jacc/src-tauri/src/commands/models.rs`：

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Model {
    pub id: i64,
    pub api_key_id: i64,
    pub model_name: String,
    pub context_size: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateModelInput {
    pub api_key_id: i64,
    pub model_name: String,
    pub context_size: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModelInput {
    pub model_name: Option<String>,
    pub context_size: Option<String>,
}

pub(crate) async fn add_model_inner(
    pool: &SqlitePool,
    input: CreateModelInput,
) -> AppResult<Model> {
    let context_size = input.context_size.as_deref().filter(|s| !s.is_empty());

    sqlx::query(
        "INSERT INTO models (api_key_id, model_name, context_size) VALUES (?, ?, ?)",
    )
    .bind(input.api_key_id)
    .bind(&input.model_name)
    .bind(&context_size)
    .execute(pool)
    .await?;

    let model = sqlx::query_as::<_, Model>(
        "SELECT * FROM models WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;
    Ok(model)
}

pub(crate) async fn list_models_inner(
    pool: &SqlitePool,
    api_key_id: i64,
) -> AppResult<Vec<Model>> {
    let models = sqlx::query_as::<_, Model>(
        "SELECT * FROM models WHERE api_key_id = ? ORDER BY created_at DESC",
    )
    .bind(api_key_id)
    .fetch_all(pool)
    .await?;
    Ok(models)
}

pub(crate) async fn update_model_inner(
    pool: &SqlitePool,
    id: i64,
    input: UpdateModelInput,
) -> AppResult<()> {
    let mut query = String::from("UPDATE models SET updated_at = datetime('now')");
    let mut binds: Vec<String> = vec![];

    if let Some(ref model_name) = input.model_name {
        query.push_str(", model_name = ?");
        binds.push(model_name.clone());
    }
    if let Some(ref context_size) = input.context_size {
        if context_size.is_empty() {
            query.push_str(", context_size = NULL");
        } else {
            query.push_str(", context_size = ?");
            binds.push(context_size.clone());
        }
    }

    query.push_str(" WHERE id = ?");

    let mut q = sqlx::query(&query);
    for b in &binds {
        q = q.bind(b);
    }
    q = q.bind(id);
    q.execute(pool).await?;
    Ok(())
}

pub(crate) async fn delete_model_inner(pool: &SqlitePool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM models WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// 测试模型连接：联查 3 层获取 base_url + api_key + model_name
pub(crate) async fn test_model_inner(pool: &SqlitePool, id: i64) -> AppResult<String> {
    let row = sqlx::query_as::<_, (String, String, String)>(
        "SELECT p.base_url, ak.api_key, m.model_name
         FROM models m
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE m.id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Custom("MODEL_NOT_FOUND".to_string()))?;

    let (base_url, api_key, model_name) = row;

    let client = reqwest::Client::new();
    let url = format!("{}/v1/messages", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model_name,
        "max_tokens": 1,
        "messages": [{"role": "user", "content": "hi"}]
    });
    let resp = client
        .post(&url)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| AppError::Custom(format!("CONNECTION_FAILED:{}", e)))?;

    if resp.status().is_success() || resp.status().as_u16() == 400 {
        Ok("CONNECTION_SUCCESS".to_string())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(AppError::Custom(format!("HTTP_ERROR:{}:{}", status.as_u16(), body)))
    }
}

#[tauri::command]
pub async fn add_model(pool: State<'_, SqlitePool>, input: CreateModelInput) -> AppResult<Model> {
    add_model_inner(pool.inner(), input).await
}

#[tauri::command]
pub async fn list_models(pool: State<'_, SqlitePool>, api_key_id: i64) -> AppResult<Vec<Model>> {
    list_models_inner(pool.inner(), api_key_id).await
}

#[tauri::command]
pub async fn update_model(pool: State<'_, SqlitePool>, id: i64, input: UpdateModelInput) -> AppResult<()> {
    update_model_inner(pool.inner(), id, input).await
}

#[tauri::command]
pub async fn delete_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    delete_model_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn test_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<String> {
    test_model_inner(pool.inner(), id).await
}

#[cfg(test)]
mod tests {
    // ... (步骤 1 中的测试代码)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jacc/src-tauri && cargo test --lib commands::models::tests -- --nocapture`
预期：6 个测试全部 PASS（test_test_model_success 会因为无真实 API 而走 err 分支，但验证能找到 URL）

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/models.rs
git commit -m "refactor(jacc): 重写 Model CRUD 适配三层结构"
```

---

### 任务 5：Slot 绑定重写

**文件：**
- 创建：`packages/jacc/src-tauri/src/commands/slots.rs`

从旧 models.rs 提取 slot 相关命令，增强为 3 层联查 + 凭证自动更新。

- [ ] **步骤 1：编写 Slot 绑定测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TABLE api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                api_key TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key_id INTEGER NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TABLE model_slots (
                slot TEXT PRIMARY KEY,
                model_id INTEGER NOT NULL,
                context_size TEXT,
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    /// 插入完整 3 层结构：Provider → APIKey → Model，返回 model_id
    async fn insert_full_model(
        pool: &SqlitePool,
        provider_name: &str,
        base_url: &str,
        api_key: &str,
        model_name: &str,
    ) -> i64 {
        let pid = sqlx::query("INSERT INTO providers (name, base_url) VALUES (?, ?)")
            .bind(provider_name)
            .bind(base_url)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid();
        let ak_id = sqlx::query("INSERT INTO api_keys (provider_id, name, api_key) VALUES (?, ?, ?)")
            .bind(pid)
            .bind(format!("{} Key", provider_name))
            .bind(api_key)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid();
        sqlx::query("INSERT INTO models (api_key_id, model_name) VALUES (?, ?)")
            .bind(ak_id)
            .bind(model_name)
            .execute(pool)
            .await
            .unwrap()
            .last_insert_rowid()
    }

    #[tokio::test]
    async fn test_get_slot_bindings_empty() {
        let pool = setup_test_db().await;
        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert!(bindings.is_empty());
    }

    #[tokio::test]
    async fn test_bind_slot_returns_binding() {
        let pool = setup_test_db().await;
        let mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
        ).await;

        let binding = bind_slot_inner(&pool, "opus", mid).await.unwrap();
        assert_eq!(binding.slot, "opus");
        assert_eq!(binding.model_id, mid);
        assert_eq!(binding.model_name, "claude-opus-4-6");
        assert_eq!(binding.base_url, "https://api.anthropic.com");
        assert_eq!(binding.api_key, "sk-ant-aaa");
        assert_eq!(binding.provider_name, "Anthropic");
    }

    #[tokio::test]
    async fn test_bind_slot_upsert() {
        let pool = setup_test_db().await;
        let mid_a = insert_full_model(
            &pool, "A", "https://a.com", "key-a-12345678", "model-a",
        ).await;
        let mid_b = insert_full_model(
            &pool, "B", "https://b.com", "key-b-12345678", "model-b",
        ).await;

        bind_slot_inner(&pool, "opus", mid_a).await.unwrap();
        bind_slot_inner(&pool, "opus", mid_b).await.unwrap();

        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert_eq!(bindings.len(), 1);
        assert_eq!(bindings[0].model_name, "model-b");
    }

    #[tokio::test]
    async fn test_get_slot_bindings_multiple() {
        let pool = setup_test_db().await;
        let opus_mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
        ).await;
        let sonnet_mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-bbb", "claude-sonnet-4-6",
        ).await;

        bind_slot_inner(&pool, "opus", opus_mid).await.unwrap();
        bind_slot_inner(&pool, "sonnet", sonnet_mid).await.unwrap();

        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert_eq!(bindings.len(), 2);
    }

    #[tokio::test]
    async fn test_unbind_slot() {
        let pool = setup_test_db().await;
        let mid = insert_full_model(
            &pool, "Test", "https://test.com", "key-12345678", "model",
        ).await;

        bind_slot_inner(&pool, "opus", mid).await.unwrap();
        unbind_slot_inner(&pool, "opus").await.unwrap();

        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert!(bindings.is_empty());
    }

    #[tokio::test]
    async fn test_unbind_nonexistent_slot() {
        let pool = setup_test_db().await;
        let result = unbind_slot_inner(&pool, "nonexistent").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("SLOT_UNBOUND:nonexistent"));
    }

    #[tokio::test]
    async fn test_write_slot_to_settings() {
        let pool = setup_test_db().await;
        let mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
        ).await;
        let binding = bind_slot_inner(&pool, "opus", mid).await.unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        write_slot_to_settings_at("opus", &binding, &settings_path).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        let env = settings.get("env").unwrap();

        assert_eq!(env["ANTHROPIC_DEFAULT_OPUS_MODEL"], "claude-opus-4-6");
        assert_eq!(env["ANTHROPIC_BASE_URL"], "https://api.anthropic.com");
        assert_eq!(env["ANTHROPIC_AUTH_TOKEN"], "sk-ant-aaa");
    }

    #[tokio::test]
    async fn test_set_current_model_updates_credentials() {
        let pool = setup_test_db().await;
        // Opus 绑定到 Anthropic
        let opus_mid = insert_full_model(
            &pool, "Anthropic", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6",
        ).await;
        // Sonnet 绑定到 DeepSeek
        let sonnet_mid = insert_full_model(
            &pool, "DeepSeek", "https://api.deepseek.com", "ds-bbb", "deepseek-v3",
        ).await;

        bind_slot_inner(&pool, "opus", opus_mid).await.unwrap();
        bind_slot_inner(&pool, "sonnet", sonnet_mid).await.unwrap();

        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        // 切换到 opus → 应写入 Anthropic 凭证
        set_current_model_at(&pool, "opus", None, &settings_path).await.unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(settings["model"], "opus");
        assert_eq!(settings["env"]["ANTHROPIC_BASE_URL"], "https://api.anthropic.com");
        assert_eq!(settings["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-ant-aaa");

        // 切换到 sonnet → 应写入 DeepSeek 凭证
        set_current_model_at(&pool, "sonnet", Some("1m"), &settings_path).await.unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let settings: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(settings["model"], "sonnet[1m]");
        assert_eq!(settings["env"]["ANTHROPIC_BASE_URL"], "https://api.deepseek.com");
        assert_eq!(settings["env"]["ANTHROPIC_AUTH_TOKEN"], "ds-bbb");
    }

    #[tokio::test]
    async fn test_set_current_model_unbound_slot() {
        let pool = setup_test_db().await;
        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");

        let result = set_current_model_at(&pool, "opus", None, &settings_path).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("SLOT_NOT_BOUND:opus"));
    }

    #[tokio::test]
    async fn test_cascade_delete_provider() {
        let pool = setup_test_db().await;
        let mid = insert_full_model(
            &pool, "ToDelete", "https://del.com", "del-key-12345678", "model",
        ).await;
        bind_slot_inner(&pool, "opus", mid).await.unwrap();

        // 删除 provider → 应级联删除 api_key → model → slot
        sqlx::query("DELETE FROM providers")
            .execute(&pool)
            .await
            .unwrap();

        let bindings = get_slot_bindings_inner(&pool).await.unwrap();
        assert!(bindings.is_empty());
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd packages/jacc/src-tauri && cargo test --lib commands::slots::tests -- --nocapture`
预期：编译失败，文件不存在

- [ ] **步骤 3：实现 Slot 绑定命令**

创建 `packages/jacc/src-tauri/src/commands/slots.rs`：

```rust
use serde::Serialize;
use sqlx::SqlitePool;
use std::path::Path;
use tauri::State;

use crate::error::{AppError, AppResult};

/// Slot 绑定信息（联查 model_slots → models → api_keys → providers）
#[derive(Debug, Serialize)]
pub struct SlotBinding {
    pub slot: String,
    pub model_id: i64,
    pub model_name: String,
    pub context_size: Option<String>,
    pub api_key: String,
    pub base_url: String,
    pub provider_name: String,
}

/// 内部函数：获取所有 slot 绑定（3 层联查）
pub(crate) async fn get_slot_bindings_inner(pool: &SqlitePool) -> AppResult<Vec<SlotBinding>> {
    let rows = sqlx::query_as::<_, (String, i64, String, Option<String>, String, String, String)>(
        "SELECT ms.slot, ms.model_id, m.model_name, ms.context_size,
                ak.api_key, p.base_url, p.name
         FROM model_slots ms
         JOIN models m ON ms.model_id = m.id
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         ORDER BY ms.slot",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(slot, model_id, model_name, context_size, api_key, base_url, provider_name)| {
            SlotBinding {
                slot,
                model_id,
                model_name,
                context_size,
                api_key,
                base_url,
                provider_name,
            }
        })
        .collect())
}

/// 内部函数：绑定 slot，返回完整的 SlotBinding（含 3 层信息）
pub(crate) async fn bind_slot_inner(
    pool: &SqlitePool,
    slot: &str,
    model_id: i64,
) -> AppResult<SlotBinding> {
    // 验证模型存在且获取完整信息
    let row = sqlx::query_as::<_, (String, String, String)>(
        "SELECT m.model_name, ak.api_key, p.base_url
         FROM models m
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE m.id = ?",
    )
    .bind(model_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Custom(format!("MODEL_NOT_FOUND:{}", model_id)))?;

    let (model_name, api_key, base_url) = row;

    // 获取 provider_name
    let (provider_name,): (String,) = sqlx::query_as(
        "SELECT p.name FROM models m
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE m.id = ?",
    )
    .bind(model_id)
    .fetch_one(pool)
    .await?;

    // 写入 model_slots
    sqlx::query(
        "INSERT INTO model_slots (slot, model_id, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(slot) DO UPDATE SET model_id = excluded.model_id, updated_at = datetime('now')",
    )
    .bind(slot)
    .bind(model_id)
    .execute(pool)
    .await?;

    Ok(SlotBinding {
        slot: slot.to_string(),
        model_id,
        model_name,
        context_size: None,
        api_key,
        base_url,
        provider_name,
    })
}

/// 内部函数：解绑 slot
pub(crate) async fn unbind_slot_inner(pool: &SqlitePool, slot: &str) -> AppResult<()> {
    let rows = sqlx::query("DELETE FROM model_slots WHERE slot = ?")
        .bind(slot)
        .execute(pool)
        .await?;

    if rows.rows_affected() == 0 {
        return Err(AppError::Custom(format!("SLOT_UNBOUND:{}", slot)));
    }
    Ok(())
}

/// 内部函数：将 slot 绑定写入 settings.json 的 env
pub(crate) fn write_slot_to_settings_at(
    slot: &str,
    binding: &SlotBinding,
    settings_path: &Path,
) -> AppResult<()> {
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(settings_path)?;
        serde_json::from_str(&content)?
    } else {
        serde_json::json!({})
    };

    let env = settings
        .as_object_mut()
        .unwrap()
        .entry("env")
        .or_insert_with(|| serde_json::json!({}));

    let env_obj = env.as_object_mut().unwrap();

    // 写入全局凭证
    env_obj.insert(
        "ANTHROPIC_BASE_URL".to_string(),
        serde_json::Value::String(binding.base_url.clone()),
    );
    env_obj.insert(
        "ANTHROPIC_AUTH_TOKEN".to_string(),
        serde_json::Value::String(binding.api_key.clone()),
    );

    // 根据 slot 写入 DEFAULT_*_MODEL
    let env_key = match slot {
        "opus" => "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "sonnet" => "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "haiku" => "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        _ => "ANTHROPIC_MODEL",
    };
    env_obj.insert(
        env_key.to_string(),
        serde_json::Value::String(binding.model_name.clone()),
    );

    let content = serde_json::to_string_pretty(&settings)?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(settings_path, content)?;
    Ok(())
}

/// 内部函数：设置当前模型 + 自动更新凭证
pub(crate) async fn set_current_model_at(
    pool: &SqlitePool,
    slot: &str,
    context_size: Option<&str>,
    settings_path: &Path,
) -> AppResult<()> {
    // 查找该 slot 的绑定（3 层联查）
    let row = sqlx::query_as::<_, (String, Option<String>, String, String)>(
        "SELECT m.model_name, ms.context_size, ak.api_key, p.base_url
         FROM model_slots ms
         JOIN models m ON ms.model_id = m.id
         JOIN api_keys ak ON m.api_key_id = ak.id
         JOIN providers p ON ak.provider_id = p.id
         WHERE ms.slot = ?",
    )
    .bind(slot)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Custom(format!("SLOT_NOT_BOUND:{}", slot)))?;

    let (model_name, _slot_ctx, api_key, base_url) = row;

    // 构建 model 值
    let model_value = match context_size {
        Some(ctx) if !ctx.is_empty() => format!("{}[{}]", slot, ctx),
        _ => slot.to_string(),
    };

    // 读取/创建 settings.json
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(settings_path)?;
        serde_json::from_str(&content)?
    } else {
        serde_json::json!({})
    };

    // 写入 model 字段
    settings
        .as_object_mut()
        .unwrap()
        .insert("model".to_string(), serde_json::Value::String(model_value));

    // 写入 env 凭证
    let env = settings
        .as_object_mut()
        .unwrap()
        .entry("env")
        .or_insert_with(|| serde_json::json!({}));

    let env_obj = env.as_object_mut().unwrap();
    env_obj.insert(
        "ANTHROPIC_BASE_URL".to_string(),
        serde_json::Value::String(base_url),
    );
    env_obj.insert(
        "ANTHROPIC_AUTH_TOKEN".to_string(),
        serde_json::Value::String(api_key),
    );

    let content = serde_json::to_string_pretty(&settings)?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(settings_path, content)?;
    Ok(())
}

fn get_global_settings_path() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".claude").join("settings.json")
}

// Tauri 命令
#[tauri::command]
pub async fn get_slot_bindings(pool: State<'_, SqlitePool>) -> AppResult<Vec<SlotBinding>> {
    get_slot_bindings_inner(pool.inner()).await
}

#[tauri::command]
pub async fn bind_slot(pool: State<'_, SqlitePool>, slot: String, model_id: i64) -> AppResult<()> {
    let binding = bind_slot_inner(pool.inner(), &slot, model_id).await?;
    write_slot_to_settings_at(&slot, &binding, &get_global_settings_path())?;
    Ok(())
}

#[tauri::command]
pub async fn unbind_slot(pool: State<'_, SqlitePool>, slot: String) -> AppResult<()> {
    unbind_slot_inner(pool.inner(), &slot).await
}

#[tauri::command]
pub async fn set_current_model(slot: String, context_size: Option<String>) -> AppResult<()> {
    let pool = /* 需要获取 pool */ ;
    // 注意：set_current_model 需要 pool 来查找绑定
    // 方案：改为接收 pool State
    todo!("需要调整签名，见下方说明")
}

#[cfg(test)]
mod tests {
    // ... (步骤 1 中的测试代码)
}
```

**重要说明：** `set_current_model` 当前签名是 `(slot, context_size)` 不含 pool。但新设计需要 pool 来查找 3 层绑定。需要改为：

```rust
#[tauri::command]
pub async fn set_current_model(
    pool: State<'_, SqlitePool>,
    slot: String,
    context_size: Option<String>,
) -> AppResult<()> {
    set_current_model_at(pool.inner(), &slot, context_size.as_deref(), &get_global_settings_path()).await
}
```

前端调用时需加上 `pool` 是自动注入的，前端不需要传。

- [ ] **步骤 4：运行测试验证通过**

运行：`cd packages/jacc/src-tauri && cargo test --lib commands::slots::tests -- --nocapture`
预期：10 个测试全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/slots.rs
git commit -m "feat(jacc): 添加 Slot 绑定命令（3 层联查 + 凭证自动更新）及测试"
```

---

### 任务 6：模块注册 + 清理 + 编译验证

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/mod.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：更新 mod.rs**

修改 `packages/jacc/src-tauri/src/commands/mod.rs`：

```rust
pub mod api_keys;
pub mod config;
pub mod log;
pub mod models;
pub mod preferences;
pub mod projects;
pub mod providers;
pub mod skills;
pub mod slots;
```

- [ ] **步骤 2：更新 lib.rs 命令注册**

修改 `packages/jacc/src-tauri/src/lib.rs` 的 `invoke_handler`：

```rust
.invoke_handler(tauri::generate_handler![
    // log
    commands::log::log_debug,
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
    // providers
    commands::providers::add_provider,
    commands::providers::list_providers,
    commands::providers::update_provider,
    commands::providers::delete_provider,
    // api_keys
    commands::api_keys::add_api_key,
    commands::api_keys::list_api_keys,
    commands::api_keys::update_api_key,
    commands::api_keys::delete_api_key,
    // models
    commands::models::add_model,
    commands::models::list_models,
    commands::models::update_model,
    commands::models::delete_model,
    commands::models::test_model,
    // slot bindings
    commands::slots::get_slot_bindings,
    commands::slots::bind_slot,
    commands::slots::unbind_slot,
    commands::slots::set_current_model,
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
```

- [ ] **步骤 3：运行完整编译 + 全部测试**

运行：`cd packages/jacc/src-tauri && cargo test --lib -- --nocapture`
预期：所有测试通过（db + providers + api_keys + models + slots），编译无错误

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/mod.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "refactor(jacc): 注册新模块，清理旧命令引用"
```
