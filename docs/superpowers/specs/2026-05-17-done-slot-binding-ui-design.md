# Slot 绑定 UI 优化设计

## 目标

优化通用页面中模型槽位绑定的交互体验：用扁平搜索下拉替代三级树形选择器（TreeSelect），去除冗余的「当前模型」独立区块，将应用操作内联到每个 slot 行中。

## 当前问题

1. **TreeSelect 操作繁琐** — 选模型需要展开 Provider → 展开 API Key → 点击 Model，三次点击
2. **布局不直观** — 「模型槽位」和「当前模型」是两个独立区块，关系不清
3. **context size 无回显** — 选了 1m 点应用后看不到变化，不确定是否生效（`setCurrentModel` 未刷新 config）
4. **样式粗糙** — 整体视觉不精致

## 设计方案

### 1. 新组件：`ModelSelect`

替换 `TreeSelect.tsx`，新建 `ModelSelect.tsx`。

**外观：**
- 紧凑按钮，显示当前选中模型名 + ▾（如 `claude-opus-4-6  ▾`）
- 未选中时显示灰色 placeholder `选择模型...  ▾`

**展开下拉：**
- 顶部搜索输入框，placeholder：「搜索模型名 / 服务商...」
- 扁平模型列表，每行：左侧 `model_name`，右侧灰色小字 `Provider · Key`
- 点击即选中，下拉关闭
- 搜索按模型名、服务商名、Key 名过滤

**数据获取：**
- 组件挂载时调用 `list_providers` → 遍历每个 provider 调用 `list_api_keys` → 遍历每个 key 调用 `list_models`
- 将结果扁平化为 `{ modelId, modelName, providerName, keyName }[]`
- 可复用 `useProviders` / `useApiKeys` / `useModels` hooks，或组件内部直接 invoke

**键盘支持：**
- ↑↓ 上下选择，Enter 确认，Esc 关闭
- 搜索框聚焦时即响应键盘

### 2. 重写 General.tsx 槽位区域

去掉「当前模型」独立区块。每个 slot 一行：

```
[Opus] [当前]  [claude-opus-4-6  ▾]  [1m  ▾]  [应用]  → model="opus[1m]"
[Sonnet]       [claude-sonnet-4-6  ▾] [默认  ▾]
[Haiku]        [选择模型...  ▾]       [默认  ▾]
```

**每行结构（从左到右）：**
- Slot 名称（Opus / Sonnet / Haiku）
- 「当前」badge（仅当前激活的 slot 显示，跟名称同行）
- ModelSelect 紧凑下拉
- context size 下拉（默认 / 1m）
- 「应用」按钮（**仅 hover 时显示**）
- `→ model="slot[ctx]"` 字符串（仅当前激活 slot 显示）

**状态逻辑：**
- 未绑定的 slot：ModelSelect 显示 placeholder，context 灰色禁用
- 已绑定非当前：正常显示，hover 时出现应用按钮
- 已绑定且当前：蓝色边框高亮 + 「当前」badge + model 字符串

**应用按钮行为：**
- 点击后调用 `setCurrentModel(slot, contextSize)`
- 成功后 toast 提示，更新当前高亮状态

### 3. 修复 context size 回显

**问题：** `setCurrentModel` 调用 `set_current_model` 后未刷新 config，导致 useEffect 读不到最新值。

**修复：** `useSlotBindings.setCurrentModel` 完成后触发 config 刷新（通过 `useConfig` 的 refresh 或重新 invoke `read_config`）。

### 4. 删除 TreeSelect.tsx

`TreeSelect.tsx` 不再使用，直接删除。

### 5. i18n 更新

**zh.json 新增：**
- `general.slot.searchPlaceholder`: "搜索模型名 / 服务商..."
- `general.slot.selectModel`: "选择模型..."

**en.json 新增：**
- `general.slot.searchPlaceholder`: "Search model / provider..."
- `general.slot.selectModel`: "Select model..."

## 改动范围

| 文件 | 操作 |
|------|------|
| `src/components/ModelSelect.tsx` | 新建：扁平搜索下拉组件 |
| `src/pages/General.tsx` | 重写槽位区域 |
| `src/components/TreeSelect.tsx` | 删除 |
| `src/hooks/useSlotBindings.ts` | 修复 context 回显 |
| `src/i18n/locales/zh.json` | 新增 2 个 key |
| `src/i18n/locales/en.json` | 新增 2 个 key |

## 不改动

- 模型库页面（Models.tsx）
- 后端 Rust API
- 数据库模型
- 其他页面
