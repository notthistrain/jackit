# 模型 Slot 绑定架构重设计 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将模型 slot 绑定从模型库页面移到通用页面，模型库变为纯 CRUD，通用页面统一管理 slot 绑定和当前模型选择。

**架构：** 新增 `model_slots` 关联表存储 slot 与模型的绑定关系；后端新增 `get_slot_bindings`/`bind_slot`/`unbind_slot`/`set_current_model` 四个命令；前端模型库页面简化为纯列表，通用页面新增 slot 绑定区和当前模型选择器。

**技术栈：** Rust/Tauri (sqlx + SQLite), React/TypeScript, i18n JSON

---

## 文件结构

### 后端 (Rust)
- **修改** `packages/jacc/src-tauri/src/db.rs` — 重建 models 表（移除 slot 字段）+ 新建 model_slots 表 + 启用 SQLite foreign_keys
- **修改** `packages/jacc/src-tauri/src/commands/models.rs` — 移除 slot 相关字段和旧命令，新增 slot 绑定命令
- **修改** `packages/jacc/src-tauri/src/lib.rs` — 更新 invoke_handler 注册新命令

### 前端 (React/TypeScript)
- **修改** `packages/jacc/src/hooks/useModels.ts` — 移除 slot/bind 相关类型和方法，新增 slot 绑定 hook
- **修改** `packages/jacc/src/pages/Models.tsx` — 简化为纯模型列表（无 slot 选择、无绑定按钮）
- **修改** `packages/jacc/src/pages/General.tsx` — 新增 slot 绑定区和当前模型选择器
- **修改** `packages/jacc/src/components/dialogs/AddModelDialog.tsx` — 移除 slot 字段
- **修改** `packages/jacc/src/pages/EnvVars.tsx` — 更新 MODEL_ENV_KEYS 列表

### i18n
- **修改** `packages/jacc/src/i18n/locales/zh.json` — 更新/新增文案
- **修改** `packages/jacc/src/i18n/locales/en.json` — 更新/新增文案

---

### 任务 1：数据库迁移 — 重建 models 表 + 新建 model_slots 表

**文件：**
- 修改：`packages/jacc/src-tauri/src/db.rs`

- [ ] **步骤 1：修改 migrate 函数**

将 `db.rs` 中的 `migrate` 函数替换为以下内容。核心变更：
1. 重建 models 表（移除 slot 字段）
2. 新建 model_slots 表
3. 启用 SQLite `foreign_keys` pragma（ON DELETE CASCADE 需要）

```rust
async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // 启用 foreign keys（ON DELETE CASCADE 需要）
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS models (
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
    .execute(pool)
    .await?;

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

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    // 迁移：如果旧 models 表有 slot 列，重建表移除它
    // SQLite 不支持 DROP COLUMN，需要重建
    let has_slot: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM pragma_table_info('models') WHERE name = 'slot'"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0) > 0;

    if has_slot {
        sqlx::query(
            "CREATE TABLE models_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alias TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )"
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "INSERT INTO models_new (id, alias, base_url, api_key, model_name, context_size, created_at, updated_at)
             SELECT id, alias, base_url, api_key, model_name, context_size, created_at, updated_at FROM models"
        )
        .execute(pool)
        .await?;

        sqlx::query("DROP TABLE models")
            .execute(pool)
            .await?;

        sqlx::query("ALTER TABLE models_new RENAME TO models")
            .execute(pool)
            .await?;
    }

    // 迁移：添加 context_size 字段（如果尚未存在）
    let has_ctx: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM pragma_table_info('models') WHERE name = 'context_size'"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0) > 0;

    if !has_ctx {
        sqlx::query("ALTER TABLE models ADD COLUMN context_size TEXT DEFAULT NULL")
            .execute(pool)
            .await
            .ok();
    }

    Ok(())
}
```

- [ ] **步骤 2：编译验证**

运行：`cd packages/jacc/src-tauri && cargo check`
预期：编译通过（此时 models.rs 中引用 slot 的代码会报错，下一步修复）

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/db.rs
git commit -m "refactor(jacc): 重建 models 表移除 slot 字段，新建 model_slots 关联表"
```

---

### 任务 2：后端 API — 重写 models.rs

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/models.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：重写 models.rs**

将 `packages/jacc/src-tauri/src/commands/models.rs` 完整替换为以下内容：

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Model {
    pub id: i64,
    pub alias: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
    pub context_size: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// 返回给前端的模型信息，API key 做掩码处理
#[derive(Debug, Serialize)]
pub struct ModelView {
    pub id: i64,
    pub alias: String,
    pub base_url: String,
    pub api_key_masked: String,
    pub model_name: String,
    pub context_size: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&Model> for ModelView {
    fn from(m: &Model) -> Self {
        let masked = if m.api_key.len() > 8 {
            format!("{}***", &m.api_key[..8])
        } else {
            "***".to_string()
        };
        Self {
            id: m.id,
            alias: m.alias.clone(),
            base_url: m.base_url.clone(),
            api_key_masked: masked,
            model_name: m.model_name.clone(),
            context_size: m.context_size.clone(),
            created_at: m.created_at.clone(),
            updated_at: m.updated_at.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateModelInput {
    pub alias: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
    pub context_size: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModelInput {
    pub alias: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub model_name: Option<String>,
    pub context_size: Option<String>,
}

/// slot 绑定信息（联查 model_slots + models）
#[derive(Debug, Serialize)]
pub struct SlotBinding {
    pub slot: String,
    pub model_id: i64,
    pub alias: String,
    pub base_url: String,
    pub model_name: String,
    pub api_key: String,
    pub context_size: Option<String>,
}

#[tauri::command]
pub async fn list_models(pool: State<'_, SqlitePool>) -> AppResult<Vec<ModelView>> {
    let models = sqlx::query_as::<_, Model>(
        "SELECT id, alias, base_url, api_key, model_name, context_size, created_at, updated_at
         FROM models ORDER BY created_at DESC",
    )
    .fetch_all(pool.inner())
    .await?;
    Ok(models.iter().map(ModelView::from).collect())
}

#[tauri::command]
pub async fn add_model(pool: State<'_, SqlitePool>, input: CreateModelInput) -> AppResult<ModelView> {
    let context_size = input.context_size.as_deref().filter(|s| !s.is_empty());

    let id = sqlx::query(
        "INSERT INTO models (alias, base_url, api_key, model_name, context_size) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&input.alias)
    .bind(&input.base_url)
    .bind(&input.api_key)
    .bind(&input.model_name)
    .bind(&context_size)
    .execute(pool.inner())
    .await?
    .last_insert_rowid();

    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;
    Ok(ModelView::from(&model))
}

#[tauri::command]
pub async fn update_model(pool: State<'_, SqlitePool>, id: i64, input: UpdateModelInput) -> AppResult<()> {
    let mut query = String::from("UPDATE models SET updated_at = datetime('now')");
    let mut binds: Vec<String> = vec![];

    if let Some(ref alias) = input.alias {
        query.push_str(", alias = ?");
        binds.push(alias.clone());
    }
    if let Some(ref base_url) = input.base_url {
        query.push_str(", base_url = ?");
        binds.push(base_url.clone());
    }
    if let Some(ref api_key) = input.api_key {
        query.push_str(", api_key = ?");
        binds.push(api_key.clone());
    }
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
    q.execute(pool.inner()).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM models WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn test_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<String> {
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;

    let client = reqwest::Client::new();
    let url = format!("{}/v1/messages", model.base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model.model_name,
        "max_tokens": 1,
        "messages": [{"role": "user", "content": "hi"}]
    });
    let resp = client
        .post(&url)
        .header("x-api-key", &model.api_key)
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

/// 获取所有 slot 的绑定信息
#[tauri::command]
pub async fn get_slot_bindings(pool: State<'_, SqlitePool>) -> AppResult<Vec<SlotBinding>> {
    let bindings = sqlx::query_as::<_, (String, i64, String, String, String, String, Option<String>)>(
        "SELECT ms.slot, ms.model_id, m.alias, m.base_url, m.model_name, m.api_key, ms.context_size
         FROM model_slots ms JOIN models m ON ms.model_id = m.id
         ORDER BY ms.slot",
    )
    .fetch_all(pool.inner())
    .await?;

    Ok(bindings
        .into_iter()
        .map(|(slot, model_id, alias, base_url, model_name, api_key, context_size)| SlotBinding {
            slot,
            model_id,
            alias,
            base_url,
            model_name,
            api_key,
            context_size,
        })
        .collect())
}

/// 绑定模型到 slot，并写入 settings.json 环境变量
#[tauri::command]
pub async fn bind_slot(pool: State<'_, SqlitePool>, slot: String, model_id: i64) -> AppResult<()> {
    // 验证模型存在
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(model_id)
        .fetch_one(pool.inner())
        .await?;

    // 写入或更新 model_slots
    sqlx::query(
        "INSERT INTO model_slots (slot, model_id, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(slot) DO UPDATE SET model_id = excluded.model_id, updated_at = datetime('now')",
    )
    .bind(&slot)
    .bind(model_id)
    .execute(pool.inner())
    .await?;

    // 写入 settings.json 环境变量
    write_slot_to_settings(&slot, &model)?;

    Ok(())
}

/// 解绑 slot
#[tauri::command]
pub async fn unbind_slot(pool: State<'_, SqlitePool>, slot: String) -> AppResult<()> {
    let rows = sqlx::query("DELETE FROM model_slots WHERE slot = ?")
        .bind(&slot)
        .execute(pool.inner())
        .await?;

    if rows.rows_affected() == 0 {
        return Err(AppError::Custom(format!("SLOT_UNBOUND:{}", slot)));
    }
    Ok(())
}

/// 设置当前模型（写入 settings.json 的 model 字段）
#[tauri::command]
pub async fn set_current_model(slot: String, context_size: Option<String>) -> AppResult<()> {
    let model_value = match &context_size {
        Some(ctx) if !ctx.is_empty() => format!("{}[{}]", slot, ctx),
        _ => slot.clone(),
    };

    let settings_path = get_global_settings_path();

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)?;
        serde_json::from_str(&content)?
    } else {
        serde_json::json!({})
    };

    settings
        .as_object_mut()
        .unwrap()
        .insert("model".to_string(), serde_json::Value::String(model_value));

    let content = serde_json::to_string_pretty(&settings)?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&settings_path, content)?;
    Ok(())
}

/// 将 slot 绑定的模型信息写入 settings.json 的 env
fn write_slot_to_settings(slot: &str, model: &Model) -> AppResult<()> {
    let settings_path = get_global_settings_path();

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)?;
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

    // 写入全局凭证（每次绑定覆盖）
    env_obj.insert(
        "ANTHROPIC_BASE_URL".to_string(),
        serde_json::Value::String(model.base_url.clone()),
    );
    env_obj.insert(
        "ANTHROPIC_AUTH_TOKEN".to_string(),
        serde_json::Value::String(model.api_key.clone()),
    );

    // 根据 slot 写入对应的 DEFAULT_*_MODEL 环境变量
    let env_key = match slot {
        "opus" => "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "sonnet" => "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "haiku" => "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        _ => "ANTHROPIC_MODEL",
    };
    env_obj.insert(
        env_key.to_string(),
        serde_json::Value::String(model.model_name.clone()),
    );

    let content = serde_json::to_string_pretty(&settings)?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&settings_path, content)?;
    Ok(())
}

fn get_global_settings_path() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join(".claude").join("settings.json")
}
```

- [ ] **步骤 2：更新 lib.rs 的 invoke_handler**

将 `packages/jacc/src-tauri/src/lib.rs` 中的 invoke_handler 部分（第 31-64 行）替换为：

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
            // models
            commands::models::list_models,
            commands::models::add_model,
            commands::models::update_model,
            commands::models::delete_model,
            commands::models::test_model,
            // slot bindings
            commands::models::get_slot_bindings,
            commands::models::bind_slot,
            commands::models::unbind_slot,
            commands::models::set_current_model,
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

- [ ] **步骤 3：编译验证**

运行：`cd packages/jacc/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/models.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "refactor(jacc): 重写后端 API，新增 slot 绑定命令，移除旧 bind_model/activate_slot"
```

---

### 任务 3：前端 hook 和类型更新

**文件：**
- 修改：`packages/jacc/src/hooks/useModels.ts`

- [ ] **步骤 1：重写 useModels.ts**

将 `packages/jacc/src/hooks/useModels.ts` 完整替换为：

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface Model {
  id: number
  alias: string
  base_url: string
  api_key_masked: string
  model_name: string
  context_size: string | null
  created_at: string
  updated_at: string
}

export interface CreateModelInput {
  alias: string
  base_url: string
  api_key: string
  model_name: string
  context_size: string | null
}

export interface UpdateModelInput {
  alias?: string
  base_url?: string
  api_key?: string
  model_name?: string
  context_size?: string
}

export interface SlotBinding {
  slot: string
  model_id: number
  alias: string
  base_url: string
  model_name: string
  context_size: string | null
}

export function useModels() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<Model[]>('list_models')
      setModels(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(async (input: CreateModelInput) => {
    await invoke('add_model', { input })
    await refresh()
  }, [refresh])

  const update = useCallback(async (id: number, input: UpdateModelInput) => {
    await invoke('update_model', { id, input })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await invoke('delete_model', { id })
    await refresh()
  }, [refresh])

  const test = useCallback(async (id: number): Promise<string> => {
    return invoke<string>('test_model', { id })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { models, loading, refresh, add, update, remove, test }
}

export function useSlotBindings() {
  const [bindings, setBindings] = useState<SlotBinding[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await invoke<SlotBinding[]>('get_slot_bindings')
      setBindings(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const bind = useCallback(async (slot: string, modelId: number) => {
    await invoke('bind_slot', { slot, modelId })
    await refresh()
  }, [refresh])

  const unbind = useCallback(async (slot: string) => {
    await invoke('unbind_slot', { slot })
    await refresh()
  }, [refresh])

  const setCurrentModel = useCallback(async (slot: string, contextSize: string | null) => {
    await invoke('set_current_model', { slot, contextSize })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { bindings, loading, refresh, bind, unbind, setCurrentModel }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/hooks/useModels.ts
git commit -m "refactor(jacc): 更新前端 hook，新增 useSlotBindings，移除旧 slot/bind 类型"
```

---

### 任务 4：前端 — 简化模型库页面

**文件：**
- 修改：`packages/jacc/src/pages/Models.tsx`
- 修改：`packages/jacc/src/components/dialogs/AddModelDialog.tsx`

- [ ] **步骤 1：重写 Models.tsx**

将 `packages/jacc/src/pages/Models.tsx` 完整替换为：

```tsx
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Fab } from '@/components/Fab'
import { AddModelDialog } from '@/components/dialogs/AddModelDialog'
import { useModels, type Model } from '@/hooks/useModels'
import { useT } from '@/i18n'

export function Models() {
  const { t } = useT()
  const { models, add, test, remove, update } = useModels()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Model | null>(null)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null)
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (menuOpen === null) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  function formatTestResult(raw: string): string {
    if (raw === 'CONNECTION_SUCCESS') return t('models.testSuccess')
    if (raw.startsWith('CONNECTION_FAILED:')) return t('models.testFailed', { error: raw.slice(18) })
    if (raw.startsWith('HTTP_ERROR:')) return t('models.testFailed', { error: raw.slice(11) })
    return raw
  }

  async function handleTest(id: number) {
    setTesting(id)
    setTestResult(null)
    try {
      const msg = await test(id)
      setTestResult({ id, msg: formatTestResult(msg), ok: true })
    } catch (e) {
      setTestResult({ id, msg: formatTestResult(String(e)), ok: false })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('models.title')}</h2>

      <div className="flex flex-col gap-2">
        {models.map((model) => (
          <div
            key={model.id}
            className="flex items-center justify-between px-4 py-3 bg-card border border-border-light rounded-[4px]"
          >
            <div className="min-w-0 flex-1 mr-3">
              <div className="text-[13px] font-medium text-foreground">{model.alias}</div>
              <div className="text-[11px] text-muted truncate">
                {model.base_url} · {model.model_name}
                {model.context_size && ` · ${model.context_size}`}
              </div>
              {testResult?.id === model.id && (
                <div className={`text-[10px] mt-1 truncate ${testResult.ok ? 'text-success' : 'text-danger'}`} title={testResult.msg}>
                  {testResult.msg}
                </div>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => handleTest(model.id)}
                disabled={testing === model.id}
                className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar disabled:opacity-50 cursor-pointer"
              >
                {testing === model.id ? '...' : t('models.test')}
              </button>
              <div className="relative" ref={menuOpen === model.id ? menuRef : undefined}>
                <button
                  onClick={() => setMenuOpen(menuOpen === model.id ? null : model.id)}
                  className="text-[11px] px-2 py-1 bg-card border border-border rounded-[2px] text-muted hover:bg-sidebar cursor-pointer"
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen === model.id && (
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-10 py-1 min-w-[80px]">
                    <button
                      onClick={() => { setEditing(model); setMenuOpen(null) }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-sidebar"
                    >
                      {t('models.edit')}
                    </button>
                    <button
                      onClick={() => { remove(model.id); setMenuOpen(null) }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-danger hover:bg-sidebar"
                    >
                      {t('models.delete')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {models.length === 0 && (
        <div className="px-4 py-3 bg-sidebar border border-border-light rounded-[4px] text-xs text-muted text-center">
          {t('models.empty')}
        </div>
      )}

      <Fab onClick={() => setShowAdd(true)} />
      <AddModelDialog open={showAdd} onClose={() => setShowAdd(false)} onSubmit={add} />
      <AddModelDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={async (input) => {
          if (editing) {
            await update(editing.id, {
              alias: input.alias,
              base_url: input.base_url,
              api_key: input.api_key || undefined,
              model_name: input.model_name,
              context_size: input.context_size === null ? undefined : input.context_size,
            })
          }
        }}
        initialValues={editing ? {
          alias: editing.alias,
          base_url: editing.base_url,
          api_key: '',
          model_name: editing.model_name,
          context_size: editing.context_size || '',
        } : undefined}
      />
    </div>
  )
}
```

- [ ] **步骤 2：简化 AddModelDialog.tsx**

将 `packages/jacc/src/components/dialogs/AddModelDialog.tsx` 完整替换为：

```tsx
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CreateModelInput } from '@/hooks/useModels'
import { useT } from '@/i18n'

interface AddModelDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateModelInput) => Promise<void>
  initialValues?: {
    alias: string
    base_url: string
    api_key: string
    model_name: string
    context_size: string
  }
}

export function AddModelDialog({ open, onClose, onSubmit, initialValues }: AddModelDialogProps) {
  const { t } = useT()
  const [alias, setAlias] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [contextSize, setContextSize] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && initialValues) {
      setAlias(initialValues.alias)
      setBaseUrl(initialValues.base_url)
      setApiKey(initialValues.api_key)
      setModelName(initialValues.model_name)
      setContextSize(initialValues.context_size)
    } else if (!open) {
      setAlias('')
      setBaseUrl('')
      setApiKey('')
      setModelName('')
      setContextSize('')
    }
  }, [open, initialValues])

  if (!open) return null

  const isEdit = !!initialValues

  async function handleSubmit() {
    if (!alias || !baseUrl || !modelName) return
    if (!isEdit && !apiKey) return
    setSubmitting(true)
    try {
      await onSubmit({
        alias,
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName,
        context_size: contextSize || null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[400px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-5">
          {isEdit ? t('models.dialog.editTitle') : t('models.dialog.addTitle')}
        </h3>

        <div className="flex flex-col gap-3.5">
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.alias')} {t('models.dialog.required')}</div>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={t('models.dialog.aliasPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.baseUrl')} {t('models.dialog.required')}</div>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t('models.dialog.baseUrlPlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">
              {isEdit ? t('models.dialog.apiKeyEdit') : t('models.dialog.apiKey')} {!isEdit && t('models.dialog.required')}
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isEdit ? t('models.dialog.apiKeyEditPlaceholder') : t('models.dialog.apiKeyPlaceholder')}
                className="w-full bg-sidebar border border-border px-3 py-2 pr-9 rounded-[4px] text-xs text-foreground"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.modelName')} {t('models.dialog.required')}</div>
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={t('models.dialog.modelNamePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.contextSize')}</div>
            <input
              value={contextSize}
              onChange={(e) => setContextSize(e.target.value)}
              placeholder={t('models.dialog.contextSizePlaceholder')}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar"
          >
            {t('models.dialog.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !alias || !baseUrl || !modelName || (!isEdit && !apiKey)}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50"
          >
            {submitting ? t('models.dialog.saving') : t('models.dialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src/pages/Models.tsx packages/jacc/src/components/dialogs/AddModelDialog.tsx
git commit -m "refactor(jacc): 简化模型库页面为纯 CRUD，移除 slot 绑定功能"
```

---

### 任务 5：前端 — 重写通用页面

**文件：**
- 修改：`packages/jacc/src/pages/General.tsx`

- [ ] **步骤 1：重写 General.tsx**

将 `packages/jacc/src/pages/General.tsx` 完整替换为：

```tsx
import { useState } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { useModels } from '@/hooks/useModels'
import { useSlotBindings } from '@/hooks/useModels'
import { useAppStore } from '@/stores/useAppStore'
import { usePreferences } from '@/hooks/usePreferences'
import { SourceBadge } from '@/components/SourceBadge'
import { useT, type Locale } from '@/i18n'

type Slot = 'opus' | 'sonnet' | 'haiku'

const SLOTS: Slot[] = ['opus', 'sonnet', 'haiku']

const SLOT_LABELS: Record<Slot, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' }

const CONTEXT_OPTIONS = ['', '1m']

export function General() {
  const { t, locale, setLocale } = useT()
  const { config, loading, writeConfig } = useConfig()
  const { models } = useModels()
  const { bindings, bind, unbind, setCurrentModel } = useSlotBindings()
  const { setPage } = useAppStore()
  const { set: setPreference } = usePreferences()

  // 当前模型状态
  const [currentSlot, setCurrentSlot] = useState<Slot>('opus')
  const [currentCtx, setCurrentCtx] = useState('')

  if (loading || !config) {
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>
  }

  const getItem = (key: string) => config.items.find((i) => i.key === key)
  const effortLevel = getItem('effortLevel')
  const skipDangerous = getItem('skipDangerousModePermissionPrompt')

  function getBinding(slot: Slot) {
    return bindings.find((b) => b.slot === slot)
  }

  async function handleSlotModelChange(slot: Slot, modelIdStr: string) {
    if (modelIdStr === '') {
      await unbind(slot)
    } else {
      await bind(slot, Number(modelIdStr))
    }
  }

  async function handleApplyCurrentModel() {
    await setCurrentModel(currentSlot, currentCtx || null)
  }

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale)
    setPreference('locale', newLocale)
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-5">{t('general.title')}</h2>

      <div className="flex flex-col gap-2.5">
        {/* 模型槽位 */}
        <div className="p-3 bg-card border border-border-light rounded-[4px]">
          <div className="text-[13px] font-medium text-foreground mb-2.5">{t('general.slots')}</div>
          <div className="flex flex-col gap-2">
            {SLOTS.map((slot) => {
              const binding = getBinding(slot)
              return (
                <div key={slot} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted w-[52px]">{SLOT_LABELS[slot]}</span>
                  <select
                    value={binding?.model_id ?? ''}
                    onChange={(e) => handleSlotModelChange(slot, e.target.value)}
                    className="flex-1 bg-sidebar border border-border text-foreground px-2 py-1.5 rounded-[2px] text-xs"
                  >
                    <option value="">{t('general.slot.unbound')}</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.alias} ({m.model_name})</option>
                    ))}
                  </select>
                  <span className={`text-[10px] w-[40px] text-center ${binding ? 'text-success' : 'text-muted'}`}>
                    {binding ? t('general.slot.bound') : t('general.slot.unboundLabel')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 当前模型 */}
        <div className="p-3 bg-card border border-border-light rounded-[4px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-foreground">{t('general.currentModel')}</div>
              <div className="text-[11px] text-muted">{t('general.currentModel.desc')}</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={currentSlot}
                onChange={(e) => setCurrentSlot(e.target.value as Slot)}
                className="bg-sidebar border border-border text-foreground px-2 py-1 rounded-[2px] text-xs"
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>{SLOT_LABELS[s]}</option>
                ))}
              </select>
              <select
                value={currentCtx}
                onChange={(e) => setCurrentCtx(e.target.value)}
                className="bg-sidebar border border-border text-foreground px-2 py-1 rounded-[2px] text-xs"
              >
                <option value="">{t('general.ctxDefault')}</option>
                {CONTEXT_OPTIONS.filter(c => c).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={handleApplyCurrentModel}
                className="px-3 py-1 bg-primary text-white text-xs rounded-[2px]"
              >
                {t('general.apply')}
              </button>
            </div>
          </div>
          <div className="text-[10px] text-muted mt-1.5 font-mono">
            → model = "{currentSlot}{currentCtx ? `[${currentCtx}]` : ''}"
          </div>
        </div>

        {/* Effort Level */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.effortLevel')}</div>
            <div className="text-[11px] text-muted">{t('general.effortLevel.desc')}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={(effortLevel?.value as string) || 'high'}
              onChange={(e) =>
                writeConfig(effortLevel?.scope || 'global', 'effortLevel', e.target.value)
              }
              className="bg-sidebar border border-border text-foreground px-2.5 py-1 rounded-[2px] text-xs"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="max">max</option>
              <option value="auto">auto</option>
            </select>
            {effortLevel && <SourceBadge scope={effortLevel.scope} />}
          </div>
        </div>

        {/* 跳过危险模式确认 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.skipDangerous')}</div>
            <div className="text-[11px] text-muted">{t('general.skipDangerous.desc')}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                writeConfig(
                  skipDangerous?.scope || 'global',
                  'skipDangerousModePermissionPrompt',
                  !(skipDangerous?.value as boolean),
                )
              }
              className={`w-9 h-5 rounded-full relative transition-colors ${
                skipDangerous?.value ? 'bg-primary' : 'bg-border'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                  skipDangerous?.value ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
            {skipDangerous && <SourceBadge scope={skipDangerous.scope} />}
          </div>
        </div>

        {/* 语言 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.language')}</div>
            <div className="text-[11px] text-muted">{t('general.language.desc')}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value as Locale)}
              className="bg-sidebar border border-border text-foreground px-2.5 py-1 rounded-[2px] text-xs"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/pages/General.tsx
git commit -m "feat(jacc): 重写通用页面，新增 slot 绑定区和当前模型选择器"
```

---

### 任务 6：i18n 更新

**文件：**
- 修改：`packages/jacc/src/i18n/locales/zh.json`
- 修改：`packages/jacc/src/i18n/locales/en.json`

- [ ] **步骤 1：更新中文 i18n**

在 `zh.json` 中：
- 移除 `"models.slot.label"`、`"models.currentBound"`、`"models.bound"`、`"models.unbound"`、`"models.bind"`、`"models.dialog.slot"`、`"models.dialog.slotNone"` 这些 key
- 修改 `"general.model"` 和 `"general.model.desc"` 的值
- 新增通用页面 slot 相关文案
- 新增 `"models.empty"` key

修改后的完整 `zh.json`：

```json
{
  "app.title": "jacc",
  "sidebar.config": "配置",
  "sidebar.general": "通用",
  "sidebar.envvars": "环境变量",
  "sidebar.permissions": "权限",
  "sidebar.mcp": "MCP 服务器",
  "sidebar.models": "模型库",
  "sidebar.extensions": "扩展",
  "sidebar.skills": "Skills",
  "sidebar.agents": "Agents",
  "sidebar.theme.system": "跟随系统",
  "sidebar.theme.light": "浅色",
  "sidebar.theme.dark": "深色",
  "general.title": "通用设置",
  "general.slots": "模型槽位",
  "general.slot.bound": "已绑定",
  "general.slot.unbound": "未绑定",
  "general.slot.unboundLabel": "未绑定",
  "general.currentModel": "当前模型",
  "general.currentModel.desc": "设置 Claude Code 使用的模型和上下文大小",
  "general.ctxDefault": "默认",
  "general.apply": "应用",
  "general.model.manage": "管理",
  "general.effortLevel": "Effort Level",
  "general.effortLevel.desc": "推理努力程度",
  "general.skipDangerous": "跳过危险模式确认",
  "general.skipDangerous.desc": "启用后不再弹出危险操作确认提示",
  "general.language": "语言",
  "general.language.desc": "界面显示语言",
  "models.title": "模型库",
  "models.empty": "暂无模型，点击 + 添加",
  "models.test": "测试",
  "models.edit": "编辑",
  "models.delete": "删除",
  "models.testSuccess": "连接成功",
  "models.testFailed": "连接失败: {error}",
  "models.dialog.addTitle": "添加模型配置",
  "models.dialog.editTitle": "编辑模型配置",
  "models.dialog.alias": "别名",
  "models.dialog.aliasPlaceholder": "如：Claude Opus 官方",
  "models.dialog.baseUrl": "API 端点 (Base URL)",
  "models.dialog.baseUrlPlaceholder": "https://api.anthropic.com",
  "models.dialog.apiKey": "API Key",
  "models.dialog.apiKeyEdit": "API Key (留空不修改)",
  "models.dialog.apiKeyPlaceholder": "sk-ant-...",
  "models.dialog.apiKeyEditPlaceholder": "留空保持不变",
  "models.dialog.modelName": "模型名称",
  "models.dialog.modelNamePlaceholder": "claude-opus-4-6",
  "models.dialog.contextSize": "上下文容量",
  "models.dialog.contextSizePlaceholder": "如：200k、1m",
  "models.dialog.cancel": "取消",
  "models.dialog.save": "保存",
  "models.dialog.saving": "保存中...",
  "models.dialog.required": "*",
  "skills.title": "Skills",
  "skills.tab.enabled": "已启用",
  "skills.tab.disabled": "已禁用",
  "skills.search": "搜索 skills...",
  "skills.total": "共 {count} 个",
  "skills.readonly": "只读",
  "skills.importLocal": "从本地导入",
  "skills.installGithub": "从 GitHub 安装",
  "skills.install.title": "从 GitHub 安装",
  "skills.install.repoLabel": "GitHub 仓库地址",
  "skills.install.repoPlaceholder": "https://github.com/user/repo",
  "skills.install.fetch": "获取",
  "skills.install.fetching": "获取中...",
  "skills.install.cloning": "正在克隆仓库并扫描 skills，请稍候...",
  "skills.install.noSkills": "未在仓库中找到 skill（需包含 SKILL.md 文件的目录）",
  "skills.install.selectLabel": "选择要安装的 skill：",
  "skills.install.cancel": "取消",
  "skills.install.installing": "安装中...",
  "skills.install.install": "安装 ({count})",
  "agents.title": "Agents",
  "agents.developing": "开发中",
  "common.loading": "加载中...",
  "common.notSet": "未设置",
  "envvars.title": "环境变量",
  "envvars.modelHint": "ANTHROPIC_BASE_URL、ANTHROPIC_AUTH_TOKEN 等模型相关变量由「通用」页面的模型槽位统一管理",
  "envvars.header.name": "变量名",
  "envvars.header.value": "值",
  "envvars.header.source": "来源",
  "envvars.managedByModels": "由模型槽位管理",
  "envvars.add.name": "变量名",
  "envvars.add.value": "值",
  "envvars.add.submit": "添加",
  "envvars.add.cancel": "取消",
  "mcp.title": "MCP 服务器",
  "mcp.command": "命令 (command)",
  "mcp.args": "参数 (args)",
  "mcp.env": "环境变量 (env)",
  "mcp.delete": "删除",
  "mcp.add.title": "添加 MCP 服务器",
  "mcp.add.name": "名称，如 playwright",
  "mcp.add.command": "命令，如 npx",
  "mcp.add.args": "参数（空格分隔），如 @anthropic/mcp-playwright",
  "mcp.add.cancel": "取消",
  "mcp.add.submit": "添加",
  "permissions.title": "权限",
  "permissions.allow": "允许 (Allow)",
  "permissions.deny": "拒绝 (Deny)",
  "permissions.header.type": "类型",
  "permissions.header.tool": "工具",
  "permissions.header.pattern": "模式",
  "permissions.header.source": "来源",
  "permissions.noAllow": "暂无允许规则",
  "permissions.noDeny": "暂无拒绝规则",
  "permissions.add.title": "添加权限规则",
  "permissions.add.scopeProject": "项目级",
  "permissions.add.scopeGlobal": "全局",
  "permissions.add.pattern": "匹配模式，如 npm run *",
  "permissions.add.submit": "添加",
  "permissions.add.cancel": "取消",
  "empty.title": "还没有打开项目",
  "empty.desc": "选择一个包含 .claude 目录的项目开始配置",
  "empty.select": "选择项目目录",
  "project.current": "当前项目",
  "project.none": "未选择",
  "project.currentLabel": "当前",
  "project.recent": "最近项目",
  "project.openOther": "📂 打开其他项目...",
  "source.global": "全局",
  "source.project": "项目",
  "source.user": "用户",
  "source.plugin": "插件"
}
```

- [ ] **步骤 2：更新英文 i18n**

修改后的完整 `en.json`：

```json
{
  "app.title": "jacc",
  "sidebar.config": "Config",
  "sidebar.general": "General",
  "sidebar.envvars": "Env Vars",
  "sidebar.permissions": "Permissions",
  "sidebar.mcp": "MCP Servers",
  "sidebar.models": "Models",
  "sidebar.extensions": "Extensions",
  "sidebar.skills": "Skills",
  "sidebar.agents": "Agents",
  "sidebar.theme.system": "System",
  "sidebar.theme.light": "Light",
  "sidebar.theme.dark": "Dark",
  "general.title": "General Settings",
  "general.slots": "Model Slots",
  "general.slot.bound": "Bound",
  "general.slot.unbound": "Unbound",
  "general.slot.unboundLabel": "Unbound",
  "general.currentModel": "Current Model",
  "general.currentModel.desc": "Set the model and context size for Claude Code",
  "general.ctxDefault": "Default",
  "general.apply": "Apply",
  "general.model.manage": "Manage",
  "general.effortLevel": "Effort Level",
  "general.effortLevel.desc": "Reasoning effort level",
  "general.skipDangerous": "Skip Dangerous Mode Prompt",
  "general.skipDangerous.desc": "Skip confirmation for dangerous operations",
  "general.language": "Language",
  "general.language.desc": "Interface language",
  "models.title": "Models",
  "models.empty": "No models yet, click + to add",
  "models.test": "Test",
  "models.edit": "Edit",
  "models.delete": "Delete",
  "models.testSuccess": "Connection successful",
  "models.testFailed": "Connection failed: {error}",
  "models.dialog.addTitle": "Add Model",
  "models.dialog.editTitle": "Edit Model",
  "models.dialog.alias": "Alias",
  "models.dialog.aliasPlaceholder": "e.g. Claude Opus Official",
  "models.dialog.baseUrl": "API Endpoint (Base URL)",
  "models.dialog.baseUrlPlaceholder": "https://api.anthropic.com",
  "models.dialog.apiKey": "API Key",
  "models.dialog.apiKeyEdit": "API Key (leave blank to keep)",
  "models.dialog.apiKeyPlaceholder": "sk-ant-...",
  "models.dialog.apiKeyEditPlaceholder": "Leave blank to keep current",
  "models.dialog.modelName": "Model Name",
  "models.dialog.modelNamePlaceholder": "claude-opus-4-6",
  "models.dialog.contextSize": "Context Size",
  "models.dialog.contextSizePlaceholder": "e.g. 200k, 1m",
  "models.dialog.cancel": "Cancel",
  "models.dialog.save": "Save",
  "models.dialog.saving": "Saving...",
  "models.dialog.required": "*",
  "skills.title": "Skills",
  "skills.tab.enabled": "Enabled",
  "skills.tab.disabled": "Disabled",
  "skills.search": "Search skills...",
  "skills.total": "{count} total",
  "skills.readonly": "Read-only",
  "skills.importLocal": "Import from local",
  "skills.installGithub": "Install from GitHub",
  "skills.install.title": "Install from GitHub",
  "skills.install.repoLabel": "GitHub Repository URL",
  "skills.install.repoPlaceholder": "https://github.com/user/repo",
  "skills.install.fetch": "Fetch",
  "skills.install.fetching": "Fetching...",
  "skills.install.cloning": "Cloning repository and scanning skills...",
  "skills.install.noSkills": "No skills found (directories must contain SKILL.md)",
  "skills.install.selectLabel": "Select skills to install:",
  "skills.install.cancel": "Cancel",
  "skills.install.installing": "Installing...",
  "skills.install.install": "Install ({count})",
  "agents.title": "Agents",
  "agents.developing": "In Development",
  "common.loading": "Loading...",
  "common.notSet": "Not set",
  "envvars.title": "Environment Variables",
  "envvars.modelHint": "ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN and other model variables are managed by Model Slots in General",
  "envvars.header.name": "Name",
  "envvars.header.value": "Value",
  "envvars.header.source": "Source",
  "envvars.managedByModels": "Managed by Model Slots",
  "envvars.add.name": "Variable name",
  "envvars.add.value": "Value",
  "envvars.add.submit": "Add",
  "envvars.add.cancel": "Cancel",
  "mcp.title": "MCP Servers",
  "mcp.command": "Command",
  "mcp.args": "Arguments",
  "mcp.env": "Environment Variables",
  "mcp.delete": "Delete",
  "mcp.add.title": "Add MCP Server",
  "mcp.add.name": "Name, e.g. playwright",
  "mcp.add.command": "Command, e.g. npx",
  "mcp.add.args": "Args (space-separated), e.g. @anthropic/mcp-playwright",
  "mcp.add.cancel": "Cancel",
  "mcp.add.submit": "Add",
  "permissions.title": "Permissions",
  "permissions.allow": "Allow",
  "permissions.deny": "Deny",
  "permissions.header.type": "Type",
  "permissions.header.tool": "Tool",
  "permissions.header.pattern": "Pattern",
  "permissions.header.source": "Source",
  "permissions.noAllow": "No allow rules",
  "permissions.noDeny": "No deny rules",
  "permissions.add.title": "Add Permission Rule",
  "permissions.add.scopeProject": "Project",
  "permissions.add.scopeGlobal": "Global",
  "permissions.add.pattern": "Pattern, e.g. npm run *",
  "permissions.add.submit": "Add",
  "permissions.add.cancel": "Cancel",
  "empty.title": "No project opened",
  "empty.desc": "Select a project with a .claude directory to start configuring",
  "empty.select": "Select Project",
  "project.current": "Current Project",
  "project.none": "Not selected",
  "project.currentLabel": "Current",
  "project.recent": "Recent Projects",
  "project.openOther": "📂 Open other project...",
  "source.global": "Global",
  "source.project": "Project",
  "source.user": "User",
  "source.plugin": "Plugin"
}
```

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src/i18n/locales/zh.json packages/jacc/src/i18n/locales/en.json
git commit -m "refactor(jacc): 更新 i18n 文案，新增 slot 绑定相关翻译"
```

---

### 任务 7：更新 EnvVars 页面的 MODEL_ENV_KEYS

**文件：**
- 修改：`packages/jacc/src/pages/EnvVars.tsx`

- [ ] **步骤 1：更新 MODEL_ENV_KEYS**

将 `packages/jacc/src/pages/EnvVars.tsx` 第 7 行的 `MODEL_ENV_KEYS` 替换为：

```typescript
const MODEL_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
]
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/pages/EnvVars.tsx
git commit -m "fix(jacc): 更新 EnvVars 页面模型环境变量列表，新增 DEFAULT_*_MODEL"
```

---

### 任务 8：编译验证和最终集成测试

- [ ] **步骤 1：Rust 编译检查**

运行：`cd packages/jacc/src-tauri && cargo check`
预期：编译通过，无错误

- [ ] **步骤 2：前端编译检查**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：TypeScript 类型检查通过，无错误

- [ ] **步骤 3：删除旧数据库（因为 schema 变了）**

旧数据库的 models 表包含 slot 字段，迁移会自动处理。但如果在开发中遇到问题：

```bash
rm ~/.jackit/toolbox/tools/jacc/data/jacc.db
```

- [ ] **步骤 4：最终 Commit**

如果有任何修复：

```bash
git add -A
git commit -m "fix(jacc): 集成修复"
```

---

## 自检

**规格覆盖度：**
- [x] 数据库 models 表移除 slot → 任务 1
- [x] 数据库新建 model_slots 表 → 任务 1
- [x] 后端移除 bind_model / activate_slot → 任务 2
- [x] 后端新增 get_slot_bindings / bind_slot / unbind_slot / set_current_model → 任务 2
- [x] settings.json 写入 ANTHROPIC_DEFAULT_*_MODEL → 任务 2 (write_slot_to_settings)
- [x] settings.json 写入 model 字段 → 任务 2 (set_current_model)
- [x] 前端模型库简化为纯 CRUD → 任务 4
- [x] 前端通用页面新增 slot 绑定区 → 任务 5
- [x] 前端通用页面新增当前模型选择器 → 任务 5
- [x] i18n 更新 → 任务 6
- [x] EnvVars MODEL_ENV_KEYS 更新 → 任务 7

**占位符扫描：** 无 TODO/待定。所有步骤都有完整代码。

**类型一致性：**
- `SlotBinding` 在 useModels.ts 中定义，在 General.tsx 中使用 — 一致
- `CreateModelInput` 移除 slot 字段 — AddModelDialog 和 useModels.ts 一致
- `Model` 移除 slot 字段 — models.rs、useModels.ts、Models.tsx 一致
- `model_id` 在 bind_slot 中是 `i64`/`number` — Rust 端和 TS 端一致
- `context_size` 在 set_current_model 中是 `Option<String>`/`string | null` — 一致
