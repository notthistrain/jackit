# jacc 操作日志设计

## 背景

jacc 构建后的日志仅记录启动和数据库初始化，29 个 Tauri 命令（provider/apikey/model CRUD、配置读写、slot 操作等）全部无日志。用户操作无法追溯，故障排查困难。

## 目标

- 故障排查：用户报告问题时能追溯操作历史，定位出错环节
- 基本审计：记录关键写操作的参数和结果
- 敏感数据保护：API Key 明文和配置值不写入日志

## 方案

**宏自动记录 + 写操作手动补充细节**

用 `macro_rules!` 宏 `log_command` 包裹所有命令，自动记录入口/出口/耗时/成功/失败。写操作在宏内再加一条 `tracing::info!` 记录关键参数。

不使用 proc macro（避免额外 crate 依赖），不使用泛型拦截函数（Tauri State 参数处理复杂）。

## 宏定义

```rust
// src-tauri/src/macros.rs
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

## 日志输出示例

```
2026-05-18T10:31:00.789Z INFO jacc::commands::providers: → invoked command=add_provider
2026-05-18T10:31:00.800Z INFO jacc::commands::providers: provider created id=1 name=Anthropic
2026-05-18T10:31:00.801Z INFO jacc::commands::providers: ✓ completed command=add_provider elapsed_ms=12
```

成功用 INFO，失败用 WARN（含错误信息）。

## 操作分类

### 读操作（仅宏自动记录）

| 命令 | 说明 |
|------|------|
| `list_providers` | 列表 |
| `list_api_keys` | 列表 |
| `list_models` | 列表 |
| `get_slot_bindings` | 查询 |
| `read_merged_config` | 查询 |
| `get_preference` | 查询 |
| `list_projects` | 列表 |
| `list_skills` | 列表 |

### 写操作（宏自动 + 手动细节日志）

| 命令 | 手动日志内容 | 脱敏 |
|------|-------------|------|
| `add_provider` | id, name, base_url | - |
| `update_provider` | id, 变更字段名 | - |
| `delete_provider` | id | - |
| `add_api_key` | id, provider_id, name | 不记录 api_key |
| `update_api_key` | id, 变更字段名 | 不记录 api_key |
| `delete_api_key` | id | - |
| `add_model` | id, api_key_id, model_name | - |
| `update_model` | id, 变更字段名 | - |
| `delete_model` | id | - |
| `test_model` | id, model_name | - |
| `bind_slot` | slot, model_id | - |
| `unbind_slot` | slot | - |
| `set_current_model` | slot, context_size | - |
| `write_config` | scope, key | 不记录 value |
| `delete_config` | scope, key | - |
| `set_preference` | key | - |
| `add_project` | path | - |
| `remove_project` | path | - |
| `open_project` | path | - |
| `pin_project` | path | - |
| `toggle_skill` | name, enabled | - |
| `import_skill` | path | - |
| `install_skill_from_github` | url | - |
| `confirm_install_skill` | name | - |

### 不记录日志的命令

| 命令 | 原因 |
|------|------|
| `log_debug/info/warn/error` | 日志桥接，记录会产生递归 |

## 代码模式

### 读操作

```rust
#[tauri::command]
pub async fn list_providers(pool: State<'_, SqlitePool>) -> AppResult<Vec<Provider>> {
    log_command!("list_providers", {
        list_providers_inner(pool.inner()).await
    })
}
```

### 写操作

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
```

## 文件变更

| 文件 | 变更 |
|------|------|
| `src-tauri/src/macros.rs` | 新增 |
| `src-tauri/src/lib.rs` | 加 `#[macro_use] mod macros;` |
| `commands/providers.rs` | 4 个命令加宏 + 手动日志 |
| `commands/api_keys.rs` | 4 个命令加宏 + 手动日志（脱敏） |
| `commands/models.rs` | 5 个命令加宏 + 手动日志 |
| `commands/slots.rs` | 4 个命令加宏 + 手动日志 |
| `commands/config.rs` | 3 个命令加宏 + 手动日志（脱敏） |
| `commands/preferences.rs` | 2 个命令加宏 + 手动日志 |
| `commands/projects.rs` | 5 个命令加宏 + 手动日志 |
| `commands/skills.rs` | 5 个命令加宏 + 手动日志 |
| `commands/log.rs` | 不改 |

## 不做的事

- 不改 `*_inner` 函数（保持纯逻辑，便于测试）
- 不改前端代码（日志纯粹在后端）
- 不加数据库日志表
- 不加日志查看 UI
- 不改现有日志格式和滚动策略
