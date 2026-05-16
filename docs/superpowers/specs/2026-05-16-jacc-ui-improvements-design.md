# jacc UI/UX 改进与国际化设计

## 概述

对 jacc 应用进行三方面改进：Skills 页面交互优化、模型概念重构（"激活"→"绑定"）、国际化支持。

## 1. Skills 页面改进

### 1.1 Tab 切换

页面顶部增加两个 tab：「已启用」「已禁用」。

- 默认显示「已启用」tab
- 每个 tab 旁显示对应数量角标（如 "已启用 (5)"）
- 切换 tab 时列表内容切换，搜索框保留且独立于 tab（搜索在当前 tab 内过滤）
- 用户级 skills（source: "user"）始终显示在「已启用」tab，不可操作

### 1.2 乐观更新

toggle 开关后的行为：

1. 立即更新本地 skills 数组中对应项的 `enabled` 状态
2. 该 skill 从当前 tab 列表中移除（视觉上消失）
3. 后台调用 `toggle_skill` 命令
4. 成功：无额外操作
5. 失败：回滚本地状态，显示错误提示（toast 或 inline）

不再调用 `list_skills` 全量刷新，滚动位置自然保持。

### 1.3 组件结构

```
SkillList.tsx
├── Tab 栏（已启用 | 已禁用）
├── 搜索框 + 统计信息
└── 列表（根据当前 tab 过滤）
```

## 2. 模型概念重构

### 2.1 术语变更

| 旧术语 | 新术语 |
|--------|--------|
| 激活 | 绑定 |
| 当前激活模型 | 当前绑定 |
| 已激活 | 已绑定 · {slot} |
| 激活按钮 | 绑定到 {slot} |
| 当前槽位 | 当前槽位（不变） |

### 2.2 数据库扩展

models 表新增字段：

```sql
ALTER TABLE models ADD COLUMN context_size TEXT DEFAULT NULL;
```

- 可选字段，用户在添加/编辑模型时填写
- 值为自由文本，如 "200k"、"1m"、"128k"
- 前端 AddModelDialog 增加"上下文容量"输入框

### 2.3 后端变更

- `CreateModelInput` 增加 `context_size: Option<String>`
- `UpdateModelInput` 增加 `context_size: Option<String>`
- `Model` / `ModelView` 增加 `context_size: Option<String>`
- `activate_model` 命令重命名为 `bind_model`（保持向后兼容，旧命令可删除）

### 2.4 General 页面模型行改造

当前设计：显示 model 值 + "管理"链接。

新设计：
- 左侧标签："模型"
- 右侧：下拉选择槽位（opus/sonnet/haiku）+ 显示绑定信息 + "管理"链接
- 绑定信息格式：`{alias} · {context_size}`（无绑定时显示"未绑定"）
- 下拉切换槽位时只更新显示，不写入配置

### 2.5 Models 页面文案更新

- 页面标题保持"模型库"
- 槽位选择器标签："当前槽位"（不变）
- 激活模型卡片标题区："当前绑定"
- badge 文案："已绑定"
- 列表中按钮："绑定到 {slot}"
- 确认操作无需弹窗（当前也没有）

## 3. 国际化

### 3.1 架构

复用 jackcom 的轻量 i18n 方案：

```
src/i18n/
  index.tsx          — LocaleProvider + useT() hook
  locales/
    zh.json          — 中文翻译
    en.json          — 英文翻译
```

核心实现：
- `LocaleProvider`：React Context，管理当前 locale 状态
- `useT()`：返回 `{ locale, setLocale, t }` 的 hook
- `t(key, params?)`：根据当前 locale 查找翻译，支持 `{param}` 插值
- Vite `import.meta.glob` 自动发现 locales 目录下的 JSON 文件

### 3.2 持久化

- localStorage key：`jacc:locale`
- 默认值：`zh`

### 3.3 切换入口

General 设置页面新增"语言 / Language"设置项：
- 下拉选择：中文 / English
- 切换后立即生效，无需重启

### 3.4 翻译覆盖范围

前端所有 UI 文案，包括：
- Sidebar 导航标签和分区标题
- 所有页面的标题、按钮、占位符、提示文案
- 对话框（AddModelDialog、InstallSkillDialog）
- 状态文案（加载中、未设置、未绑定等）
- 错误提示

不包括：
- Rust 后端日志（保持英文）
- Rust 后端返回的错误信息改为错误码，前端根据 locale 翻译展示

### 3.5 翻译 key 命名规范

采用点分层级命名：

```json
{
  "sidebar.config": "配置",
  "sidebar.general": "通用",
  "models.title": "模型库",
  "models.bind": "绑定到 {slot}",
  "models.bound": "已绑定",
  "skills.tab.enabled": "已启用",
  "skills.tab.disabled": "已禁用",
  "general.title": "通用设置",
  "general.language": "语言",
  "common.loading": "加载中...",
  "common.manage": "管理"
}
```

## 4. 实现顺序

1. **数据库迁移** — models 表加 context_size 字段
2. **后端重构** — activate → bind 重命名，增加 context_size 支持
3. **i18n 基础设施** — 搭建 LocaleProvider + 翻译文件
4. **Skills 页面改进** — tab 切换 + 乐观更新
5. **模型页面重构** — 术语变更 + context_size 输入
6. **General 页面改造** — 槽位下拉 + 语言切换
7. **全量文案提取** — 所有硬编码中文替换为 t() 调用

## 5. 技术约束

- 不引入第三方 i18n 库，保持与 jackcom 一致的自建方案
- 乐观更新失败时的回滚必须可靠，避免 UI 状态与后端不一致
- context_size 为纯展示字段，不参与任何逻辑计算
- 后端错误信息改为结构化错误码（如 "MODEL_NOT_FOUND"），前端负责翻译
