# 模型库层级数据模型重设计

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将扁平的 models 表重构为 Provider → APIKey → Model 三层层级结构，消除数据冗余，支持多 Provider 多 Key 场景。

**架构：** 3 张新表（providers、api_keys、models）替代现有扁平 models 表，通过外键 CASCADE DELETE 保证数据一致性。model_slots 表保持不变。通用页面的 set_current_model 增强：切换 slot 时自动更新全局凭证（BASE_URL、AUTH_TOKEN）。

**技术栈：** Rust (Tauri + sqlx + SQLite)、React + TypeScript、vitest

---

## 数据模型

### providers 表

```sql
CREATE TABLE providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
)
```

### api_keys 表

```sql
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
)
```

### models 表（替代旧表）

```sql
CREATE TABLE models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER NOT NULL,
    model_name TEXT NOT NULL,
    context_size TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
)
```

CASCADE DELETE 链：删除 Provider → 删除其下 APIKey → 删除其下 Model → 清理 model_slots 绑定。

### model_slots 表（不变）

```sql
CREATE TABLE model_slots (
    slot TEXT PRIMARY KEY,
    model_id INTEGER NOT NULL,
    context_size TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
)
```

## 迁移策略

将旧 models 表中每行展开为一个 Provider + APIKey + Model：

| 旧字段 | 新归属 |
|--------|--------|
| `alias` | Provider.name（如果同 base_url 已存在则复用） |
| `base_url` | Provider.base_url |
| `api_key` | APIKey.api_key |
| `model_name` | Model.model_name |
| `context_size` | Model.context_size |

迁移步骤：
1. 创建 providers、api_keys 表
2. 创建新的 models 表（重命名旧表为 models_old）
3. 遍历旧数据，按 base_url 分组创建 Provider，每行创建 APIKey + Model
4. 更新 model_slots 的 model_id 指向新模型
5. 删除 models_old

## 后端 API

### Provider CRUD

| 命令 | 参数 | 返回 |
|------|------|------|
| `list_providers` | — | `Vec<Provider>` |
| `add_provider` | `{ name, base_url, notes? }` | `Provider` |
| `update_provider` | `id, { name?, base_url?, notes? }` | `()` |
| `delete_provider` | `id` | `()` |

### APIKey CRUD

| 命令 | 参数 | 返回 |
|------|------|------|
| `list_api_keys` | `provider_id` | `Vec<ApiKeyView>`（key 做掩码） |
| `add_api_key` | `provider_id, { name, api_key, notes? }` | `ApiKeyView` |
| `update_api_key` | `id, { name?, api_key?, notes? }` | `()` |
| `delete_api_key` | `id` | `()` |

### Model CRUD

| 命令 | 参数 | 返回 |
|------|------|------|
| `list_models` | `api_key_id` | `Vec<Model>` |
| `add_model` | `api_key_id, { model_name, context_size? }` | `Model` |
| `update_model` | `id, { model_name?, context_size? }` | `()` |
| `delete_model` | `id` | `()` |
| `test_model` | `id` | `String`（用模型所属的 Provider.base_url + APIKey.api_key 发请求） |

### Slot 绑定（增强）

| 命令 | 变更 |
|------|------|
| `get_slot_bindings` | SlotBinding 联查 3 层（model → api_key → provider） |
| `bind_slot` | 写入 DEFAULT_*_MODEL + BASE_URL + AUTH_TOKEN |
| `unbind_slot` | 不变 |
| `set_current_model` | **增强**：写入 model 字段 + 自动查找该 slot 绑定模型的 Provider/APIKey，更新 BASE_URL 和 AUTH_TOKEN |

### SlotBinding 结构体

```rust
pub struct SlotBinding {
    pub slot: String,
    pub model_id: i64,
    pub model_name: String,
    pub context_size: Option<String>,
    pub api_key: String,       // 来自 api_keys 表
    pub base_url: String,      // 来自 providers 表
    pub provider_name: String, // 来自 providers 表
}
```

## 前端变更

### 模型库页面

三级折叠树，每级可 CRUD：

```
▼ Anthropic 官方                    [编辑] [删除]
  ▼ 主 Key                         [编辑] [删除]
    ● claude-opus-4-6 (200k)       [测试] [编辑] [删除]
    ● claude-sonnet-4-6            [测试] [编辑] [删除]
  + 添加 Key
+ 添加 Provider
```

- 点击 Provider 名称展开/折叠 APIKey 列表
- 点击 APIKey 名称展开/折叠 Model 列表
- FAB 按钮用于添加 Provider（顶级）

### 通用页面 Slot 绑定

树形选择器替代平铺下拉。每个 slot（opus/sonnet/haiku）旁是一个下拉，展开后显示 Provider → APIKey → Model 三级树，选择 Model 叶节点完成绑定。

### Hooks 变更

- `useModels` 拆分为 `useProviders`、`useApiKeys`、`useModels`
- `useSlotBindings` 适配新的 SlotBinding 结构

## 凭证自动更新

`set_current_model(slot, context_size)` 执行流程：

1. 查 model_slots 表获取该 slot 的 model_id
2. 查 models 表获取 model → api_key_id
3. 查 api_keys 表获取 api_key → provider_id
4. 查 providers 表获取 base_url
5. 写入 settings.json：
   - `model`: `"slot[context_size]"`
   - `env.ANTHROPIC_BASE_URL`: provider.base_url
   - `env.ANTHROPIC_AUTH_TOKEN`: api_key.api_key
