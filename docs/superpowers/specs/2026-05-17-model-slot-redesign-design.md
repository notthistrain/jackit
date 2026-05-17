# 模型 Slot 绑定架构重设计

日期：2026-05-17

## 背景

当前实现中，模型库页面同时负责模型 CRUD 和 slot 绑定，且写入 settings.json 的环境变量不正确（硬编码 `ANTHROPIC_MODEL`，应根据 slot 写入 `ANTHROPIC_DEFAULT_*_MODEL`）。通用页面的 slot 切换也会修改 settings.json，职责不清。

## 设计目标

1. **模型库页面**：纯模型 CRUD，不涉及 slot 和环境变量
2. **通用页面**：统一管理 slot 绑定和当前模型选择
3. **环境变量**：根据 slot 写入正确的 `ANTHROPIC_DEFAULT_*_MODEL`，slot 切换时覆盖全局凭证

## 数据库变更

### models 表

- 移除 `slot` 字段（ALTER TABLE 迁移）
- 保留：id, alias, base_url, api_key, model_name, context_size, created_at, updated_at

### 新增 model_slots 表

```sql
CREATE TABLE IF NOT EXISTS model_slots (
    slot        TEXT PRIMARY KEY,      -- 'opus', 'sonnet', 'haiku'
    model_id    INTEGER NOT NULL,      -- FK → models.id
    context_size TEXT,                 -- 该 slot 的上下文大小，如 '1m'
    updated_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);
```

## 后端 API 变更

### 保留（修改）

| Command | 变更 |
|---------|------|
| `list_models` | 不变 |
| `add_model` | 移除 `slot` 参数，只插入 models 表 |
| `update_model` | 不变 |
| `delete_model` | 增加级联清理 model_slots（SQLite ON DELETE CASCADE 自动处理） |
| `test_model` | 不变 |

### 新增

| Command | 参数 | 行为 |
|---------|------|------|
| `get_slot_bindings` | 无 | 返回所有 slot 的绑定信息（联查 model_slots + models） |
| `bind_slot` | `slot: String, model_id: i64` | 写入/更新 model_slots 表 + 写入 settings.json（BASE_URL, AUTH_TOKEN, DEFAULT_*_MODEL） |
| `unbind_slot` | `slot: String` | 删除 model_slots 记录 |
| `set_current_model` | `slot: String, context_size: Option<String>` | 写入 settings.json 的 `model` 字段，格式如 `opus[1m]` 或 `sonnet` |

### 移除

| Command | 原因 |
|---------|------|
| `bind_model` | 被通用页面的 `bind_slot` 替代 |
| `activate_slot` | 被通用页面的 `bind_slot` + `set_current_model` 替代 |

### settings.json 写入逻辑

**`bind_slot(slot, model_id)` 写入：**

1. 读取模型信息（base_url, api_key, model_name）
2. 写入 settings.json：
   - `env.ANTHROPIC_BASE_URL` = model.base_url
   - `env.ANTHROPIC_AUTH_TOKEN` = model.api_key
   - `env.ANTHROPIC_DEFAULT_OPUS_MODEL` / `...SONNET_MODEL` / `...HAIKU_MODEL` = model.model_name（根据 slot 参数决定写入哪个）
3. 注意：BASE_URL 和 AUTH_TOKEN 是全局的，每次绑定会覆盖

**`set_current_model(slot, context_size)` 写入：**

1. 写入 settings.json 的 `model` 字段：
   - 有 context_size：`"opus[1m]"`
   - 无 context_size：`"opus"`

## 前端变更

### 模型库页面 (Models.tsx)

**移除：**
- slot 下拉框（"当前槽位"选择器）
- "已绑定" / "未绑定" 状态显示
- `bind` 操作和相关按钮
- `slot` 相关的类型定义

**保留：**
- 模型列表（所有模型平铺显示）
- 每个模型卡片：别名、URL、模型名、context_size、测试、编辑、删除
- 添加模型对话框（移除 slot 字段）
- 编辑模型对话框

### 通用页面 (General.tsx)

**新增：模型槽位区**

三个 slot 行，每行：
- Slot 名称标签（Opus / Sonnet / Haiku）
- 下拉选择框（列出所有模型 + "未绑定"选项）
- 状态指示（已绑定/未绑定）
- 选择模型后调用 `bind_slot`
- 选择 "未绑定" 后调用 `unbind_slot`

**新增：当前模型区**

- Slot 下拉框（opus / sonnet / haiku）
- Context size 输入（预设：默认 / 1m）
- 选择后调用 `set_current_model`

**移除：**
- 原 `handleSlotChange` 中的 `activate_slot` 调用

## 数据流

```
模型库页面                    通用页面
    │                           │
    │ CRUD models 表            │ Slot 绑定 ──→ model_slots 表
    │                           │              + settings.json env
    │                           │
    │                           │ 当前模型 ──→ settings.json model 字段
```

## i18n 变更

- `models.slot.label` "当前槽位" → 移除（模型库不再有 slot 选择）
- `models.bound` / `models.unbound` / `models.bind` → 移除
- 新增通用页面的 slot 相关文案

## 迁移策略

1. 数据库迁移：`CREATE TABLE model_slots` + `ALTER TABLE models DROP COLUMN slot`（SQLite 不支持 DROP COLUMN，需要重建表）
2. 由于是早期开发阶段，直接重建表即可，不需要数据迁移
