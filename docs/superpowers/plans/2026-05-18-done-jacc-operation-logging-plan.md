# jacc 操作日志系统 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 jacc 后端所有 25 个用户操作命令添加 tracing 日志，实现操作可追溯和基本审计。

**架构：** 在 `src-tauri/src/macros.rs` 定义 `log_command!` 宏，自动记录命令入口/出口/耗时/成功/失败。每个 `#[tauri::command]` 函数用宏包裹，写操作在宏内加一条手动 `tracing::info!` 记录关键参数。不改 `*_inner` 函数和前端代码。

**技术栈：** Rust, tracing, Tauri v2, macro_rules!

---

## 文件结构

| 文件 | 变更类型 | 职责 |
|------|---------|------|
| `src-tauri/src/macros.rs` | 新建 | `log_command!` 宏定义 |
| `src-tauri/src/lib.rs` | 修改 | 加 `#[macro_use] mod macros;` |
| `src-tauri/src/commands/providers.rs` | 修改 | 4 个命令加宏 + 手动日志 |
| `src-tauri/src/commands/api_keys.rs` | 修改 | 4 个命令加宏 + 手动日志（脱敏） |
| `src-tauri/src/commands/models.rs` | 修改 | 5 个命令加宏 + 手动日志 |
| `src-tauri/src/commands/slots.rs` | 修改 | 4 个命令加宏 + 手动日志 |
| `src-tauri/src/commands/config.rs` | 修改 | 3 个命令加宏 + 手动日志（脱敏） |
| `src-tauri/src/commands/preferences.rs` | 修改 | 2 个命令加宏 + 手动日志 |
| `src-tauri/src/commands/projects.rs` | 修改 | 5 个命令加宏 + 手动日志 |
| `src-tauri/src/commands/skills.rs` | 修改 | 5 个命令加宏 + 手动日志 |

不改的文件：`commands/log.rs`（日志桥接，记录会产生递归）、`error.rs`、`db.rs`、`logging.rs`、前端代码。

---

### 任务 1：创建 log_command 宏

**文件：**
- 创建：`packages/jacc/src-tauri/src/macros.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs:1`

- [ ] **步骤 1：创建 macros.rs**

```rust
/// 为 Tauri 命令自动记录入口/出口/耗时/成功/失败的宏。
///
/// 读操作用法：
///   log_command!("command_name", { some_inner().await })
///
/// 写操作用法（在宏内加手动日志）：
///   log_command!("command_name", {
///       let result = some_inner().await?;
///       tracing::info!(id = result.id, "resource created");
///       Ok(result)
///   })
#[macro_export]
macro_rules! log_command {
    ($name:expr, $($body:tt)*) => {{
        let start = std::time::Instant::now();
        tracing::info!(command = $name, "→ invoked");
        let result = async { $($body)* }.await;
        let elapsed = start.elapsed();
        match &result {
            Ok(_) => tracing::info!(
                command = $name,
                elapsed_ms = elapsed.as_millis() as u64,
                "✓ completed"
            ),
            Err(e) => tracing::warn!(
                command = $name,
                elapsed_ms = elapsed.as_millis() as u64,
                error = %e,
                "✗ failed"
            ),
        }
        result
    }};
}
```

- [ ] **步骤 2：在 lib.rs 顶部添加宏模块声明**

在 `packages/jacc/src-tauri/src/lib.rs` 第 1 行前插入：

```rust
#[macro_use]
mod macros;

mod commands;
```

即把原来的 `mod commands;` 改为：

```rust
#[macro_use]
mod macros;

mod commands;
```

- [ ] **步骤 3：验证编译**

运行：`cd packages/jacc/src-tauri && cargo check 2>&1 | tail -5`
预期：编译通过（可能有 unused warning，无 error）

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src-tauri/src/macros.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): 添加 log_command 宏用于命令操作日志"
```

---

### 任务 2：providers.rs — 4 个命令加日志

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/providers.rs:101-127`（`#[tauri::command]` 函数部分）

- [ ] **步骤 1：替换 4 个命令函数**

将 `providers.rs` 中第 101-127 行（4 个 `#[tauri::command]` 函数）替换为：

```rust
#[tauri::command]
pub async fn add_provider(
    pool: State<'_, SqlitePool>,
    input: CreateProviderInput,
) -> AppResult<Provider> {
    log_command!("add_provider", {
        let provider = add_provider_inner(pool.inner(), input).await?;
        tracing::info!(id = provider.id, name = %provider.name, "provider created");
        Ok(provider)
    })
}

#[tauri::command]
pub async fn list_providers(pool: State<'_, SqlitePool>) -> AppResult<Vec<Provider>> {
    log_command!("list_providers", {
        list_providers_inner(pool.inner()).await
    })
}

#[tauri::command]
pub async fn update_provider(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateProviderInput,
) -> AppResult<()> {
    log_command!("update_provider", {
        update_provider_inner(pool.inner(), id, input).await?;
        tracing::info!(id, "provider updated");
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_provider(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    log_command!("delete_provider", {
        delete_provider_inner(pool.inner(), id).await?;
        tracing::info!(id, "provider deleted");
        Ok(())
    })
}
```

- [ ] **步骤 2：验证编译 + 现有测试通过**

运行：`cd packages/jacc/src-tauri && cargo check 2>&1 | tail -5`
预期：编译通过

运行：`cd packages/jacc/src-tauri && cargo test -- providers 2>&1 | tail -10`
预期：所有 providers 测试通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/providers.rs
git commit -m "feat(jacc): providers 命令添加操作日志"
```

---

### 任务 3：api_keys.rs — 4 个命令加日志（脱敏）

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/api_keys.rs:138-168`（`#[tauri::command]` 函数部分）

- [ ] **步骤 1：替换 4 个命令函数**

将 `api_keys.rs` 中第 138-168 行（4 个 `#[tauri::command]` 函数）替换为：

```rust
#[tauri::command]
pub async fn add_api_key(
    pool: State<'_, SqlitePool>,
    input: CreateApiKeyInput,
) -> AppResult<ApiKeyView> {
    log_command!("add_api_key", {
        let ak = add_api_key_inner(pool.inner(), input).await?;
        tracing::info!(id = ak.id, provider_id = ak.provider_id, name = %ak.name, "api_key created");
        Ok(ApiKeyView::from_api_key(&ak))
    })
}

#[tauri::command]
pub async fn list_api_keys(
    pool: State<'_, SqlitePool>,
    provider_id: i64,
) -> AppResult<Vec<ApiKeyView>> {
    log_command!("list_api_keys", {
        list_api_keys_inner(pool.inner(), provider_id).await
    })
}

#[tauri::command]
pub async fn update_api_key(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateApiKeyInput,
) -> AppResult<()> {
    log_command!("update_api_key", {
        update_api_key_inner(pool.inner(), id, input).await?;
        tracing::info!(id, "api_key updated");
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_api_key(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    log_command!("delete_api_key", {
        delete_api_key_inner(pool.inner(), id).await?;
        tracing::info!(id, "api_key deleted");
        Ok(())
    })
}
```

**注意：** `add_api_key` 的手动日志只记录 id、provider_id、name，**不记录 api_key 明文**。

- [ ] **步骤 2：验证编译 + 测试**

运行：`cd packages/jacc/src-tauri && cargo test -- api_keys 2>&1 | tail -10`
预期：所有 api_keys 测试通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/api_keys.rs
git commit -m "feat(jacc): api_keys 命令添加操作日志（脱敏 api_key）"
```

---

### 任务 4：models.rs — 5 个命令加日志

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/models.rs:142-166`（`#[tauri::command]` 函数部分）

- [ ] **步骤 1：替换 5 个命令函数**

将 `models.rs` 中第 142-166 行（5 个 `#[tauri::command]` 函数）替换为：

```rust
#[tauri::command]
pub async fn add_model(pool: State<'_, SqlitePool>, input: CreateModelInput) -> AppResult<Model> {
    log_command!("add_model", {
        let model = add_model_inner(pool.inner(), input).await?;
        tracing::info!(id = model.id, api_key_id = model.api_key_id, name = %model.model_name, "model created");
        Ok(model)
    })
}

#[tauri::command]
pub async fn list_models(pool: State<'_, SqlitePool>, api_key_id: i64) -> AppResult<Vec<Model>> {
    log_command!("list_models", {
        list_models_inner(pool.inner(), api_key_id).await
    })
}

#[tauri::command]
pub async fn update_model(pool: State<'_, SqlitePool>, id: i64, input: UpdateModelInput) -> AppResult<()> {
    log_command!("update_model", {
        update_model_inner(pool.inner(), id, input).await?;
        tracing::info!(id, "model updated");
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    log_command!("delete_model", {
        delete_model_inner(pool.inner(), id).await?;
        tracing::info!(id, "model deleted");
        Ok(())
    })
}

#[tauri::command]
pub async fn test_model(pool: State<'_, SqlitePool>, id: i64) -> AppResult<String> {
    log_command!("test_model", {
        let result = test_model_inner(pool.inner(), id).await?;
        tracing::info!(id, result = %result, "model test completed");
        Ok(result)
    })
}
```

- [ ] **步骤 2：验证编译 + 测试**

运行：`cd packages/jacc/src-tauri && cargo test -- models 2>&1 | tail -10`
预期：所有 models 测试通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/models.rs
git commit -m "feat(jacc): models 命令添加操作日志"
```

---

### 任务 5：slots.rs — 4 个命令加日志

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/slots.rs:226-250`（`#[tauri::command]` 函数部分）

- [ ] **步骤 1：替换 4 个命令函数**

将 `slots.rs` 中第 226-250 行（4 个 `#[tauri::command]` 函数）替换为：

```rust
#[tauri::command]
pub async fn get_slot_bindings(pool: State<'_, SqlitePool>) -> AppResult<Vec<SlotBinding>> {
    log_command!("get_slot_bindings", {
        get_slot_bindings_inner(pool.inner()).await
    })
}

#[tauri::command]
pub async fn bind_slot(pool: State<'_, SqlitePool>, slot: String, model_id: i64) -> AppResult<()> {
    log_command!("bind_slot", {
        bind_slot_inner(pool.inner(), &slot, model_id).await?;
        tracing::info!(slot = %slot, model_id, "slot bound");
        Ok(())
    })
}

#[tauri::command]
pub async fn unbind_slot(pool: State<'_, SqlitePool>, slot: String) -> AppResult<()> {
    log_command!("unbind_slot", {
        unbind_slot_inner(pool.inner(), &slot).await?;
        tracing::info!(slot = %slot, "slot unbound");
        Ok(())
    })
}

#[tauri::command]
pub async fn set_current_model(
    pool: State<'_, SqlitePool>,
    slot: String,
    context_size: Option<String>,
) -> AppResult<()> {
    log_command!("set_current_model", {
        set_current_model_at(pool.inner(), &slot, context_size.as_deref(), &get_global_settings_path()).await?;
        tracing::info!(slot = %slot, context_size = ?context_size, "current model set");
        Ok(())
    })
}
```

- [ ] **步骤 2：验证编译 + 测试**

运行：`cd packages/jacc/src-tauri && cargo test -- slots 2>&1 | tail -10`
预期：所有 slots 测试通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/slots.rs
git commit -m "feat(jacc): slots 命令添加操作日志"
```

---

### 任务 6：config.rs — 3 个命令加日志（脱敏）

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/config.rs:25-117`（全部 3 个 `#[tauri::command]` 函数）

- [ ] **步骤 1：替换 3 个命令函数**

将 `config.rs` 中第 25-117 行（3 个 `#[tauri::command]` 函数及其上方到文件末尾的全部内容）替换为：

```rust
#[tauri::command]
pub async fn read_merged_config(project_path: String) -> AppResult<MergedConfig> {
    log_command!("read_merged_config", {
        let global = read_settings_file(&get_global_settings_path());
        let project = if project_path.is_empty() {
            serde_json::json!({})
        } else {
            read_settings_file(&get_project_settings_path(&project_path))
        };

        let mut items: Vec<MergedConfigItem> = vec![];

        if let Some(global_obj) = global.as_object() {
            for (key, value) in global_obj {
                items.push(MergedConfigItem {
                    key: key.clone(),
                    value: value.clone(),
                    scope: ConfigScope::Global,
                });
            }
        }

        if let Some(project_obj) = project.as_object() {
            for (key, value) in project_obj {
                if let Some(existing) = items.iter_mut().find(|i| i.key == *key) {
                    existing.value = value.clone();
                    existing.scope = ConfigScope::Project;
                } else {
                    items.push(MergedConfigItem {
                        key: key.clone(),
                        value: value.clone(),
                        scope: ConfigScope::Project,
                    });
                }
            }
        }

        Ok(MergedConfig { items })
    })
}

#[tauri::command]
pub async fn write_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
    value: serde_json::Value,
) -> AppResult<()> {
    log_command!("write_config", {
        let path = match scope {
            ConfigScope::Global => get_global_settings_path(),
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                get_project_settings_path(&pp)
            }
        };

        let mut settings = read_settings_file(&path);
        if !settings.is_object() {
            settings = serde_json::json!({});
        }
        settings.as_object_mut().unwrap().insert(key.clone(), value);

        write_settings_file(&path, &settings)?;
        tracing::info!(scope = ?scope, key = %key, "config written");
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
) -> AppResult<()> {
    log_command!("delete_config", {
        let path = match scope {
            ConfigScope::Global => get_global_settings_path(),
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                get_project_settings_path(&pp)
            }
        };

        let mut settings = read_settings_file(&path);
        if let Some(obj) = settings.as_object_mut() {
            obj.remove(&key);
        }

        write_settings_file(&path, &settings)?;
        tracing::info!(scope = ?scope, key = %key, "config deleted");
        Ok(())
    })
}
```

**注意：** `write_config` 的手动日志只记录 scope 和 key，**不记录 value**（可能含敏感配置）。

- [ ] **步骤 2：验证编译**

运行：`cd packages/jacc/src-tauri && cargo check 2>&1 | tail -5`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/config.rs
git commit -m "feat(jacc): config 命令添加操作日志（脱敏 value）"
```

---

### 任务 7：preferences.rs — 2 个命令加日志

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/preferences.rs:6-28`（全部 2 个 `#[tauri::command]` 函数）

- [ ] **步骤 1：替换 2 个命令函数**

将 `preferences.rs` 中第 6-28 行（2 个 `#[tauri::command]` 函数）替换为：

```rust
#[tauri::command]
pub async fn get_preference(pool: State<'_, SqlitePool>, key: String) -> AppResult<Option<String>> {
    log_command!("get_preference", {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT value FROM preferences WHERE key = ?")
                .bind(&key)
                .fetch_optional(pool.inner())
                .await?;
        Ok(row.map(|r| r.0))
    })
}

#[tauri::command]
pub async fn set_preference(pool: State<'_, SqlitePool>, key: String, value: String) -> AppResult<()> {
    log_command!("set_preference", {
        sqlx::query(
            "INSERT INTO preferences (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(&key)
        .bind(&value)
        .execute(pool.inner())
        .await?;
        tracing::info!(key = %key, "preference set");
        Ok(())
    })
}
```

- [ ] **步骤 2：验证编译**

运行：`cd packages/jacc/src-tauri && cargo check 2>&1 | tail -5`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/preferences.rs
git commit -m "feat(jacc): preferences 命令添加操作日志"
```

---

### 任务 8：projects.rs — 5 个命令加日志

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/projects.rs:16-78`（全部 5 个 `#[tauri::command]` 函数）

- [ ] **步骤 1：替换 5 个命令函数**

将 `projects.rs` 中第 16-78 行（5 个 `#[tauri::command]` 函数）替换为：

```rust
#[tauri::command]
pub async fn list_projects(pool: State<'_, SqlitePool>) -> AppResult<Vec<Project>> {
    log_command!("list_projects", {
        let projects = sqlx::query_as::<_, Project>(
            "SELECT id, path, name, last_opened_at, pinned FROM projects
             ORDER BY pinned DESC, last_opened_at DESC",
        )
        .fetch_all(pool.inner())
        .await?;
        Ok(projects)
    })
}

#[tauri::command]
pub async fn add_project(
    pool: State<'_, SqlitePool>,
    path: String,
    name: Option<String>,
) -> AppResult<()> {
    log_command!("add_project", {
        let display_name = name.unwrap_or_else(|| {
            std::path::Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone())
        });

        sqlx::query(
            "INSERT INTO projects (path, name) VALUES (?, ?)
             ON CONFLICT(path) DO UPDATE SET last_opened_at = datetime('now'), name = excluded.name",
        )
        .bind(&path)
        .bind(&display_name)
        .execute(pool.inner())
        .await?;
        tracing::info!(path = %path, "project added");
        Ok(())
    })
}

#[tauri::command]
pub async fn open_project(pool: State<'_, SqlitePool>, path: String) -> AppResult<()> {
    log_command!("open_project", {
        sqlx::query("UPDATE projects SET last_opened_at = datetime('now') WHERE path = ?")
            .bind(&path)
            .execute(pool.inner())
            .await?;
        tracing::info!(path = %path, "project opened");
        Ok(())
    })
}

#[tauri::command]
pub async fn remove_project(pool: State<'_, SqlitePool>, id: i64) -> AppResult<()> {
    log_command!("remove_project", {
        sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id)
            .execute(pool.inner())
            .await?;
        tracing::info!(id, "project removed");
        Ok(())
    })
}

#[tauri::command]
pub async fn pin_project(pool: State<'_, SqlitePool>, id: i64, pinned: bool) -> AppResult<()> {
    log_command!("pin_project", {
        sqlx::query("UPDATE projects SET pinned = ? WHERE id = ?")
            .bind(pinned as i32)
            .bind(id)
            .execute(pool.inner())
            .await?;
        tracing::info!(id, pinned, "project pin toggled");
        Ok(())
    })
}
```

- [ ] **步骤 2：验证编译**

运行：`cd packages/jacc/src-tauri && cargo check 2>&1 | tail -5`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/projects.rs
git commit -m "feat(jacc): projects 命令添加操作日志"
```

---

### 任务 9：skills.rs — 5 个命令加日志

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/skills.rs:20-149`（全部 5 个 `#[tauri::command]` 函数）

- [ ] **步骤 1：替换 5 个命令函数**

将 `skills.rs` 中第 20-149 行（5 个 `#[tauri::command]` 函数）替换为：

```rust
#[tauri::command]
pub async fn list_skills(project_path: String) -> AppResult<Vec<SkillInfo>> {
    log_command!("list_skills", {
        let mut skills = vec![];

        let project_skills_dir = PathBuf::from(&project_path).join(".claude").join("skills");
        if project_skills_dir.exists() {
            collect_skills(&project_skills_dir, "project", true, &mut skills)?;
        }

        let disabled_dir = project_skills_dir.join(".disabled");
        if disabled_dir.exists() {
            collect_skills(&disabled_dir, "project", false, &mut skills)?;
        }

        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let user_skills_dir = home.join(".claude").join("skills");
        if user_skills_dir.exists() {
            collect_skills(&user_skills_dir, "user", true, &mut skills)?;
        }

        Ok(skills)
    })
}

#[tauri::command]
pub async fn toggle_skill(project_path: String, name: String, enabled: bool) -> AppResult<()> {
    log_command!("toggle_skill", {
        let skills_dir = PathBuf::from(&project_path).join(".claude").join("skills");
        let disabled_dir = skills_dir.join(".disabled");

        if enabled {
            let src = disabled_dir.join(&name);
            let dst = skills_dir.join(&name);
            if src.exists() {
                std::fs::rename(&src, &dst)?;
            }
        } else {
            let src = skills_dir.join(&name);
            let dst = disabled_dir.join(&name);
            std::fs::create_dir_all(&disabled_dir)?;
            if src.exists() {
                std::fs::rename(&src, &dst)?;
            }
        }
        tracing::info!(name = %name, enabled, "skill toggled");
        Ok(())
    })
}

#[tauri::command]
pub async fn import_skill(project_path: String, source_path: String) -> AppResult<()> {
    log_command!("import_skill", {
        let source = PathBuf::from(&source_path);
        if !source.exists() {
            return Err(AppError::Custom("源路径不存在".to_string()));
        }

        let name = source
            .file_name()
            .ok_or_else(|| AppError::Custom("无效的源路径".to_string()))?
            .to_string_lossy()
            .to_string();

        let dst = PathBuf::from(&project_path)
            .join(".claude")
            .join("skills")
            .join(&name);

        copy_dir_recursive(&source, &dst)?;
        tracing::info!(name = %name, source = %source_path, "skill imported");
        Ok(())
    })
}

#[tauri::command]
pub async fn install_skill_from_github(
    _project_path: String,
    repo_url: String,
) -> AppResult<GithubInstallResult> {
    log_command!("install_skill_from_github", {
        let temp_dir = std::env::temp_dir().join(format!(
            "jacc-skill-{}",
            chrono::Utc::now().timestamp()
        ));
        std::fs::create_dir_all(&temp_dir)?;

        let output = std::process::Command::new("git")
            .args([
                "clone",
                "--depth",
                "1",
                &repo_url,
                &temp_dir.to_string_lossy(),
            ])
            .output()
            .map_err(|e| AppError::Custom(format!("git clone 失败: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Custom(format!("git clone 失败: {}", stderr)));
        }

        let mut available_skills = vec![];
        scan_for_skills(&temp_dir, &mut available_skills)?;

        tracing::info!(url = %repo_url, count = available_skills.len(), "skills fetched from github");
        Ok(GithubInstallResult {
            temp_dir: temp_dir.to_string_lossy().to_string(),
            skills: available_skills,
        })
    })
}

#[tauri::command]
pub async fn confirm_install_skill(
    project_path: String,
    temp_dir: String,
    skill_names: Vec<String>,
) -> AppResult<()> {
    log_command!("confirm_install_skill", {
        let temp_path = PathBuf::from(&temp_dir);
        let dst_base = PathBuf::from(&project_path).join(".claude").join("skills");
        std::fs::create_dir_all(&dst_base)?;

        for name in &skill_names {
            let src = find_skill_dir(&temp_path, name)?;
            let dst = dst_base.join(name);
            copy_dir_recursive(&src, &dst)?;
        }

        std::fs::remove_dir_all(&temp_path).ok();
        tracing::info!(names = ?skill_names, "skills installed");
        Ok(())
    })
}
```

- [ ] **步骤 2：验证编译**

运行：`cd packages/jacc/src-tauri && cargo check 2>&1 | tail -5`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/skills.rs
git commit -m "feat(jacc): skills 命令添加操作日志"
```

---

### 任务 10：最终构建 + 测试验证

**文件：** 无新变更

- [ ] **步骤 1：运行完整测试套件**

运行：`cd packages/jacc/src-tauri && cargo test 2>&1 | tail -20`
预期：所有测试通过（providers、api_keys、models、slots 的现有测试）

- [ ] **步骤 2：运行 release 构建验证**

运行：`cd packages/jacc/src-tauri && cargo check --release 2>&1 | tail -5`
预期：编译通过

- [ ] **步骤 3：Final commit（如有修正）**

仅在上一步发现问题时才需要修正和 commit。
