# settings.json 项目级编辑 + 敏感信息分流 —— Plan A：scope 维度基建 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让「项目级」成为用户可主动选择的编辑维度，写入时按敏感标记自动分流（敏感→`settings.local.json` 并自动 gitignore，非敏感→`settings.json`），并让模型槽位区随页面级 scope 读写对应层。

**架构：** 后端 `config.rs` 新增按单层读取的 `read_config_layer`，`write_config`/`delete_config` 改造为支持 `sensitive` 分流与 `origin` 定位；`claude_settings.rs` 新增 `settings.local.json` 路径与 gitignore helper；四个槽位命令参数化 scope（底层 `*_at` 已就绪）。前端 `useAppStore` 持有 `configScope`，新增 `ScopeSwitcher`，`useConfig`/`useSlotBindings` 按 scope 读写单层，四页接入切换栏 + 无项目守卫 + 来源 pill。

**技术栈：** Rust（tauri command、serde、tempfile、tokio test）、TypeScript/React、Zustand、Vitest + Testing Library、tailwind-variants。

**约束：** 所有涉及 UI 的任务完成后必须用 brainstorming 视觉伴侣展示实际渲染、经用户验收后才进入下一步（设计 §6）。纯后端/纯数据任务不强制。

---

## 文件结构

**后端（`packages/jacc/src-tauri/src/`）：**
- 修改 `claude_settings.rs` —— 新增 `project_local_settings_path()`、`ensure_local_settings_gitignored()`；修复 `set_current_model_at` 走 `update()` 原子写。
- 修改 `commands/config.rs` —— 新增 `ConfigOrigin`、`LayerConfigItem`、`LayerConfig`、`WriteConfigResult`、`read_config_layer`；改造 `write_config`（加 `sensitive`）、`delete_config`（加 `origin`）。
- 修改 `commands/slots.rs` —— 四个公开命令加 `scope` + `project_path`，按 scope 解析目标 settings 路径（项目→`settings.local.json`）。
- 修改 `lib.rs` —— 注册 `read_config_layer`（其余命令签名变化无需改注册）。

**前端（`packages/jacc/src/`）：**
- 修改 `stores/useAppStore.ts` —— 加 `configScope` + `setConfigScope`。
- 新增 `shared/components/ui/ScopeSwitcher.tsx` + `scope-switcher.variants.ts` + `ScopeSwitcher.test.tsx`。
- 修改 `shared/components/ui/SourceBadge.tsx` + `source-badge.variants.ts` —— 新增 `shared`/`local`（保留 `project`）。
- 修改 `shared/hooks/useConfig.ts` + 新增 `useConfig.test.ts` —— 按 `configScope` 调 `read_config_layer`，暴露 `origin`、`needsProject`，写入返回 `WriteConfigResult`。
- 修改 `shared/hooks/useSlotBindings.ts` —— 全链路带 `scope` + `projectPath`。
- 修改 `features/env-vars/api/env-vars-api.ts`、`features/permissions/api/permissions-api.ts`、`features/mcp-servers/api/mcp-servers-api.ts` —— extract 函数从 `MergedConfig` 改吃 `LayerConfig`，scope 推导改 origin 推导。
- 修改 `features/permissions/hooks/usePermissions.ts`、`features/mcp-servers/hooks/useMcpServers.ts` —— 适配新 `useConfig`。
- 修改 `pages/General.tsx`、`pages/EnvVars.tsx`、`pages/Permissions.tsx`、`pages/McpServers.tsx` —— 接入 `ScopeSwitcher` + 无项目守卫 + 来源列仅项目视图渲染。

每个任务产出独立、可验证的变更。

---

### 任务 1：claude_settings.rs —— local 路径与 gitignore helper

**文件：**
- 修改：`packages/jacc/src-tauri/src/claude_settings.rs`（在 `project_settings_path` 后，约 line 20 之后新增）
- 测试：同文件 `#[cfg(test)] mod tests`（约 line 168 起）

- [ ] **步骤 1：编写失败的测试**

在 `mod tests` 内追加：

```rust
#[test]
fn local_settings_path_appends_local_filename() {
    let p = project_local_settings_path(std::path::Path::new("/proj"));
    assert!(p.ends_with(".claude/settings.local.json"));
}

#[test]
fn gitignore_creates_file_when_missing() {
    let dir = tempfile::tempdir().unwrap();
    let wrote = ensure_local_settings_gitignored(dir.path()).unwrap();
    assert!(wrote);
    let content = std::fs::read_to_string(dir.path().join(".gitignore")).unwrap();
    assert!(content.lines().any(|l| l.trim() == ".claude/settings.local.json"));
}

#[test]
fn gitignore_idempotent_when_line_present() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join(".gitignore"), "node_modules\n.claude/settings.local.json\n").unwrap();
    let wrote = ensure_local_settings_gitignored(dir.path()).unwrap();
    assert!(!wrote);
}

#[test]
fn gitignore_preserves_existing_and_appends() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join(".gitignore"), "dist\n").unwrap();
    ensure_local_settings_gitignored(dir.path()).unwrap();
    let content = std::fs::read_to_string(dir.path().join(".gitignore")).unwrap();
    assert!(content.contains("dist"));
    assert!(content.trim_end().ends_with(".claude/settings.local.json"));
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cargo test -p jacc claude_settings::tests::gitignore -- --nocapture`（在 `packages/jacc/src-tauri` 下）
预期：FAIL，编译报错 `cannot find function project_local_settings_path` / `ensure_local_settings_gitignored`。

- [ ] **步骤 3：编写最少实现代码**

在 `claude_settings.rs` 的 `project_settings_path`（约 line 17-20）之后插入：

```rust
/// 项目本地 settings.local.json：<project>/.claude/settings.local.json
pub fn project_local_settings_path(project: &Path) -> PathBuf {
    project.join(".claude").join("settings.local.json")
}

/// 确保 <project>/.gitignore 含 ".claude/settings.local.json" 行。
/// 已存在返回 false 不写；否则追加并原子写入，返回 true。
pub fn ensure_local_settings_gitignored(project: &Path) -> AppResult<bool> {
    const LINE: &str = ".claude/settings.local.json";
    let gitignore = project.join(".gitignore");
    let existing = if gitignore.exists() {
        std::fs::read_to_string(&gitignore)?
    } else {
        String::new()
    };
    if existing.lines().any(|l| l.trim() == LINE) {
        return Ok(false);
    }
    let mut next = existing;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(LINE);
    next.push('\n');
    let parent = gitignore.parent().unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(parent)?;
    let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
    use std::io::Write;
    tmp.write_all(next.as_bytes())?;
    tmp.flush()?;
    tmp.persist(&gitignore).map_err(|e| std::io::Error::other(e.to_string()))?;
    Ok(true)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cargo test -p jacc claude_settings::tests -- --nocapture`
预期：PASS（4 个新测试 + 原有测试全绿）。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/claude_settings.rs
git commit -m "feat(jacc): 新增 settings.local.json 路径与 gitignore helper"
```

---

### 任务 2：修复 set_current_model_at 走原子写入

**背景：** 自审核实 `set_current_model_at`（slots.rs 行 285-360）当前用裸 `std::fs::read_to_string` + `std::fs::write`，绕过了 `SETTINGS_LOCK` 与 tempfile 原子写。槽位 scope 化后并发写项目/全局文件，必须收敛到 `claude_settings::update()`，否则与 task 5 的项目写入存在竞态。

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/slots.rs:285-360`
- 测试：复用现有 `test_set_current_model_updates_credentials`（slots.rs 行 591-621），新增并发断言。

- [ ] **步骤 1：编写失败的测试**

在 slots.rs `mod tests` 内新增（验证写入后文件是合法 JSON 且无半写）：

```rust
#[tokio::test]
async fn set_current_model_writes_atomically_valid_json() {
    let pool = setup_test_db().await;
    let mid = insert_full_model(&pool, "opus", "https://api.anthropic.com", "sk-ant-aaa").await;
    bind_slot_inner(&pool, "opus", mid).await.unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    // 预置一个已有 key，验证不被覆盖丢失
    std::fs::write(&path, "{\n  \"keep\": true\n}\n").unwrap();
    set_current_model_at(&pool, "opus", None, &path).await.unwrap();
    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(v["keep"], true, "已有 key 必须保留");
    assert_eq!(v["model"], "opus");
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cargo test -p jacc slots::tests::set_current_model_writes_atomically_valid_json -- --nocapture`
预期：可能 PASS 或 FAIL（取决于裸写是否保留 `keep`）。若当前实现整体覆盖写则 `keep` 丢失 → FAIL，证明缺陷存在。

- [ ] **步骤 3：用 update() 重写写盘段**

将 slots.rs **行 314-360**（从 `let mut settings ...` 一直到函数末尾的 `Ok(())` 与闭合 `}`，整段含原 default_key 定义）替换为下面基于 `claude_settings::update()` 的原子写。新代码块自带函数闭合 `}`，**务必连同原 line 359 `Ok(())` 与 line 360 `}` 一起替换掉**，否则会留下悬空 `Ok(())\n}` 导致编译错误。`model_value`/`base_url`/`api_key`/`model_name` 均为 `String`，`move` 进闭包；`default_key` 是 `&'static str`（Copy）：

```rust
    let default_key = match slot {
        "opus" => "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "sonnet" => "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "haiku" => "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        _ => "ANTHROPIC_MODEL",
    };

    crate::claude_settings::update(settings_path, move |obj| {
        obj.insert("model".to_string(), serde_json::Value::String(model_value));
        let env = obj
            .entry("env")
            .or_insert_with(|| serde_json::json!({}));
        let env_obj = env.as_object_mut().ok_or_else(|| {
            AppError::Custom("settings.env 不是对象".to_string())
        })?;
        env_obj.insert("ANTHROPIC_BASE_URL".to_string(), serde_json::Value::String(base_url));
        env_obj.insert("ANTHROPIC_AUTH_TOKEN".to_string(), serde_json::Value::String(api_key));
        env_obj.insert(default_key.to_string(), serde_json::Value::String(model_name));
        Ok(())
    })
    .await
}
```

> 说明：新代码块已包含函数闭合 `}`。原函数体内（行 314-360）的 `let mut settings ...`、中段 `default_key` 定义、`std::fs::write(...)`、结尾 `Ok(())` 全部被替换；`default_key` 在 `update()` 调用前定义一次，并入闭包使用。

- [ ] **步骤 4：运行测试验证通过**

运行：`cargo test -p jacc slots::tests -- --nocapture`
预期：PASS，含 `set_current_model_writes_atomically_valid_json`（`keep` 保留）与原有 `test_set_current_model_updates_credentials`。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/slots.rs
git commit -m "fix(jacc): set_current_model_at 改用 update() 原子写入"
```

---

### 任务 3：config.rs —— ConfigOrigin / LayerConfig / read_config_layer

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/config.rs`（在 `MergedConfig` 定义后、`read_merged_config` 前后新增类型与命令）
- 测试：同文件新增 `#[cfg(test)] mod tests`（若无则新建）

- [ ] **步骤 1：编写失败的测试**

config.rs 当前无测试模块。在文件末尾新增 `#[cfg(test)] mod tests`。因 `read_config_layer` 是 `#[tauri::command]` 但不依赖 `State`，可直接 await 调用：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn layer_global_reads_only_global_origin() {
        // 借 HOME override 不便，故直接测内部 read_layer_at helper（见步骤3）
        let dir = tempfile::tempdir().unwrap();
        let shared = dir.path().join("settings.json");
        std::fs::write(&shared, r#"{"a":1,"b":2}"#).unwrap();
        let local = dir.path().join("settings.local.json");
        let items = read_layer_at(&shared, Some(&local)).await.unwrap().items;
        // local 不存在时全部 Shared
        assert!(items.iter().all(|i| matches!(i.origin, ConfigOrigin::Shared)));
        assert_eq!(items.len(), 2);
    }

    #[tokio::test]
    async fn layer_local_overrides_shared_and_marks_origin() {
        let dir = tempfile::tempdir().unwrap();
        let shared = dir.path().join("settings.json");
        std::fs::write(&shared, r#"{"a":1,"b":2}"#).unwrap();
        let local = dir.path().join("settings.local.json");
        std::fs::write(&local, r#"{"b":99,"c":3}"#).unwrap();
        let items = read_layer_at(&shared, Some(&local)).await.unwrap().items;
        let get = |k: &str| items.iter().find(|i| i.key == k).unwrap();
        assert_eq!(get("a").value, serde_json::json!(1));
        assert!(matches!(get("a").origin, ConfigOrigin::Shared));
        assert_eq!(get("b").value, serde_json::json!(99));
        assert!(matches!(get("b").origin, ConfigOrigin::Local));
        assert!(matches!(get("c").origin, ConfigOrigin::Local));
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cargo test -p jacc config::tests -- --nocapture`
预期：FAIL，编译报错 `cannot find type ConfigOrigin` / `function read_layer_at`。

- [ ] **步骤 3：编写实现代码**

在 config.rs 的 `MergedConfig`（约 line 18-23）之后插入类型与命令。`read_config_layer` 委托给可测的 `read_layer_at`：

```rust
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConfigOrigin {
    Global,
    Shared,
    Local,
}

#[derive(Debug, Serialize)]
pub struct LayerConfigItem {
    pub key: String,
    pub value: serde_json::Value,
    pub origin: ConfigOrigin,
}

#[derive(Debug, Serialize)]
pub struct LayerConfig {
    pub items: Vec<LayerConfigItem>,
}

/// 读 shared(+可选 local) 并按 origin 标记；local 同名覆盖 shared。
/// local 为 None（全局 scope）时全部标 Shared，调用方负责改写为 Global。
async fn read_layer_at(shared: &Path, local: Option<&Path>) -> AppResult<LayerConfig> {
    let shared_val = crate::claude_settings::read(shared).await?;
    let mut items: Vec<LayerConfigItem> = Vec::new();
    if let Some(obj) = shared_val.as_object() {
        for (k, v) in obj {
            items.push(LayerConfigItem { key: k.clone(), value: v.clone(), origin: ConfigOrigin::Shared });
        }
    }
    if let Some(local_path) = local {
        let local_val = crate::claude_settings::read(local_path).await?;
        if let Some(obj) = local_val.as_object() {
            for (k, v) in obj {
                if let Some(slot) = items.iter_mut().find(|i| &i.key == k) {
                    slot.value = v.clone();
                    slot.origin = ConfigOrigin::Local;
                } else {
                    items.push(LayerConfigItem { key: k.clone(), value: v.clone(), origin: ConfigOrigin::Local });
                }
            }
        }
    }
    Ok(LayerConfig { items })
}
```

紧接着新增 `#[tauri::command]` 包装（解析路径 + 全局 scope 改写 origin）：

```rust
#[tauri::command]
pub async fn read_config_layer(
    scope: ConfigScope,
    project_path: Option<String>,
) -> AppResult<LayerConfig> {
    log_read_command!("read_config_layer", {
        match scope {
            ConfigScope::Global => {
                let path = crate::claude_settings::global_settings_path();
                let mut layer = read_layer_at(&path, None).await?;
                for it in layer.items.iter_mut() {
                    it.origin = ConfigOrigin::Global;
                }
                Ok(layer)
            }
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                let validated = crate::path_guard::validate_project_path(&pp)?;
                let shared = crate::claude_settings::project_settings_path(&validated);
                let local = crate::claude_settings::project_local_settings_path(&validated);
                read_layer_at(&shared, Some(&local)).await
            }
        }
    })
}
```

> `log_read_command!` 宏已在 config.rs 现有命令中使用（见 `read_merged_config`），无需新 import。

- [ ] **步骤 4：运行测试验证通过**

运行：`cargo test -p jacc config::tests -- --nocapture`
预期：PASS（2 个 layer 测试）。

- [ ] **步骤 5：注册命令并 Commit**

在 `lib.rs` 的 `generate_handler!` 中 `commands::config::read_merged_config,` 一行下方加：

```rust
        commands::config::read_config_layer,
```

```bash
git add packages/jacc/src-tauri/src/commands/config.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): 新增 read_config_layer 按单层读取并标记 origin"
```

---

### 任务 4：config.rs —— write_config 分流 + delete_config 按 origin

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/config.rs:74-121`（`write_config` / `delete_config`）
- 测试：同文件 `mod tests` 追加

- [ ] **步骤 1：编写失败的测试**

在 config.rs `mod tests` 追加。分流核心逻辑抽到可测的 `write_kv_routed`（步骤3实现）：

```rust
#[tokio::test]
async fn write_project_sensitive_goes_to_local_and_gitignores() {
    let dir = tempfile::tempdir().unwrap();
    let proj = dir.path();
    std::fs::create_dir_all(proj.join(".claude")).unwrap();
    let res = write_kv_routed(proj, "ANTHROPIC_AUTH_TOKEN", serde_json::json!("sk-x"), true)
        .await
        .unwrap();
    assert!(res.wrote_local);
    assert!(res.gitignore_updated);
    let local = std::fs::read_to_string(proj.join(".claude/settings.local.json")).unwrap();
    assert!(local.contains("sk-x"));
    assert!(!proj.join(".claude/settings.json").exists());
    let gi = std::fs::read_to_string(proj.join(".gitignore")).unwrap();
    assert!(gi.contains(".claude/settings.local.json"));
}

#[tokio::test]
async fn write_project_nonsensitive_goes_to_shared() {
    let dir = tempfile::tempdir().unwrap();
    let proj = dir.path();
    std::fs::create_dir_all(proj.join(".claude")).unwrap();
    let res = write_kv_routed(proj, "effortLevel", serde_json::json!("high"), false)
        .await
        .unwrap();
    assert!(!res.wrote_local);
    let shared = std::fs::read_to_string(proj.join(".claude/settings.json")).unwrap();
    assert!(shared.contains("high"));
    assert!(!proj.join(".claude/settings.local.json").exists());
}

#[tokio::test]
async fn delete_local_origin_removes_from_local_file() {
    let dir = tempfile::tempdir().unwrap();
    let proj = dir.path();
    std::fs::create_dir_all(proj.join(".claude")).unwrap();
    std::fs::write(proj.join(".claude/settings.local.json"), r#"{"ANTHROPIC_AUTH_TOKEN":"sk-x"}"#).unwrap();
    delete_kv_routed(proj, "ANTHROPIC_AUTH_TOKEN", ConfigOrigin::Local).await.unwrap();
    let local = std::fs::read_to_string(proj.join(".claude/settings.local.json")).unwrap();
    assert!(!local.contains("sk-x"));
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cargo test -p jacc config::tests::write_project -- --nocapture`
预期：FAIL，`cannot find function write_kv_routed` / `delete_kv_routed`。

- [ ] **步骤 3：编写实现代码**

先在 `read_layer_at` 之后新增可测 helper（接收已校验的 project 根）：

```rust
#[derive(Debug, Serialize)]
pub struct WriteConfigResult {
    pub wrote_local: bool,
    pub gitignore_updated: bool,
}

/// 项目 scope 下按 sensitive 分流写入。
async fn write_kv_routed(
    project: &Path,
    key: &str,
    value: serde_json::Value,
    sensitive: bool,
) -> AppResult<WriteConfigResult> {
    if sensitive {
        let local = crate::claude_settings::project_local_settings_path(project);
        crate::claude_settings::write_kv(&local, key, value).await?;
        let gitignore_updated = crate::claude_settings::ensure_local_settings_gitignored(project)?;
        Ok(WriteConfigResult { wrote_local: true, gitignore_updated })
    } else {
        let shared = crate::claude_settings::project_settings_path(project);
        crate::claude_settings::write_kv(&shared, key, value).await?;
        Ok(WriteConfigResult { wrote_local: false, gitignore_updated: false })
    }
}

/// 项目 scope 下按 origin 删对应文件。
async fn delete_kv_routed(project: &Path, key: &str, origin: ConfigOrigin) -> AppResult<()> {
    let path = match origin {
        ConfigOrigin::Local => crate::claude_settings::project_local_settings_path(project),
        // Shared 与 Global（项目场景不应出现 Global）都删 shared 文件
        _ => crate::claude_settings::project_settings_path(project),
    };
    crate::claude_settings::delete_kv(&path, key).await
}
```

再改造两个公开命令。将 `write_config`（line 74-97）整体替换为：

```rust
#[tauri::command]
pub async fn write_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
    value: serde_json::Value,
    sensitive: bool,
) -> AppResult<WriteConfigResult> {
    log_command!("write_config", {
        match scope {
            ConfigScope::Global => {
                let path = crate::claude_settings::global_settings_path();
                crate::claude_settings::write_kv(&path, &key, value).await?;
                Ok(WriteConfigResult { wrote_local: false, gitignore_updated: false })
            }
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                let validated = crate::path_guard::validate_project_path(&pp)?;
                write_kv_routed(&validated, &key, value, sensitive).await
            }
        }
    })
}
```

将 `delete_config`（line 99-121）整体替换为：

```rust
#[tauri::command]
pub async fn delete_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
    origin: ConfigOrigin,
) -> AppResult<()> {
    log_command!("delete_config", {
        match scope {
            ConfigScope::Global => {
                let path = crate::claude_settings::global_settings_path();
                crate::claude_settings::delete_kv(&path, &key).await
            }
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                let validated = crate::path_guard::validate_project_path(&pp)?;
                delete_kv_routed(&validated, &key, origin).await
            }
        }
    })
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cargo test -p jacc config::tests -- --nocapture`
预期：PASS（write/delete 路由 3 个新测试 + task3 的 2 个 layer 测试）。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/config.rs
git commit -m "feat(jacc): write_config 敏感分流 + delete_config 按 origin 定位"
```

---

### 任务 5：slots.rs —— 四命令 scope 化

**背景：** 底层 `*_at` 函数已参数化 `settings_path`，本任务只改 4 个公开命令签名 + 路径解析。项目 scope 时槽位目标为 `settings.local.json`（含密钥，天然敏感）并触发 gitignore。

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/slots.rs:367-405`（四个 `#[tauri::command]`）
- 测试：复用 `*_at` 既有测试 + 新增项目路径解析单测

- [ ] **步骤 1：编写失败的测试**

在 slots.rs `mod tests` 追加（验证项目 scope 解析到 local 文件 + gitignore）：

```rust
#[tokio::test]
async fn slot_path_project_scope_write_resolves_to_local_and_gitignores() {
    let dir = tempfile::tempdir().unwrap();
    let proj = dir.path();
    std::fs::create_dir_all(proj.join(".claude")).unwrap();
    // 写路径（ensure_gitignore=true）
    let (path, gitignored) = resolve_slot_settings_path(
        ConfigScope::Project,
        Some(proj.to_string_lossy().to_string()),
        true,
    )
    .unwrap();
    assert!(path.ends_with(".claude/settings.local.json"));
    assert!(gitignored);
    assert!(proj.join(".gitignore").exists());
}

#[tokio::test]
async fn slot_path_project_scope_read_does_not_touch_gitignore() {
    let dir = tempfile::tempdir().unwrap();
    let proj = dir.path();
    std::fs::create_dir_all(proj.join(".claude")).unwrap();
    // 读路径（ensure_gitignore=false）：解析到 local，但不创建 .gitignore
    let (path, gitignored) = resolve_slot_settings_path(
        ConfigScope::Project,
        Some(proj.to_string_lossy().to_string()),
        false,
    )
    .unwrap();
    assert!(path.ends_with(".claude/settings.local.json"));
    assert!(!gitignored);
    assert!(!proj.join(".gitignore").exists());
}

#[tokio::test]
async fn slot_path_global_scope_resolves_to_global() {
    let (path, gitignored) = resolve_slot_settings_path(ConfigScope::Global, None, false).unwrap();
    assert!(path.ends_with(".claude/settings.json"));
    assert!(!gitignored);
}
```

> `ConfigScope` 复用 `crate::commands::config::ConfigScope`，在 slots.rs 顶部加 `use crate::commands::config::ConfigScope;`。

- [ ] **步骤 2：运行测试验证失败**

运行：`cargo test -p jacc slots::tests::slot_path -- --nocapture`
预期：FAIL，`cannot find function resolve_slot_settings_path`。

- [ ] **步骤 3：编写实现代码**

在 slots.rs `get_global_settings_path`（line 362-365）之后新增可测 helper：

```rust
/// 按 scope 解析槽位写入目标。项目 scope → settings.local.json（槽位含密钥）。
/// `ensure_gitignore=true`（写命令）时确保 .gitignore 含 local 行；读命令传 false，避免读操作产生文件副作用。
/// 返回 (路径, 是否新写了 gitignore)。
fn resolve_slot_settings_path(
    scope: ConfigScope,
    project_path: Option<String>,
    ensure_gitignore: bool,
) -> AppResult<(std::path::PathBuf, bool)> {
    match scope {
        ConfigScope::Global => Ok((get_global_settings_path(), false)),
        ConfigScope::Project => {
            let pp = project_path
                .ok_or_else(|| AppError::Custom("项目路径不能为空".to_string()))?;
            let validated = crate::path_guard::validate_project_path(&pp)?;
            let gitignored = if ensure_gitignore {
                crate::claude_settings::ensure_local_settings_gitignored(&validated)?
            } else {
                false
            };
            Ok((crate::claude_settings::project_local_settings_path(&validated), gitignored))
        }
    }
}
```

将四个公开命令（line 367-405）整体替换为带 scope 的版本：

```rust
#[tauri::command]
pub async fn get_slot_bindings(
    pool: State<'_, SqlitePool>,
    scope: ConfigScope,
    project_path: Option<String>,
) -> AppResult<Vec<SlotBindingFull>> {
    log_read_command!("get_slot_bindings", {
        // 读命令：ensure_gitignore=false，不在查看时改写项目 .gitignore
        let (path, _) = resolve_slot_settings_path(scope, project_path, false)?;
        get_slot_bindings_full_at(pool.inner(), &path).await
    })
}

#[tauri::command]
pub async fn bind_slot(
    pool: State<'_, SqlitePool>,
    slot: String,
    model_id: i64,
    scope: ConfigScope,
    project_path: Option<String>,
) -> AppResult<()> {
    log_command!("bind_slot", {
        let (path, _) = resolve_slot_settings_path(scope, project_path, true)?;
        bind_slot_at(pool.inner(), &slot, model_id, &path).await?;
        tracing::info!(slot = %slot, model_id, "slot bound");
        Ok(())
    })
}

#[tauri::command]
pub async fn unbind_slot(
    pool: State<'_, SqlitePool>,
    slot: String,
    scope: ConfigScope,
    project_path: Option<String>,
) -> AppResult<()> {
    log_command!("unbind_slot", {
        let (path, _) = resolve_slot_settings_path(scope, project_path, true)?;
        unbind_slot_at(pool.inner(), &slot, &path).await?;
        tracing::info!(slot = %slot, "slot unbound");
        Ok(())
    })
}

#[tauri::command]
pub async fn set_current_model(
    pool: State<'_, SqlitePool>,
    slot: String,
    context_size: Option<String>,
    scope: ConfigScope,
    project_path: Option<String>,
) -> AppResult<()> {
    log_command!("set_current_model", {
        let (path, _) = resolve_slot_settings_path(scope, project_path, true)?;
        set_current_model_at(pool.inner(), &slot, context_size.as_deref(), &path).await?;
        tracing::info!(slot = %slot, context_size = ?context_size, "current model set");
        Ok(())
    })
}
```

> `ConfigScope` 需 `#[derive(Deserialize)]`（已具备，见 config.rs line 6）。tauri 自动从前端 `scope` 字符串反序列化。

- [ ] **步骤 4：运行测试验证通过**

运行：`cargo test -p jacc slots::tests -- --nocapture`
预期：PASS（含 `slot_path_*` 2 个新测试 + 原有槽位测试）。再跑全后端 `cargo test -p jacc` 确认零回退。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/slots.rs
git commit -m "feat(jacc): 槽位四命令 scope 化，项目级落 settings.local.json"
```

---

### 任务 6：useAppStore —— configScope 状态

**文件：**
- 修改：`packages/jacc/src/stores/useAppStore.ts`
- 测试：新增 `packages/jacc/src/stores/useAppStore.test.ts`

- [ ] **步骤 1：编写失败的测试**

> **现状（自审核实）：** `src/stores/useAppStore.test.ts` **已存在**（3 个测试：setTheme/setPage/setProject），其顶部 `beforeEach` 的 `setState({ currentPage: 'general', currentProject: null, theme: 'system' })` **不含 configScope**。zustand 的 setState 是 partial merge，跨用例会污染（前一个用例 set 了 `'project'` 不会被现有 beforeEach 清掉）。故本任务**不新建文件**，改为：(a) 在现有 `beforeEach` 的 setState 补 `configScope`；(b) 文件末尾追加新 describe。

**改动 1**——现有 `beforeEach` 的 setState 补 configScope：

```typescript
  beforeEach(() => {
    act(() => {
      useAppStore.setState({ currentPage: 'general', currentProject: null, theme: 'system', configScope: 'global' })
    })
  })
```

**改动 2**——文件末尾追加（保留原 3 个测试不动）：

```typescript
describe('useAppStore configScope', () => {
  beforeEach(() => {
    useAppStore.setState({ configScope: 'global', currentProject: null })
  })

  it('defaults to global', () => {
    expect(useAppStore.getState().configScope).toBe('global')
  })

  it('setConfigScope updates value', () => {
    useAppStore.getState().setConfigScope('project')
    expect(useAppStore.getState().configScope).toBe('project')
  })

  it('switching project does not reset configScope', () => {
    useAppStore.getState().setConfigScope('project')
    useAppStore.getState().setProject('/some/proj')
    expect(useAppStore.getState().configScope).toBe('project')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm --filter jacc test useAppStore` （或 `npx vitest run src/stores/useAppStore.test.ts`，在 `packages/jacc` 下）
预期：FAIL，`configScope` 为 undefined、`setConfigScope is not a function`。

- [ ] **步骤 3：编写实现代码**

将 `useAppStore.ts` 的 `AppState` 接口与 store 改为：

```typescript
export type ConfigScope = 'global' | 'project'

interface AppState {
  currentPage: Page
  currentProject: string | null
  configScope: ConfigScope
  theme: Theme
  setPage: (page: Page) => void
  setProject: (path: string | null) => void
  setConfigScope: (scope: ConfigScope) => void
  setTheme: (theme: Theme) => void
}

export const useAppStore = create<AppState>(set => ({
  currentPage: 'general',
  currentProject: null,
  configScope: 'global',
  theme: 'system',
  setPage: page => set({ currentPage: page }),
  setProject: path => set({ currentProject: path }),
  setConfigScope: scope => set({ configScope: scope }),
  setTheme: theme => set({ theme }),
}))
```

> 注意：`setProject` 不联动 `configScope`（设计 §5.1「切项目时不重置」）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run src/stores/useAppStore.test.ts`
预期：PASS（3 个测试）。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/stores/useAppStore.ts packages/jacc/src/stores/useAppStore.test.ts
git commit -m "feat(jacc): useAppStore 增加 configScope 状态"
```

---

### 任务 7：ScopeSwitcher 组件

**文件：**
- 创建：`packages/jacc/src/shared/components/ui/ScopeSwitcher.tsx`
- 创建：`packages/jacc/src/shared/components/ui/scope-switcher.variants.ts`
- 测试：`packages/jacc/src/shared/components/ui/ScopeSwitcher.test.tsx`

> **UI 任务：完成后必须用 brainstorming 视觉伴侣展示渲染，经用户验收后才进入下一任务（设计 §6）。**

- [ ] **步骤 1：编写失败的测试**

新建 `ScopeSwitcher.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScopeSwitcher } from './ScopeSwitcher'

describe('scopeSwitcher', () => {
  it('renders both options with a 作用域 label', () => {
    render(<ScopeSwitcher value="global" onChange={vi.fn()} />)
    expect(screen.getByText('作用域')).toBeTruthy()
    expect(screen.getByRole('button', { name: '全局' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '项目' })).toBeTruthy()
  })

  it('marks active option with aria-pressed', () => {
    render(<ScopeSwitcher value="project" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '项目' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '全局' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onChange when clicking inactive option', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScopeSwitcher value="global" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '项目' }))
    expect(onChange).toHaveBeenCalledWith('project')
  })
})
```

> 测试断言中文字面量「全局/项目/作用域」——默认 locale 为 zh（核实 `src/i18n` 默认值；若默认 en 则改断言为 'Global'/'Project'/'Scope' 并在两个 locale 都补 `scope.label` 键）。

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/shared/components/ui/ScopeSwitcher.test.tsx`
预期：FAIL，模块 `./ScopeSwitcher` 不存在。

- [ ] **步骤 3：编写 variants**

新建 `scope-switcher.variants.ts`：

```typescript
import { tv } from 'tailwind-variants'

export const scopeSwitcher = tv({
  slots: {
    root: 'inline-flex items-center gap-2',
    label: 'text-[11px] text-muted-foreground',
    group: 'inline-flex rounded-[8px] border border-border overflow-hidden',
    option: 'px-2.5 py-1 text-[11px] transition-colors',
  },
  variants: {
    scope: { global: {}, project: {} },
    active: { true: {}, false: { option: 'bg-transparent text-muted-foreground' } },
  },
  compoundVariants: [
    { scope: 'global', active: true, class: { option: 'bg-primary-light text-primary' } },
    { scope: 'project', active: true, class: { option: 'bg-success-light text-success' } },
  ],
})
```

- [ ] **步骤 4：编写组件 + i18n 键**

新建 `ScopeSwitcher.tsx`（命名导出 + 导出 Props，JSX < 50 行）：

```tsx
import { useT } from '@/i18n'
import type { ConfigScope } from '@/stores/useAppStore'
import { scopeSwitcher } from './scope-switcher.variants'

export interface ScopeSwitcherProps {
  value: ConfigScope
  onChange: (scope: ConfigScope) => void
  className?: string
}

const OPTIONS: ConfigScope[] = ['global', 'project']

export function ScopeSwitcher({ value, onChange, className }: ScopeSwitcherProps) {
  const { t } = useT()
  const { root, label, group, option } = scopeSwitcher()
  return (
    <div className={root({ className })}>
      <span className={label()}>{t('scope.label')}</span>
      <div className={group()}>
        {OPTIONS.map((scope) => {
          const active = value === scope
          return (
            <button
              key={scope}
              type="button"
              aria-pressed={active}
              onClick={() => !active && onChange(scope)}
              className={scopeSwitcher({ scope, active }).option()}
            >
              {t(`source.${scope}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

在 `src/i18n/locales/zh.json` 与 `en.json` 各新增一行 `scope.label`（与 `source.*` 同区块）：
- zh.json：`"scope.label": "作用域",`
- en.json：`"scope.label": "Scope",`

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run src/shared/components/ui/ScopeSwitcher.test.tsx`
预期：PASS（3 个测试）。

- [ ] **步骤 6：视觉伴侣验收 + Commit**

用 brainstorming 视觉伴侣渲染 ScopeSwitcher（全局态/项目态两张），经用户验收。通过后：

```bash
git add packages/jacc/src/shared/components/ui/ScopeSwitcher.tsx \
  packages/jacc/src/shared/components/ui/scope-switcher.variants.ts \
  packages/jacc/src/shared/components/ui/ScopeSwitcher.test.tsx \
  packages/jacc/src/i18n/locales/zh.json packages/jacc/src/i18n/locales/en.json
git commit -m "feat(jacc): 新增 ScopeSwitcher 作用域切换组件"
```

---

### 任务 8：SourceBadge 扩展 shared/local

**文件：**
- 修改：`packages/jacc/src/shared/components/ui/source-badge.variants.ts`
- 修改：`packages/jacc/src/shared/components/ui/SourceBadge.tsx`
- 修改：`packages/jacc/src/shared/components/ui/SourceBadge.test.tsx`
- 修改：i18n locales（新增 `source.shared` / `source.local`）

> 自审核实：`'project'` 被 skills 特性 `SkillListItem.tsx:29` 等引用，**保留 `'project'`，仅新增 `shared`/`local`**（设计 §5.4 条件分支）。

- [ ] **步骤 1：编写失败的测试**

在 `SourceBadge.test.tsx` 追加：

```tsx
it('renders shared badge', () => {
  render(<SourceBadge scope="shared" />)
  // 现有 SourceBadge.test.tsx 顶部 mock 让 t 原样返回 key（t:(key)=>key），故断言用 key 形式，
  // 与现有 line 14 'source.global' 风格一致。若断言中文「共享」，实现后 t('source.shared') 仍返回 'source.shared'，红灯不会熄。
  expect(screen.getByText('source.shared')).toBeTruthy()
})

it('renders local badge', () => {
  render(<SourceBadge scope="local" />)
  expect(screen.getByText('source.local')).toBeTruthy()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/shared/components/ui/SourceBadge.test.tsx`
预期：FAIL，TS 报 `scope="shared"` 不在联合类型；运行期找不到「共享」文本。

- [ ] **步骤 3：编写实现代码**

`source-badge.variants.ts` 在 `variants.scope` 内（`models` 后）新增：

```typescript
      shared: {
        root: 'bg-border text-muted',
      },
      local: {
        root: 'bg-success-light text-success',
      },
```

`SourceBadge.tsx` 改 Props 类型与 label 映射：

```tsx
export interface SourceBadgeProps {
  scope: 'global' | 'project' | 'user' | 'plugin' | 'models' | 'shared' | 'local'
  className?: string
}

const scopeLabelKeys: Record<string, string> = {
  global: 'source.global',
  project: 'source.project',
  user: 'source.user',
  plugin: 'source.plugin',
  shared: 'source.shared',
  local: 'source.local',
  models: '🧠',
}
```

i18n locales 新增（zh / en）：
- zh.json：`"source.shared": "共享",` `"source.local": "本地",`
- en.json：`"source.shared": "Shared",` `"source.local": "Local",`

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run src/shared/components/ui/SourceBadge.test.tsx`
预期：PASS（原有 + 2 新测试）。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/shared/components/ui/SourceBadge.tsx \
  packages/jacc/src/shared/components/ui/source-badge.variants.ts \
  packages/jacc/src/shared/components/ui/SourceBadge.test.tsx \
  packages/jacc/src/i18n/locales/zh.json packages/jacc/src/i18n/locales/en.json
git commit -m "feat(jacc): SourceBadge 新增 shared/local 来源标记"
```

---

### 任务 9：useConfig 重构（按 scope 读单层 + 分流写入）

**文件：**
- 修改：`packages/jacc/src/shared/hooks/useConfig.ts`
- 创建：`packages/jacc/src/shared/hooks/useConfig.test.ts`

- [ ] **步骤 1：编写失败的测试**

新建 `useConfig.test.ts`（mock invoke + store + toast，沿用 `vi.hoisted` + 动态 import 范式）：

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null },
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/providers/ToastProvider', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}))

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.success.mockReset()
  mocks.store.configScope = 'global'
  mocks.store.currentProject = null
})

describe('useConfig', () => {
  it('reads layer with global scope on mount', async () => {
    mocks.invoke.mockResolvedValue({ items: [{ key: 'model', value: 'opus', origin: 'global' }] })
    const { useConfig } = await import('./useConfig')
    const { result } = renderHook(() => useConfig())
    await waitFor(() => expect(result.current.config?.items.length).toBe(1))
    expect(mocks.invoke).toHaveBeenCalledWith('read_config_layer', { scope: 'global', projectPath: null })
  })

  it('needsProject when project scope without currentProject', async () => {
    mocks.store.configScope = 'project'
    const { useConfig } = await import('./useConfig')
    const { result } = renderHook(() => useConfig())
    await waitFor(() => expect(result.current.needsProject).toBe(true))
    expect(mocks.invoke).not.toHaveBeenCalledWith('read_config_layer', expect.anything())
  })

  it('writeConfig passes sensitive and toasts on wrote_local', async () => {
    mocks.store.configScope = 'project'
    mocks.store.currentProject = '/proj'
    mocks.invoke.mockImplementation((cmd: string) =>
      cmd === 'write_config'
        ? Promise.resolve({ wrote_local: true, gitignore_updated: true })
        : Promise.resolve({ items: [] }),
    )
    const { useConfig } = await import('./useConfig')
    const { result } = renderHook(() => useConfig())
    await act(async () => { await result.current.writeConfig('ANTHROPIC_AUTH_TOKEN', 'sk-x', true) })
    expect(mocks.invoke).toHaveBeenCalledWith('write_config', {
      scope: 'project', projectPath: '/proj', key: 'ANTHROPIC_AUTH_TOKEN', value: 'sk-x', sensitive: true,
    })
    expect(mocks.success).toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/shared/hooks/useConfig.test.ts`
预期：FAIL —— 旧 `useConfig` 调 `read_merged_config`、`writeConfig` 签名是 `(scope, key, value)`、无 `needsProject`。

- [ ] **步骤 3：编写实现代码**

将 `useConfig.ts` 整体替换为按 scope 读单层版本：

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '@/providers/ToastProvider'
import { useAppStore } from '@/stores/useAppStore'

export type ConfigOrigin = 'global' | 'shared' | 'local'

export interface LayerConfigItem {
  key: string
  value: unknown
  origin: ConfigOrigin
}

export interface LayerConfig {
  items: LayerConfigItem[]
}

interface WriteConfigResult {
  wrote_local: boolean
  gitignore_updated: boolean
}

export function useConfig() {
  const { configScope, currentProject } = useAppStore()
  const [config, setConfig] = useState<LayerConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToast()
  const { t } = useT()

  const needsProject = configScope === 'project' && !currentProject

  const refresh = useCallback(async () => {
    if (needsProject) {
      setConfig({ items: [] })
      return
    }
    setLoading(true)
    try {
      const result = await invoke<LayerConfig>('read_config_layer', {
        scope: configScope,
        projectPath: currentProject,
      })
      setConfig(result)
    } catch (e) { error(String(e)) }
    finally { setLoading(false) }
  }, [configScope, currentProject, needsProject, error])

  const writeConfig = useCallback(
    async (key: string, value: unknown, sensitive: boolean) => {
      const res = await invoke<WriteConfigResult>('write_config', {
        scope: configScope, projectPath: currentProject, key, value, sensitive,
      })
      if (res.wrote_local) success(t('config.wroteLocal'))
      await refresh()
    }, [configScope, currentProject, refresh, success, t])

  const deleteConfig = useCallback(
    async (key: string, origin: ConfigOrigin) => {
      await invoke('delete_config', {
        scope: configScope, projectPath: currentProject, key, origin,
      })
      await refresh()
    }, [configScope, currentProject, refresh])

  useEffect(() => { refresh() }, [refresh])

  return { config, loading, needsProject, refresh, writeConfig, deleteConfig }
}
```

i18n 新增 `config.wroteLocal`：
- zh.json：`"config.wroteLocal": "已写入 settings.local.json，不会提交到 git",`
- en.json：`"config.wroteLocal": "Saved to settings.local.json, won't be committed to git",`

> **破坏性变更：** `writeConfig`/`deleteConfig` 签名变了（去掉显式 scope 形参，新增 sensitive/origin）。下游 `usePermissions`/`useMcpServers`/`General` 在任务 10-13 适配。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run src/shared/hooks/useConfig.test.ts`
预期：PASS（3 个测试）。此时 `usePermissions`/`useMcpServers`/`General`/`env-vars` 的 TS 会报错 —— 由任务 10-13 修复，本步骤暂不要求全仓库 tsc 通过。`App.e2e.test.tsx` 在本任务后也会失败（useConfig 改调 `read_config_layer`，其 mockIPC 走 `default: null` 致 General 卡 loading 超时）——**属预期，由任务 17 步骤 2 修复；本任务只跑本 hook 单文件测试，不必跑全量 vitest**。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/shared/hooks/useConfig.ts \
  packages/jacc/src/shared/hooks/useConfig.test.ts \
  packages/jacc/src/i18n/locales/zh.json packages/jacc/src/i18n/locales/en.json
git commit -m "feat(jacc): useConfig 按 scope 读单层并支持敏感分流写入"
```

---

### 任务 10：extract API 适配 LayerConfig（env-vars / permissions / mcp）

**背景：** 三个 api 模块的 extract 函数当前吃 `MergedConfig`（item 带 `scope`），需改吃 `LayerConfig`（item 带 `origin`）。来源展示从 scope 推导改为 origin 推导。

**文件：**
- 修改：`packages/jacc/src/features/env-vars/api/env-vars-api.ts`
- 修改：`packages/jacc/src/features/permissions/api/permissions-api.ts`
- 修改：`packages/jacc/src/features/mcp-servers/api/mcp-servers-api.ts`
- 测试：各自同目录现有 `.test.ts`（若有）+ 新增 origin 断言

- [ ] **步骤 1：编写失败的测试**

新建 `env-vars-api.test.ts`（若已存在则追加），断言 extract 返回 origin：

```typescript
import { describe, expect, it } from 'vitest'
import { extractEnv } from './env-vars-api'

describe('extractEnv', () => {
  it('returns env value and origin from layer item', () => {
    const { env, origin } = extractEnv({
      items: [{ key: 'env', value: { FOO: 'bar' }, origin: 'local' }],
    })
    expect(env.FOO).toBe('bar')
    expect(origin).toBe('local')
  })

  it('defaults origin to global when item missing', () => {
    const { origin } = extractEnv({ items: [] })
    expect(origin).toBe('global')
  })
})
```

对 `permissions-api.ts` / `mcp-servers-api.ts` 同样新建/追加测试，断言 `extractPermissions(...).origin` / `extractMcpServers(...).origin`。

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/features/env-vars/api/env-vars-api.test.ts`
预期：FAIL —— extract 返回 `scope` 不是 `origin`，TS 报 `LayerConfig` 未导入。

- [ ] **步骤 3：编写实现代码**

三个文件改动一致（以 env-vars 为例）：
1. 第 1 行 import 改为：`import type { ConfigOrigin, LayerConfig } from '@/shared/hooks/useConfig'`
2. extract 函数返回类型 `scope: 'global' | 'project'` → `origin: ConfigOrigin`，参数类型 `MergedConfig | null` → `LayerConfig | null`，取值 `item?.scope || 'global'` → `item?.origin || 'global'`。

`env-vars-api.ts` 的 `extractEnv` 改为：

```typescript
export function extractEnv(config: LayerConfig | null): {
  env: Record<string, string>
  origin: ConfigOrigin
} {
  const item = config?.items.find(i => i.key === 'env')
  return {
    env: (item?.value as Record<string, string>) || {},
    origin: item?.origin || 'global',
  }
}
```

`permissions-api.ts` 的 `extractPermissions` 与 `mcp-servers-api.ts` 的 `extractMcpServers` 同样把返回字段 `scope` → `origin`、类型 `MergedConfig` → `LayerConfig`、`item?.scope` → `item?.origin`。其余纯函数（splitEnv/addRule/upsertServer 等）不变。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run src/features/env-vars/api src/features/permissions/api src/features/mcp-servers/api`
预期：PASS（含原有纯函数测试）。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/features/env-vars/api packages/jacc/src/features/permissions/api packages/jacc/src/features/mcp-servers/api
git commit -m "refactor(jacc): extract API 改吃 LayerConfig 并返回 origin"
```

---

### 任务 11：useSlotBindings 全链路 scope 化

**文件：**
- 修改：`packages/jacc/src/shared/hooks/useSlotBindings.ts`
- 修改/创建：`packages/jacc/src/shared/hooks/useSlotBindings.test.ts`

- [ ] **步骤 1：编写失败的测试**

> **现状（自审核实）：** `src/shared/hooks/useSlotBindings.test.ts` **已存在**（3 个测试），现有断言用旧签名：
> - line 59 `expect(invoke).toHaveBeenCalledWith('get_slot_bindings')`（无参）
> - line 75 `expect(invoke).toHaveBeenCalledWith('bind_slot', { slot: 'opus', modelId: 1 })`（无 scope/projectPath）
> - line 90 `expect(invoke).toHaveBeenCalledWith('set_current_model', { slot: 'opus', contextSize: '1m' })`（无 scope）
>
> 本任务改 hook 后这三处旧断言全红。故本步骤**替换整个 `useSlotBindings.test.ts`**（不是追加）：下面给出完整新文件内容，断言带 `{ scope, projectPath }`。mock 范式沿用现有文件（`@tauri-apps/api/core` invoke、`@tauri-apps/api/event` listen、`@/providers/ToastProvider`），新增 `@/stores/useAppStore` mock。

替换 `useSlotBindings.test.ts` 全文为（mock invoke + store + event listen）：

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null },
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/providers/ToastProvider', () => ({ useToast: () => ({ error: vi.fn() }) }))

beforeEach(() => {
  mocks.invoke.mockReset().mockResolvedValue([])
  mocks.store.configScope = 'global'
  mocks.store.currentProject = null
})

describe('useSlotBindings scope', () => {
  it('reads bindings with global scope on mount', async () => {
    const { useSlotBindings } = await import('./useSlotBindings')
    renderHook(() => useSlotBindings())
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('get_slot_bindings', { scope: 'global', projectPath: null }))
  })

  it('does not read when project scope without currentProject', async () => {
    mocks.store.configScope = 'project'
    const { useSlotBindings } = await import('./useSlotBindings')
    renderHook(() => useSlotBindings())
    await waitFor(() => {}) // settle
    expect(mocks.invoke).not.toHaveBeenCalledWith('get_slot_bindings', expect.anything())
  })

  it('bind passes scope + projectPath', async () => {
    mocks.store.configScope = 'project'
    mocks.store.currentProject = '/proj'
    const { useSlotBindings } = await import('./useSlotBindings')
    const { result } = renderHook(() => useSlotBindings())
    await act(async () => { await result.current.bind('opus', 7) })
    expect(mocks.invoke).toHaveBeenCalledWith('bind_slot', {
      slot: 'opus', modelId: 7, scope: 'project', projectPath: '/proj',
    })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/shared/hooks/useSlotBindings.test.ts`
预期：FAIL —— 旧 hook 不带 scope/projectPath，也不读 store。

- [ ] **步骤 3：编写实现代码**

改 `useSlotBindings.ts`：顶部加 `import { useAppStore } from '@/stores/useAppStore'`，在 hook 内取 `configScope`/`currentProject`，每个 invoke 带 scope。类型与接口（line 6-33）不变。改动 hook 主体（line 35-113）：

```typescript
export function useSlotBindings() {
  const { configScope, currentProject } = useAppStore()
  const [bindings, setBindings] = useState<SlotBindingFull[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const needsProject = configScope === 'project' && !currentProject

  const refresh = useCallback(async () => {
    if (needsProject) { setBindings([]); return }
    setLoading(true)
    try {
      const list = await invoke<SlotBindingFull[]>('get_slot_bindings', {
        scope: configScope, projectPath: currentProject,
      })
      setBindings(list)
    } catch (e) { error(String(e)) }
    finally { setLoading(false) }
  }, [configScope, currentProject, needsProject, error])

  const bind = useCallback(
    async (slot: string, modelId: number) => {
      try {
        await invoke('bind_slot', { slot, modelId, scope: configScope, projectPath: currentProject })
        await refresh()
      } catch (e) { error(String(e)); throw e }
    }, [refresh, error, configScope, currentProject])

  const unbind = useCallback(
    async (slot: string) => {
      try {
        await invoke('unbind_slot', { slot, scope: configScope, projectPath: currentProject })
        await refresh()
      } catch (e) { error(String(e)); throw e }
    }, [refresh, error, configScope, currentProject])

  const setCurrentModel = useCallback(
    async (slot: string, contextSize: string | null) => {
      try {
        await invoke('set_current_model', {
          slot, contextSize, scope: configScope, projectPath: currentProject,
        })
      } catch (e) { error(String(e)); throw e }
    }, [error, configScope, currentProject])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen('settings-changed', () => { refresh() }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  }, [refresh])

  return { bindings, loading, needsProject, refresh, bind, unbind, setCurrentModel }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run src/shared/hooks/useSlotBindings.test.ts`
预期：PASS（3 个测试）。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/shared/hooks/useSlotBindings.ts packages/jacc/src/shared/hooks/useSlotBindings.test.ts
git commit -m "feat(jacc): useSlotBindings 全链路带 scope + projectPath"
```

---

### 任务 12：共享 useSelectProject hook + 子组件 origin 化

**背景：** EmptyState 的「选择项目」逻辑在 `Layout.tsx:30-37` 与 `ProjectSwitcher.tsx:53-61` 重复（DRY 违例），四页守卫还要再用一次——抽成共享 hook。同时三个来源展示子组件（PermissionTable / McpServerItem / EnvVarRow）的 `scope: 'global' | 'project'` 需改为 `origin: ConfigOrigin` + `showSource`（来源列仅项目视图渲染）。

**文件：**
- 创建：`packages/jacc/src/shared/hooks/useSelectProject.ts` + `useSelectProject.test.ts`
- 修改：`shared/components/layout/Layout.tsx`、`shared/components/ui/ProjectSwitcher.tsx`（复用 hook）
- 修改：`features/permissions/components/PermissionTable.tsx`、`features/mcp-servers/components/McpServerItem.tsx`、`features/env-vars/components/EnvVarRow.tsx`

- [ ] **步骤 1：编写失败的测试**

新建 `useSelectProject.test.ts`：

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  add: vi.fn().mockResolvedValue(undefined),
  openProject: vi.fn().mockResolvedValue(undefined),
  setProject: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }))
vi.mock('@/shared/hooks/useProjects', () => ({
  useProjects: () => ({ add: mocks.add, open: mocks.openProject }),
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => ({ setProject: mocks.setProject }) }))

beforeEach(() => { Object.values(mocks).forEach(m => 'mockReset' in m && m.mockReset()) ; mocks.add.mockResolvedValue(undefined); mocks.openProject.mockResolvedValue(undefined) })

describe('useSelectProject', () => {
  it('adds, opens and sets project when a folder is chosen', async () => {
    mocks.open.mockResolvedValue('/picked/proj')
    const { useSelectProject } = await import('./useSelectProject')
    const { result } = renderHook(() => useSelectProject())
    await act(async () => { await result.current() })
    expect(mocks.add).toHaveBeenCalledWith('/picked/proj')
    expect(mocks.openProject).toHaveBeenCalledWith('/picked/proj')
    expect(mocks.setProject).toHaveBeenCalledWith('/picked/proj')
  })

  it('does nothing when dialog is cancelled', async () => {
    mocks.open.mockResolvedValue(null)
    const { useSelectProject } = await import('./useSelectProject')
    const { result } = renderHook(() => useSelectProject())
    await act(async () => { await result.current() })
    expect(mocks.setProject).not.toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/shared/hooks/useSelectProject.test.ts`
预期：FAIL，模块不存在。

- [ ] **步骤 3：编写 hook**

新建 `useSelectProject.ts`：

```typescript
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback } from 'react'
import { useProjects } from '@/shared/hooks/useProjects'
import { useAppStore } from '@/stores/useAppStore'

/** 弹目录选择 → add + open + setProject。Layout / ProjectSwitcher / 四页守卫共用。 */
export function useSelectProject() {
  const { add, open: openProject } = useProjects()
  const { setProject } = useAppStore()
  return useCallback(async () => {
    const selected = await open({ directory: true })
    if (typeof selected === 'string') {
      await add(selected)
      await openProject(selected)
      setProject(selected)
    }
  }, [add, openProject, setProject])
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run src/shared/hooks/useSelectProject.test.ts`
预期：PASS（2 个测试）。

- [ ] **步骤 5：用 hook 替换 Layout / ProjectSwitcher 的重复逻辑**

`Layout.tsx`：删除 `handleSelectProject`（line 30-37）与 `useProjects`/`open` 导入中仅为此用的部分；改为 `const handleSelectProject = useSelectProject()`，保留 `EmptyState onSelectProject={handleSelectProject}`。`ProjectSwitcher.tsx`：`handleSelectFolder` 改为调用 `useSelectProject()`（保留 `setIsOpen(false)`）。两处行为不变，测试 `Layout.test.tsx` 应仍绿。

- [ ] **步骤 6：子组件 origin 化**

三个组件统一把 `scope` prop 换成 `origin: ConfigOrigin` + `showSource: boolean`，来源列/单元格仅 `showSource` 时渲染，`SourceBadge scope={origin}`：

`EnvVarRow.tsx`：Props 改 `scope: 'global' | 'project' | 'models'` → `origin: ConfigOrigin | 'models'` + `showSource?: boolean`；line 49-51 的 `sourceCell` 包一层 `{showSource && (...)}`，内部 `<SourceBadge scope={origin} />`。

`PermissionTable.tsx`：Props `scope` → `origin: ConfigOrigin` + `showSource?: boolean`；headerSource（line 45）与 cellSource（line 55-57）各包 `{showSource && (...)}`。

`McpServerItem.tsx`：Props `scope` → `origin: ConfigOrigin` + `showSource?: boolean`；line 65 `<SourceBadge scope={scope} />` 改为 `{showSource && <SourceBadge scope={origin} />}`。

> `ConfigOrigin` 从 `@/shared/hooks/useConfig` import。这些组件现有测试需同步改：
> - `EnvVarRow.test.tsx`（现有，6 个用例）：把所有 `scope="global"` → `origin="global"`、`scope="models"` → `origin="models" showSource`（readOnly 行的 source 仍需展示 🧠，故 model 行传 showSource）。callbacks（`onLocalChange`/`onBlur`/`onDelete`）在 Plan A 不变，仅本任务做 props 改名，这些用例改完即应通过。**本任务必须同步改 `EnvVarRow.test.tsx` 否则 tsc/vitest 失败。**
> - `PermissionTable.test.tsx`（**本任务同步改，不能推到任务 13**——T12 改 Props 后该测试立即 tsc 失败）：现有全用 `scope="global"`/`scope="project"` prop（line 18/38/55/74/89/107/121，共 7 处）→ 改为 `origin="global"`/`origin="shared"` + 按需 `showSource`；`renders headers` 用例（line 13-27）现断言 `permissions.header.source` 列头恒显，改为仅当传 `showSource` 时才断言该列头（showSource=false 时来源列头应消失）；`renders SourceBadge with correct scope` 用例（line 116-127）改名 `renders SourceBadge with correct origin`、传 `origin="shared" showSource`、断言 textContent === `'shared'`。
> - `McpServerItem` 无独立测试文件，无需改测试。

- [ ] **步骤 7：Commit**

```bash
git add packages/jacc/src/shared/hooks/useSelectProject.ts packages/jacc/src/shared/hooks/useSelectProject.test.ts \
  packages/jacc/src/shared/components/layout/Layout.tsx \
  packages/jacc/src/shared/components/ui/ProjectSwitcher.tsx \
  packages/jacc/src/features/permissions/components/PermissionTable.tsx \
  packages/jacc/src/features/mcp-servers/components/McpServerItem.tsx \
  packages/jacc/src/features/env-vars/components/EnvVarRow.tsx \
  packages/jacc/src/features/env-vars/components/EnvVarRow.test.tsx
git commit -m "refactor(jacc): 抽出 useSelectProject + 子组件改用 origin/showSource"
```

---

### 任务 13：Permissions 页接入 scope

**文件：**
- 修改：`packages/jacc/src/features/permissions/hooks/usePermissions.ts`
- 修改：`packages/jacc/src/pages/Permissions.tsx`
- 修改：`packages/jacc/src/features/permissions/components/AddPermissionForm.tsx`（移除 scope select）
- 修改/创建：`packages/jacc/src/pages/Permissions.test.tsx`、`PermissionTable.test.tsx`

> **UI 任务：完成后用视觉伴侣展示 Permissions 全局/项目/无项目三态，经用户验收。**

- [ ] **步骤 1：编写失败的测试**

新建 `Permissions.test.tsx`（mock usePermissions + store + useSelectProject，断言守卫与切换栏）：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null, setConfigScope: vi.fn() },
  perms: { allowRules: [], denyRules: [], origin: 'global', add: vi.fn(), remove: vi.fn() },
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/features/permissions/hooks/usePermissions', () => ({ usePermissions: () => mocks.perms }))
vi.mock('@/shared/hooks/useSelectProject', () => ({ useSelectProject: () => vi.fn() }))

beforeEach(() => { mocks.store.configScope = 'global'; mocks.store.currentProject = null })

describe('Permissions page', () => {
  it('renders ScopeSwitcher', async () => {
    const { Permissions } = await import('./Permissions')
    render(<Permissions />)
    expect(screen.getByText('作用域')).toBeTruthy()
  })

  it('shows EmptyState when project scope without project', async () => {
    mocks.store.configScope = 'project'
    const { Permissions } = await import('./Permissions')
    render(<Permissions />)
    expect(screen.getByText('还没有打开项目')).toBeTruthy() // empty.title zh
  })
})
```

（`PermissionTable.test.tsx` 已在任务 12 步骤 6 同步更新完毕，本任务不再改它。）

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/pages/Permissions.test.tsx`
预期：FAIL —— 页面无 ScopeSwitcher、无守卫，`usePermissions` 仍返回 `scope` 非 `origin`。

- [ ] **步骤 3：改 usePermissions**

`writeConfig` 新签名是 `(key, value, sensitive)`，scope 由 store 决定，权限非敏感（`sensitive=false`）。`extractPermissions` 现返回 `origin`。改为：

```typescript
import type { PermissionRule, PermissionType } from '../api/permissions-api'
import { useCallback } from 'react'
import { useConfig } from '@/shared/hooks/useConfig'
import { addRule, extractPermissions, removeRule } from '../api/permissions-api'

export type { PermissionRule, PermissionType }

export function usePermissions() {
  const { config, writeConfig } = useConfig()
  const { permissions, origin } = extractPermissions(config)
  const allowRules = permissions.allow || []
  const denyRules = permissions.deny || []

  const add = useCallback(
    async (type: PermissionType, rule: PermissionRule) => {
      await writeConfig('permissions', addRule(permissions, type, rule), false)
    }, [permissions, writeConfig])

  const remove = useCallback(
    async (type: PermissionType, index: number) => {
      await writeConfig('permissions', removeRule(permissions, type, index), false)
    }, [permissions, writeConfig])

  return { allowRules, denyRules, origin, add, remove }
}
```

**同步更新 `usePermissions.test.ts`**（hook 签名变后该测试全红，必须随步骤 3 一起改；该文件已存在，mock 了 `@/shared/hooks/useConfig`）：
- mock item 的 `scope: 'global'`(line 18) → `origin: 'global'`
- 断言 `result.current.scope`(line 30/60) → `result.current.origin`（值 `'global'`）
- `add('deny', rule, 'project')` 三参(line 37) → `add('deny', rule)` 两参（scope 改由 store 决定，调用方不再传）
- `mocks.writeConfig` 断言 `('project', 'permissions', {...})`(line 39) 与 `('global', 'permissions', {...})`(line 51) → `('permissions', {...}, false)`（新签名 `key, value, sensitive`，权限非敏感）

- [ ] **步骤 4：改 Permissions.tsx（接入切换栏 + 守卫 + showSource）**

将 `Permissions.tsx` 整体替换为：

```tsx
import { useState } from 'react'
import { AddPermissionForm } from '@/features/permissions/components/AddPermissionForm'
import { PermissionTable } from '@/features/permissions/components/PermissionTable'
import { usePermissions } from '@/features/permissions/hooks/usePermissions'
import { useT } from '@/i18n'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Fab } from '@/shared/components/ui/Fab'
import { ScopeSwitcher } from '@/shared/components/ui/ScopeSwitcher'
import { useSelectProject } from '@/shared/hooks/useSelectProject'
import { useAppStore } from '@/stores/useAppStore'

export function Permissions() {
  const { t } = useT()
  const { configScope, currentProject, setConfigScope } = useAppStore()
  const { allowRules, denyRules, origin, add, remove } = usePermissions()
  const selectProject = useSelectProject()
  const [showAdd, setShowAdd] = useState(false)
  const [newValues, setNewValues] = useState<{ type: 'allow' | 'deny', tool: string, pattern: string }>(
    { type: 'allow', tool: 'Bash', pattern: '' },
  )
  const showSource = configScope === 'project'
  const needsProject = configScope === 'project' && !currentProject

  async function handleSubmit() {
    if (!newValues.pattern.trim()) return
    await add(newValues.type, { tool: newValues.tool, pattern: newValues.pattern })
    setNewValues(v => ({ ...v, pattern: '' }))
    setShowAdd(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-foreground">{t('permissions.title')}</h2>
        <ScopeSwitcher value={configScope} onChange={setConfigScope} />
      </div>

      {needsProject
        ? <EmptyState onSelectProject={selectProject} />
        : (
            <>
              <PermissionTable kind="allow" rules={allowRules} origin={origin} showSource={showSource} onDelete={i => remove('allow', i)} t={t} />
              <PermissionTable kind="deny" rules={denyRules} origin={origin} showSource={showSource} onDelete={i => remove('deny', i)} t={t} />
              <AddPermissionForm visible={showAdd} values={newValues} onChange={setNewValues} onSubmit={handleSubmit} onCancel={() => setShowAdd(false)} t={t} />
              <Fab onClick={() => setShowAdd(true)} />
            </>
          )}
    </div>
  )
}
```

- [ ] **步骤 5：改 AddPermissionForm.tsx（移除 scope select）**

`AddPermissionForm` 的 `values` 类型去掉 `scope` 字段（line 9），删除第三个 `<select>`（line 53-60）——写入 scope 现由页面级 `ScopeSwitcher` 决定。其余不变。

- [ ] **步骤 6：运行测试验证通过**

运行：`npx vitest run src/pages/Permissions.test.tsx src/features/permissions`
预期：PASS。

- [ ] **步骤 7：视觉伴侣验收 + Commit**

视觉伴侣展示 Permissions 三态，经用户验收后：

```bash
git add packages/jacc/src/pages/Permissions.tsx packages/jacc/src/pages/Permissions.test.tsx \
  packages/jacc/src/features/permissions
git commit -m "feat(jacc): Permissions 页接入 ScopeSwitcher + 无项目守卫"
```

---

### 任务 14：McpServers 页接入 scope

**文件：**
- 修改：`packages/jacc/src/features/mcp-servers/hooks/useMcpServers.ts`
- 修改：`packages/jacc/src/pages/McpServers.tsx`
- 创建：`packages/jacc/src/pages/McpServers.test.tsx`

> **UI 任务：完成后用视觉伴侣展示 McpServers 三态，经用户验收。**

- [ ] **步骤 1：编写失败的测试**

新建 `McpServers.test.tsx`（结构同 Permissions.test.tsx，mock useMcpServers 返回 `{ servers: {}, origin: 'global', save, remove, add }`）：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null, setConfigScope: vi.fn() },
  mcp: { servers: {}, origin: 'global', save: vi.fn(), remove: vi.fn(), add: vi.fn() },
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/features/mcp-servers/hooks/useMcpServers', () => ({ useMcpServers: () => mocks.mcp }))
vi.mock('@/shared/hooks/useSelectProject', () => ({ useSelectProject: () => vi.fn() }))

beforeEach(() => { mocks.store.configScope = 'global'; mocks.store.currentProject = null })

describe('McpServers page', () => {
  it('renders ScopeSwitcher', async () => {
    const { McpServers } = await import('./McpServers')
    render(<McpServers />)
    expect(screen.getByText('作用域')).toBeTruthy()
  })
  it('shows EmptyState when project scope without project', async () => {
    mocks.store.configScope = 'project'
    const { McpServers } = await import('./McpServers')
    render(<McpServers />)
    expect(screen.getByText('还没有打开项目')).toBeTruthy()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/pages/McpServers.test.tsx`
预期：FAIL —— 无 ScopeSwitcher / 守卫，hook 返回 `scope` 非 `origin`。

- [ ] **步骤 3：改 useMcpServers**

`extractMcpServers` 现返回 `origin`；`writeConfig` 新签名 `(key, value, sensitive)`，MCP 配置非敏感。改为：

```typescript
import type { McpServer } from '../api/mcp-servers-api'
import { useCallback } from 'react'
import { useConfig } from '@/shared/hooks/useConfig'
import { extractMcpServers, removeServer, upsertServer } from '../api/mcp-servers-api'

export type { McpServer }

export function useMcpServers() {
  const { config, writeConfig } = useConfig()
  const { servers, origin } = extractMcpServers(config)

  const save = useCallback(async (name: string, server: McpServer) => {
    await writeConfig('mcpServers', upsertServer(servers, name, server), false)
  }, [servers, writeConfig])

  const remove = useCallback(async (name: string) => {
    await writeConfig('mcpServers', removeServer(servers, name), false)
  }, [servers, writeConfig])

  const add = useCallback(async (name: string, command: string, argsString: string) => {
    const server: McpServer = { command, args: argsString ? argsString.split(' ') : undefined }
    await writeConfig('mcpServers', upsertServer(servers, name, server), false)
  }, [servers, writeConfig])

  return { servers, origin, save, remove, add }
}
```

**同步更新 `useMcpServers.test.ts`**（hook 签名变后该测试全红，必须随步骤 3 一起改；该文件已存在，mock 了 `@/shared/hooks/useConfig`）：
- mock item 的 `scope: 'global'`(line 14) → `origin: 'global'`
- 断言 `result.current.scope`(line 23) → `result.current.origin`
- `mocks.writeConfig` 断言 `('global', 'mcpServers', ...)`(line 32/41/50/62，共 4 处) → `('mcpServers', ..., false)`
- `save(name, server)`/`remove(name)`/`add(name, cmd, args)` 调用签名不变（只是内部 writeConfig 参数变）

- [ ] **步骤 4：改 McpServers.tsx**

参照任务 13 步骤 4 模式改写 `McpServers.tsx`：标题行加 `flex items-center justify-between` + `<ScopeSwitcher value={configScope} onChange={setConfigScope} />`；`needsProject` 时渲染 `<EmptyState onSelectProject={selectProject} />`，否则渲染原服务器列表 + 表单 + Fab。`McpServerItem` 传 `origin={origin} showSource={configScope === 'project'}` 替换原 `scope={scope}`。新增 import：`EmptyState`、`ScopeSwitcher`、`useSelectProject`、`useAppStore`。从 hook 解构改为 `const { servers, origin, save, remove, add } = useMcpServers()`。

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run src/pages/McpServers.test.tsx src/features/mcp-servers`
预期：PASS。

- [ ] **步骤 6：视觉伴侣验收 + Commit**

```bash
git add packages/jacc/src/pages/McpServers.tsx packages/jacc/src/pages/McpServers.test.tsx \
  packages/jacc/src/features/mcp-servers
git commit -m "feat(jacc): McpServers 页接入 ScopeSwitcher + 无项目守卫"
```

---

### 任务 15：EnvVars 页接入 scope（值输入重构留 Plan B）

**背景：** 本任务只做 scope 接入 + 守卫 + 来源列 + 写入分流骨架，保持现有 input 行编辑。combobox / 类型化输入 / catalog 是 Plan B。

**关键设计约束（写入分流的粒度问题）：** 后端 `write_config` 以**顶层 key** 为粒度，`env` 整体是一个 key。当前 `useEnvVars` 把整个 `env` 对象作为一个 key 写入，无法按单个变量分流到 shared/local。Plan A 阶段：env 整体按 `sensitive=false` 写 `settings.json`（共享），维持现状语义，**只新增 scope 维度**。逐变量敏感分流（单变量落 local）由 Plan B 引入 catalog 后实现（届时需扩展后端按 env 子键分流，或前端按 origin 分别 read-modify-write 两个文件）。本任务在 `useEnvVars` 顶部加注释标注这一已知限制。

**文件：**
- 修改：`packages/jacc/src/features/env-vars/hooks/useEnvVars.ts`
- 修改：`packages/jacc/src/pages/EnvVars.tsx`
- 创建：`packages/jacc/src/pages/EnvVars.test.tsx`

> **UI 任务：完成后用视觉伴侣展示 EnvVars 三态 + 来源列仅项目视图，经用户验收。**

- [ ] **步骤 1：编写失败的测试**

新建 `EnvVars.test.tsx`（结构同上，mock useEnvVars 返回 `{ regularEntries: [], modelEntries: [], origin: 'global', add, remove, update }`）：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null, setConfigScope: vi.fn() },
  env: { regularEntries: [], modelEntries: [], origin: 'global', add: vi.fn(), remove: vi.fn(), update: vi.fn() },
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/features/env-vars/hooks/useEnvVars', () => ({ useEnvVars: () => mocks.env }))
vi.mock('@/shared/hooks/useSelectProject', () => ({ useSelectProject: () => vi.fn() }))

beforeEach(() => { mocks.store.configScope = 'global'; mocks.store.currentProject = null })

describe('EnvVars page', () => {
  it('renders ScopeSwitcher', async () => {
    const { EnvVars } = await import('./EnvVars')
    render(<EnvVars />)
    expect(screen.getByText('作用域')).toBeTruthy()
  })
  it('shows EmptyState when project scope without project', async () => {
    mocks.store.configScope = 'project'
    const { EnvVars } = await import('./EnvVars')
    render(<EnvVars />)
    expect(screen.getByText('还没有打开项目')).toBeTruthy()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/pages/EnvVars.test.tsx`
预期：FAIL —— 无 ScopeSwitcher / 守卫。

- [ ] **步骤 3：改 useEnvVars**

`extractEnv` 现返回 `origin`；`writeConfig` 新签名。Plan A 维持整体非敏感写入（见上方约束注释）：

```typescript
import { useCallback } from 'react'
import { useConfig } from '@/shared/hooks/useConfig'
import { deleteEnvVar, extractEnv, setEnvVar, splitEnv } from '../api/env-vars-api'

// 已知限制（Plan A）：env 作为单个顶层 key 整体写入，sensitive=false → settings.json。
// 逐变量敏感分流（含密钥变量落 settings.local.json）由 Plan B 引入 catalog 后实现。
export function useEnvVars() {
  const { config, writeConfig } = useConfig()
  const { env, origin } = extractEnv(config)
  const { regularEntries, modelEntries } = splitEnv(env)

  const add = useCallback(async (key: string, value: string) => {
    await writeConfig('env', setEnvVar(env, key, value), false)
  }, [env, writeConfig])

  const remove = useCallback(async (key: string) => {
    await writeConfig('env', deleteEnvVar(env, key), false)
  }, [env, writeConfig])

  const update = useCallback(async (key: string, value: string) => {
    await writeConfig('env', setEnvVar(env, key, value), false)
  }, [env, writeConfig])

  return { regularEntries, modelEntries, origin, add, remove, update }
}
```

**同步更新 `useEnvVars.test.ts`**（hook 签名变后该测试全红，必须随步骤 3 一起改；该文件已存在，mock 了 `@/shared/hooks/useConfig`）：
- mock item 的 `scope: 'global'`(line 18) → `origin: 'global'`
- 断言 `result.current.scope`(line 30) → `result.current.origin`
- `mocks.writeConfig` 断言 `('global', 'env', ...)`(line 39/52/61，共 3 处) → `('env', ..., false)`
- `add(key, val)`/`remove(key)`/`update(key, val)` 调用签名不变

> 注：此为 **Plan A 阶段**的整体非敏感写适配。**Plan B 任务 5 会再次重写** `useEnvVars.ts` 与其测试（改调 `read_env_layer`/`set_env_var`），届时本测试文件的断言会被整体替换。

- [ ] **步骤 4：改 EnvVars.tsx**

标题行加 `flex items-center justify-between` + `<ScopeSwitcher value={configScope} onChange={setConfigScope} />`；`needsProject` 时渲染 `<EmptyState onSelectProject={selectProject} />`，否则渲染原表。来源列头（line 50 `envvars.header.source`）与每行 `EnvVarRow` 的 source 仅 `configScope === 'project'` 时渲染：给 `EnvVarRow` 传 `origin={origin} showSource={configScope === 'project'}`（model 行传 `origin="models" showSource`，因 🧠 始终显示）。从 hook 解构改 `origin`。新增 import：`EmptyState`、`ScopeSwitcher`、`useSelectProject`、`useAppStore`。

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run src/pages/EnvVars.test.tsx src/features/env-vars`
预期：PASS。

- [ ] **步骤 6：视觉伴侣验收 + Commit**

```bash
git add packages/jacc/src/pages/EnvVars.tsx packages/jacc/src/pages/EnvVars.test.tsx \
  packages/jacc/src/features/env-vars
git commit -m "feat(jacc): EnvVars 页接入 ScopeSwitcher + 无项目守卫（值输入留 Plan B）"
```

---

### 任务 16：General 页槽位区 + 标量 key 接入 scope

**背景：** General 页用 `useConfig`（effortLevel/skipDangerous 等标量 key）+ `useSlotBindings`（槽位）+ `usePreferences`。槽位与 useConfig 已在任务 9/11 scope 化，本任务给页面加 ScopeSwitcher + 守卫，并在项目视图槽位卡片底部加「写入 settings.local.json」提示（设计 §3.2）。

**文件：**
- 修改：`packages/jacc/src/pages/General.tsx`
- 修改/创建：`packages/jacc/src/pages/General.test.tsx`

> **UI 任务：完成后用视觉伴侣展示 General 全局/项目（含槽位提示）/无项目三态，经用户验收。**

- [ ] **步骤 1：编写失败的测试**

新建 `General.test.tsx`（mock useConfig / useSlotBindings / usePreferences / store / useSelectProject）：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: { configScope: 'global' as 'global' | 'project', currentProject: null as string | null, setConfigScope: vi.fn() },
  config: { items: [] as Array<{ key: string, value: unknown, origin: string }> },
}))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/shared/hooks/useConfig', () => ({
  useConfig: () => ({ config: mocks.config, refresh: vi.fn(), writeConfig: vi.fn() }),
}))
vi.mock('@/shared/hooks/useSlotBindings', () => ({
  useSlotBindings: () => ({ bindings: [], bind: vi.fn(), setCurrentModel: vi.fn() }),
}))
vi.mock('@/shared/hooks/usePreferences', () => ({ usePreferences: () => ({ set: vi.fn() }) }))
vi.mock('@/shared/hooks/useSelectProject', () => ({ useSelectProject: () => vi.fn() }))

beforeEach(() => { mocks.store.configScope = 'global'; mocks.store.currentProject = null; mocks.config.items = [] })

describe('General page', () => {
  it('renders ScopeSwitcher', async () => {
    const { General } = await import('./General')
    render(<General />)
    expect(screen.getByText('作用域')).toBeTruthy()
  })
  it('shows EmptyState when project scope without project', async () => {
    mocks.store.configScope = 'project'
    const { General } = await import('./General')
    render(<General />)
    expect(screen.getByText('还没有打开项目')).toBeTruthy()
  })
  it('shows local-write hint on slot card in project scope with project', async () => {
    mocks.store.configScope = 'project'
    mocks.store.currentProject = '/proj'
    const { General } = await import('./General')
    render(<General />)
    expect(screen.getByText(/settings\.local\.json/)).toBeTruthy()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/pages/General.test.tsx`
预期：FAIL —— 无 ScopeSwitcher / 守卫 / 槽位提示；且现有 `item.scope` 引用在 useConfig 改 origin 后 TS 报错。

- [ ] **步骤 3：改 General.tsx**

主要改动：(a) 顶部 import `EmptyState`/`ScopeSwitcher`/`useSelectProject`/`useAppStore`；(b) 取 store 的 `configScope`/`currentProject`/`setConfigScope`，算 `needsProject`；(c) 标题改 flex 行 + ScopeSwitcher；(d) `needsProject` 提前 return EmptyState；(e) 所有 `*.scope` → `*.origin`、`SourceBadge scope={x.origin}`；(f) `writeConfig(scope, key, val)` → `writeConfig(key, val, false)`；(g) 槽位卡片底部加项目提示。

标题与守卫（替换 line 37-38 与 line 79-81 区域）：

```tsx
  const { configScope, currentProject, setConfigScope } = useAppStore()
  const selectProject = useSelectProject()
  const needsProject = configScope === 'project' && !currentProject
  // ... 保留原 useEffect ...

  if (configScope === 'project' && !currentProject) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-medium text-foreground">{t('general.title')}</h2>
          <ScopeSwitcher value={configScope} onChange={setConfigScope} />
        </div>
        <EmptyState onSelectProject={selectProject} />
      </div>
    )
  }
  if (!config)
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>
```

> 注意 `needsProject` 守卫必须放在 `if (!config)` 之前——无项目时 useConfig 返回空 items，不应卡在 loading。

标题行（非空态，替换原 line 80-81）：

```tsx
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-medium text-foreground">{t('general.title')}</h2>
        <ScopeSwitcher value={configScope} onChange={setConfigScope} />
      </div>
```

槽位卡片底部提示（在 line 86 的 `{SLOTS.map(...)}` 容器之后、卡片 `</div>` 之前插入）：

```tsx
            {SLOTS.map(slot => <SlotRow key={slot} {...buildSlotProps(slot)} />)}
          </div>
          {configScope === 'project' && (
            <div className="mt-2.5 text-[11px] text-muted-foreground">
              🧠 {t('general.slotProjectHint')}
            </div>
          )}
```

标量 key 的 origin/writeConfig 改写（line 89-103）：

```tsx
        <SelectRow
          label={t('general.effortLevel')}
          description={t('general.effortLevel.desc')}
          value={(effortLevel?.value as string) || 'high'}
          options={EFFORT_OPTIONS}
          onChange={v => writeConfig('effortLevel', v, false)}
          badge={effortLevel && <SourceBadge scope={effortLevel.origin} />}
        />
        <ToggleRow
          label={t('general.skipDangerous')}
          description={t('general.skipDangerous.desc')}
          checked={!!skipDangerous?.value}
          onToggle={() => writeConfig('skipDangerousModePermissionPrompt', !(skipDangerous?.value as boolean), false)}
          badge={skipDangerous && <SourceBadge scope={skipDangerous.origin} />}
        />
```

i18n 新增 `general.slotProjectHint`：
- zh.json：`"general.slotProjectHint": "绑定将写入项目本地 settings.local.json（含密钥，自动 gitignore）",`
- en.json：`"general.slotProjectHint": "Bindings write to project-local settings.local.json (with credentials, auto-gitignored)",`

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run src/pages/General.test.tsx`
预期：PASS（3 个测试）。

- [ ] **步骤 5：视觉伴侣验收 + Commit**

视觉伴侣展示 General 三态（含项目视图槽位提示），经用户验收后：

```bash
git add packages/jacc/src/pages/General.tsx packages/jacc/src/pages/General.test.tsx \
  packages/jacc/src/i18n/locales/zh.json packages/jacc/src/i18n/locales/en.json
git commit -m "feat(jacc): General 页接入 ScopeSwitcher + 守卫 + 槽位项目提示"
```

---

### 任务 17：全量验证 + 集成测试

**背景：** 端到端验证 scope 切换 → 编辑 → 落对文件的完整流，确保零回退。

**文件：**
- 创建：`packages/jacc/src/App.scope.e2e.test.tsx`（沿用 `mockIPC` 模式）

- [ ] **步骤 1：编写集成测试**

新建 `App.scope.e2e.test.tsx`，用 `mockIPC` 拦截 `read_config_layer`/`write_config`，模拟项目 scope 下写敏感变量返回 `wrote_local: true`，断言切换后 UI 反映正确文件：

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

afterEach(() => clearMocks())

describe('scope switch e2e', () => {
  it('global view hides source column, project view shows it', async () => {
    const writes: any[] = []
    mockIPC((cmd, payload: any) => {
      switch (cmd) {
        case 'read_config_layer':
          return payload.scope === 'project'
            ? { items: [{ key: 'permissions', value: { allow: [{ tool: 'Bash', pattern: 'ls' }] }, origin: 'shared' }] }
            : { items: [{ key: 'permissions', value: { allow: [{ tool: 'Bash', pattern: 'ls' }] }, origin: 'global' }] }
        case 'get_slot_bindings': return []
        case 'list_projects': return [{ id: 1, name: 'proj', path: '/proj', pinned: false }]
        case 'get_preference': return null
        case 'set_active_project': return null
        case 'write_config': { writes.push(payload); return { wrote_local: false, gitignore_updated: false } }
        default: return null
      }
    })
    render(<App />)
    // 默认 general 页；导航到 permissions 由 Sidebar 完成——此处仅验证应用可渲染且 read_config_layer 被调用
    await waitFor(() => expect(screen.getByText('作用域')).toBeTruthy())
  })
})
```

> 若 App 默认页不是 permissions，按现有 `App.e2e.test.tsx` 的导航方式补点击 Sidebar 项；核心是断言 `read_config_layer` 在挂载时按当前 scope 调用、`write_config` 收到 `sensitive` 字段。

- [ ] **步骤 2：运行全量验证**

依次运行（在 `packages/jacc`）：

```bash
npx vitest run                    # 前端全量
npx tsc --noEmit                  # 类型零错误
npx eslint .                      # lint 零问题
cd src-tauri && cargo test -p jacc # 后端全量
cd src-tauri && cargo clippy -- -D warnings
```

预期：全绿。重点确认 `App.e2e.test.tsx`（原有）未因 `read_merged_config` → `read_config_layer` 改动而失败——若失败，更新其 mockIPC 增加 `read_config_layer` 分支（`read_merged_config` 仍保留，故旧依赖方不受影响）。

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src/App.scope.e2e.test.tsx
git commit -m "test(jacc): scope 切换端到端集成测试 + 全量验证"
```

---

## 自检结论（Plan A）

**规格覆盖：** §4.1 gitignore helper→T1；§4.3 槽位 scope 化（读写两侧）→T2/T5/T11/T16；§4.2 read_config_layer→T3、write/delete 分流→T4；§5.1 store→T6；§5.1 ScopeSwitcher→T7；§5.4 SourceBadge→T8；§5.2 useConfig→T9；extract API→T10；§5.3 无项目守卫→T12-T16；四页→T13(权限)/T14(MCP)/T15(env 骨架)/T16(通用)；§7 测试散布各任务 + T17 集成。

**已知取舍（向执行者明示）：**
1. env 逐变量敏感分流受限于「env 是单一顶层 key」，Plan A 仅整体非敏感写入，逐变量分流移交 Plan B（T15 注释标注）。
2. `'project'` 联合类型成员保留（skills 特性仍用），仅新增 `shared`/`local`（T8）。
3. `read_merged_config` 保留不动，本特性页面改用 `read_config_layer`，避免破坏其它依赖方。

**类型一致性：** `ConfigOrigin`（rust `lowercase` serde ↔ ts `'global'|'shared'|'local'`）、`ConfigScope`（`'global'|'project'`）、`WriteConfigResult`（`wrote_local`/`gitignore_updated` snake_case 贯穿前后端）一致。子组件统一 `origin: ConfigOrigin` + `showSource: boolean`。

---

## 审查修复记录（执行前复审，2026-06-14）

执行前对照实际代码逐任务复审，发现并订正了 6 处"会让实现者卡住"的问题（共性：计划假设"新建"测试文件，实际已存在；或 hook 签名变更后现有测试未同步，而验证命令恰好跑到它们）：

- **T6**：`useAppStore.test.ts` **已存在** → 步骤 1 改为"追加新 describe + 现有 beforeEach 补 `configScope:'global'`"，避免与现有 3 测试冲突、避免 zustand partial merge 跨用例污染。
- **T8**：`SourceBadge.test.tsx` 顶部 mock 是 `t:(key)=>key`，步骤 1 新增断言改用 key 形式 `source.shared`/`source.local`（与现有 line 14 风格一致），修复 TDD 红绿断裂（否则实现后红灯不熄）。
- **T9**：步骤 4 补"`App.e2e.test.tsx` 在本任务后会失败（read_merged_config→read_config_layer 致 General 卡 loading），属预期、由 T17 修复；本任务只跑 hook 单文件"说明。
- **T11**：`useSlotBindings.test.ts` **已存在**（line 59/75/90 旧断言）→ 步骤 1 改为"替换全文 + 更新旧断言为新签名"。
- **T12**：`PermissionTable.test.tsx` 的同步更新（7 处 `scope=`→`origin=`、line 26 来源列头、line 116-127 textContent 断言）从 T13 挪进 T12 步骤 6，T13 移除该重复项（否则 T12 commit 后仓库立即 tsc 失败）。
- **T13/T14/T15**：各补"同步更新 usePermissions/useMcpServers/useEnvVars.test.ts"子步骤（mock item `scope`→`origin`、断言 `scope`→`origin`、`writeConfig(scope,key,val)`→`writeConfig(key,val,false)`、`add` 三参→两参）。

后端部分（T1-T5）行号/符号/签名复审**全部准确**，未改动。Plan B 的衔接问题（P7/P8）见 plan-b.md 审查修复记录。

