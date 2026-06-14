# settings.json 项目级编辑 + 敏感信息分流 设计方案

> 状态：设计已通过视觉伴侣逐屏确认（2026-06-14），待用户审查后进入 writing-plans。
> 关联：本设计是对现有 `read_merged_config` / `write_config` 配置体系的演进，落在 jacc 包。

## 1. 背景与目标

jacc 当前管理 `~/.claude/settings.json`（全局）与 `<project>/.claude/settings.json`（项目）两层配置。后端 `ConfigScope::{Global, Project}` 已具备双维度读写能力，但前端把 scope 当作「某个 key 当前值来自哪一层」的**只读推导**，用户无法主动选择把配置写到项目级。

同时存在一个安全隐患：模型槽位会把 `ANTHROPIC_AUTH_TOKEN` 等密钥写进 settings.json，而项目级 settings.json 在项目目录下、极易被 git 提交，密钥暴露面远大于全局。

**目标：**
1. 让「项目级」成为用户可主动选择的编辑维度（不只是数据来源推导）。
2. 用对 Claude Code 的三层机制处理敏感信息：密钥落 `settings.local.json`（天然不进 git），团队配置落 `settings.json`（共享）。
3. 重构环境变量页：内置 Claude 支持的全部 env 变量目录，新增时可搜索、分组、hover 描述、按类型输入。
4. 四个配置页（通用 / 环境变量 / 权限 / MCP）统一交互模型：先选 scope，再编辑。

**非目标：**
- 不改模型槽位的凭证写入逻辑本身（槽位仍由其现有 `write_slot_env` 管理，仅切换目标文件）。
- 不引入第三方密钥管理器或变量插值。
- 不做 OTEL per-signal mTLS 等长尾变体的逐一枚举（目录按「族」收录）。

## 2. 核心机制：三层文件，两态心智

Claude Code 的 settings 层级（优先级高→低）：Managed > 命令行 > **项目本地 `settings.local.json`** > **项目共享 `settings.json`** > **全局 `~/.claude/settings.json`**。其中 `settings.local.json` 由 Claude Code 创建时**自动加进 .gitignore**，专用于个人/机器特定/敏感配置。

本设计向用户**只暴露两态**——`全局` 与 `项目`——但「项目」在底层对应两个文件：

| scope（用户可见） | 读取来源 | 写入目标 |
|---|---|---|
| **全局** | `~/.claude/settings.json` | `~/.claude/settings.json` |
| **项目** | `<proj>/.claude/settings.json` ∪ `settings.local.json`（local 覆盖 shared） | **非敏感** → `settings.json`（共享）<br>**敏感** → `settings.local.json`（自动 gitignore） |

- 切到「项目」视图时，显示的是**项目层的实际内容**（两个项目文件的并集），不掺入全局值。
- 每个配置项带 `origin: 'shared' | 'local'` 标记，用于：(a) 来源列 pill 显示「共享」/「本地」；(b) 删除时定位正确的文件。
- 写入时按变量的**敏感标记**自动分流。敏感性来源：env 变量取自 env-catalog 的 `sensitive` 字段；顶层标量 key（effortLevel、skipDangerousModePermissionPrompt 等）一律非敏感。
- 敏感项落盘那一刻弹一次**轻提示** toast（非拦截式）："已写入 settings.local.json，不会提交到 git"。
- 首次创建 `settings.local.json` 时，自动把 `.claude/settings.local.json` 追加进项目根 `.gitignore`（若该行尚不存在），复刻 Claude Code 行为。

**为什么不 gitignore 整个 settings.json：** 项目共享层（`settings.json`）的设计本意就是提交进 git、团队共享（权限、hooks、MCP 等）。把整个文件 gitignore 会误伤团队配置。`settings.local.json` 是 Claude Code 专为「不进 git 的敏感/个人配置」准备的——这才是正解。

## 3. UI 设计（已逐屏经视觉伴侣确认）

### 3.1 scope 切换栏
- 位置：每个配置页**标题同行右侧**。
- 形态：带「作用域」前缀标签的小尺寸分段控件 —— `作用域 [全局 | 项目]`。
- 配色：全局 = 紫（`#6d6aff`），项目 = 绿（`#5a8f5a`），与来源 pill 呼应。
- 四页（通用/环境变量/权限/MCP）完全一致。

### 3.2 通用页槽位区
- 槽位区**跟随页面级 scope**（废弃头脑风暴早期讨论的「槽位卡片头切换」「每槽位切换」方案）。
- 项目视图下，槽位卡片底部提示：🧠 绑定将写入项目本地 `settings.local.json`（含密钥，自动 gitignore）。

### 3.3 环境变量页
**来源列（仅项目视图渲染列头 + 单元格；全局视图整列隐藏，宽度让给值列）：**
- 「共享」pill（灰）= 落 `settings.json`；「本地」pill（绿）= 落 `settings.local.json`。

**槽位托管行：** 凭证类变量整行**置灰**、值显 `••••（槽位托管）`、来源标「🧠 槽位」、无删除按钮、不可编辑。

**新增 combobox：** 可搜索（输入过滤）、按分组展示、hover 浮出描述 tooltip（敏感项注明分流去向）、`slotManaged` 项置灰「🧠 由槽位管理」不可选、目录优先 + 允许自定义。

**类型化值输入：**
- `boolean` → 圆形开关（复用 ToggleRow 视觉），写盘 `0`/`1`，标签显「已开启(1)/已关闭(0)」+ 默认值。
- `enum` → 下拉，只列合法值。
- `number` → 数字框 + 单位/默认提示。
- `string` → 文本框。

### 3.4 无项目态
切到「项目」但未打开项目时，页面显示 EmptyState：📂 + "未选择项目" + 说明 + "选择项目…"按钮（复用现有 EmptyState 组件）。

### 3.5 敏感落盘提示
添加含凭证的变量后，右下角弹绿色告知式 toast：🔒「<变量名> 已写入项目本地 / 含凭证，已存入 settings.local.json 并自动加入 .gitignore，不会进版本库」。非拦截。

## 4. 后端设计（Rust / src-tauri）

### 4.1 claude_settings.rs 扩展
```rust
/// 项目本地 settings.local.json：<project>/.claude/settings.local.json
pub fn project_local_settings_path(project: &Path) -> PathBuf {
    project.join(".claude").join("settings.local.json")
}

/// 确保 <project>/.gitignore 含 ".claude/settings.local.json" 行。
/// 已存在则不动；文件不存在则创建。返回是否发生了写入。
pub fn ensure_local_settings_gitignored(project: &Path) -> AppResult<bool>;
```
`ensure_local_settings_gitignored`：读取 `<project>/.gitignore`（不存在视为空）→ 按行精确匹配 `.claude/settings.local.json`（忽略首尾空白），已存在返回 `false` 不写 → 不存在则追加一行（保留原内容与换行风格，末尾补换行），原子写入，返回 `true`。

### 4.2 config.rs 命令改动
```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ConfigOrigin { Global, Shared, Local }

#[derive(Debug, Serialize)]
pub struct LayerConfigItem { pub key: String, pub value: serde_json::Value, pub origin: ConfigOrigin }

#[derive(Debug, Serialize)]
pub struct LayerConfig { pub items: Vec<LayerConfigItem> }

/// 读取单个 scope 的实际内容（区别于合并读 read_merged_config）。
/// - Global：读 ~/.claude/settings.json，origin 全为 Global
/// - Project：读 settings.json + settings.local.json 合并，local 覆盖 shared；
///   每项 origin 标 Shared 或 Local
#[tauri::command]
pub async fn read_config_layer(scope: ConfigScope, project_path: Option<String>) -> AppResult<LayerConfig>;

#[derive(Debug, Serialize)]
pub struct WriteConfigResult { pub wrote_local: bool, pub gitignore_updated: bool }

/// 项目 scope 下按 sensitive 分流：true→settings.local.json(+gitignore)，false→settings.json。
/// Global scope 忽略 sensitive，照旧写全局文件。
#[tauri::command]
pub async fn write_config(
    scope: ConfigScope, project_path: Option<String>,
    key: String, value: serde_json::Value, sensitive: bool,
) -> AppResult<WriteConfigResult>;

/// 项目 scope 下按 origin 删对应文件（Shared→settings.json，Local→settings.local.json）。
#[tauri::command]
pub async fn delete_config(
    scope: ConfigScope, project_path: Option<String>,
    key: String, origin: ConfigOrigin,
) -> AppResult<()>;
```

### 4.3 槽位写入
`write_slot_env` 在 `scope=Project` 时目标改为 `settings.local.json`（槽位含密钥，天然敏感），并触发 `ensure_local_settings_gitignored`。

### 4.4 兼容性
- `read_merged_config` 保留不动（其它特性可能仍依赖；本特性页面改用 `read_config_layer`）。
- 现有 `write_config` 调用方需补 `sensitive` 参数（非本特性调用传 `false`，语义不变）。这是**破坏性签名变更**，实现计划需统一更新所有调用点。

## 5. 前端设计（React / TypeScript）

### 5.1 scope 状态与组件
- `useAppStore` 增加 `configScope: 'global' | 'project'` + `setConfigScope`，默认 `'global'`，切项目时不重置。
- 新增 `shared/components/ui/ScopeSwitcher.tsx` + `scope-switcher.variants.ts`：带「作用域」标签的二态分段控件，受控（value + onChange），命名导出 + 导出 Props。

### 5.2 useConfig 重构
- 按 `configScope` 调 `read_config_layer` 读单层；暴露 items（含 origin）、loading、refresh。
- `writeConfig(key, value, sensitive)`、`deleteConfig(key, origin)`，scope 从 store 取。
- 项目 scope 但 `currentProject == null` 时不发请求，返回空 + `needsProject: true`。
- 写入返回 `WriteConfigResult`，据 `wrote_local` 触发轻提示 toast。

### 5.3 无项目守卫
四页：`configScope === 'project' && !currentProject` → 渲染 `EmptyState`，不渲染配置表。

### 5.4 SourceBadge 扩展
- 支持 `shared`（「共享」灰）/ `local`（「本地」绿）；保留 `models` 的 🧠。
- 来源列**仅项目视图渲染**；全局视图列头与单元格一并隐藏。

### 5.5 env-catalog 数据模块
新增 `features/env-vars/api/env-catalog.ts`，内置 ~150 个变量（来源见附录 A）：
```ts
export interface EnvVarMeta {
  name: string
  group: EnvGroup
  type: 'string' | 'boolean' | 'number' | 'enum'
  enumValues?: string[]
  description: string
  default?: string
  sensitive: boolean
  slotManaged?: boolean
  unit?: string
}
export const ENV_CATALOG: EnvVarMeta[]
export function findEnvMeta(name: string): EnvVarMeta | undefined
export function searchCatalog(query: string): EnvVarMeta[] // 模糊匹配 name，分组返回
```
- `slotManaged`：`ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL`（与 `claude_settings.rs::slot_env_key` 对齐）。
- 不入目录：`CLAUDECODE` / `CLAUDE_CODE_CHILD_SESSION`（只读标识）。

### 5.6 环境变量页重构
- 列表：顶部 `ScopeSwitcher`；行 = 变量名 + 值 + 来源 pill（项目视图）+ 删除；槽位托管行置灰。
- 新增表单 `EnvVarCombobox.tsx`：搜索 + 分组 + hover 描述 + slotManaged 置灰不可选 + 允许自定义。
- 值输入 `EnvValueInput.tsx`：按 type 渲染 开关/下拉/数字/文本。
- 提交时从 catalog 取 `sensitive` 传 `writeConfig`；自定义变量 `sensitive=false`。
- **已知取舍 — 自定义变量敏感性**：目录外自定义变量一律按 `sensitive=false` 落 `settings.json`（共享）。若用户手输实际含密钥的自定义变量，系统无法自动识别，会写进可能进 git 的共享文件。缓解：combobox 确认自定义变量时提示「自定义变量不会自动判定敏感，含密钥请确认是否应放全局」。不拦截。

### 5.7 其它三页
- 统一加顶部 `ScopeSwitcher` + 无项目守卫，删除按项 scope 推导，读写走当前 `configScope`。
- 通用页槽位区：scope 影响槽位凭证写入目标层；effortLevel/skipDangerous 走对应 scope 的 settings.json。
- 权限/MCP：`usePermissions`/`useMcpServers` 改为读写当前 scope 单层。

## 6. 实现阶段硬约束：视觉伴侣验收

**所有涉及 UI 的实现任务，完成后必须用 brainstorming 视觉伴侣展示实际渲染效果，经用户验收后才进入下一步。** 适用：ScopeSwitcher、env combobox、类型化值输入、来源 pill、槽位置灰行、无项目 EmptyState、四页布局。纯后端任务（Rust 命令、gitignore helper）与纯数据任务（env-catalog）不强制，但其 UI 消费方仍需走视觉伴侣。

## 7. 测试策略

**后端（Rust 单测）：**
- `ensure_local_settings_gitignored`：空 / 已存在 / 已含该行 / 保留原内容 四种情形（幂等）。
- `read_config_layer`：全局单层、项目 shared+local 合并、local 覆盖 shared、origin 标记、无项目路径报错。
- `write_config` 分流：项目+敏感→写 local+gitignore；项目+非敏感→写 shared；全局忽略 sensitive。
- `delete_config` 按 origin 删对应文件。

**前端（Vitest + Testing Library）：**
- `env-catalog`：searchCatalog 模糊/分组、findEnvMeta、slotManaged 标记。
- `ScopeSwitcher` 二态切换；`EnvVarCombobox` 搜索/分组/置灰/自定义/hover；`EnvValueInput` 四类型 + boolean 0/1 + enum 限定。
- `useConfig`：按 scope 读单层、写传 sensitive、needsProject、wrote_local 触发提示。
- 四页：无项目守卫 EmptyState、项目视图来源 pill、槽位置灰。

**全局验证标准**（沿用前端重构规范）：组件 < 300 行 / JSX < 50 行、命名导出、Props 导出、变体文件、组件覆盖率 > 80%、tsc/eslint 零问题、零回退。集成测试沿用 mockIPC 模式覆盖 scope 切换 → 编辑 → 落对文件的端到端流。

## 8. 范围与计划拆分建议

体量较大，建议 writing-plans 拆为两个可独立验证的子计划，先 A 后 B（B 依赖 A 的 scope 与分流机制）：

- **Plan A — scope 维度基建**：claude_settings/config.rs 扩展、gitignore helper、`read_config_layer`、写入分流、`useAppStore` scope、`ScopeSwitcher`、`useConfig` 重构、四页接入 + 无项目守卫 + 来源 pill。产出：四页可在全局/项目切换并正确分流敏感信息。
- **Plan B — env 目录化**：`env-catalog.ts`、`EnvVarCombobox`、`EnvValueInput`、环境变量页新增表单重构、槽位置灰行。

两子计划的 UI 任务均以视觉伴侣验收为完成关卡。

## 9. 关键决策记录

1. 用户两态心智（全局/项目），敏感分流底层自动——而非暴露三态让用户选。
2. 项目视图 = 项目层并集（shared+local），不掺全局。
3. 敏感 → settings.local.json（自动 gitignore），非敏感 → settings.json；不 gitignore 整个共享文件。
4. env 目录化，目录优先 + 允许自定义；凭证类置灰由槽位管。
5. 类型化输入：boolean 用圆形开关（写盘 0/1）。
6. scope 栏在标题右侧，带「作用域」前缀标签，全局紫/项目绿。
7. 槽位区跟随页面级 scope（废弃逐槽位/卡片头切换）。
8. 自定义变量按非敏感处理，仅提示不拦截（已知取舍）。

## 附录 A：env 变量目录数据来源

清单取自 Claude Code 官方文档（抓取于 2026-06-14）：
- https://code.claude.com/docs/en/env-vars
- https://code.claude.com/docs/en/amazon-bedrock
- https://code.claude.com/docs/en/google-vertex-ai
- https://code.claude.com/docs/en/monitoring-usage
- https://code.claude.com/docs/en/network-config

约 150 个变量，分 17 组（认证凭证 / API端点网关 / 模型选择 / 缓存 / AWS-Bedrock / Vertex / Foundry / 功能开关 / 上下文记忆 / Effort思考 / 超时限制 / 网络代理 / TLS证书 / 遥测隐私 / UI显示 / 会话进程 / 调试日志），含类型 / 描述 / 默认值 / 敏感标记。完整明细在实现 Plan B 时落入 `env-catalog.ts`。要点：
- 敏感（sensitive=true）：ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_CUSTOM_HEADERS / AWS_* 密钥 / GOOGLE_APPLICATION_CREDENTIALS / ANTHROPIC_FOUNDRY_API_KEY / AWS_BEARER_TOKEN_BEDROCK / OTEL_EXPORTER_OTLP_HEADERS / mTLS 私钥类 / HTTP(S)_PROXY（可能含 user:pass）等。
- 槽位托管（slotManaged=true，目录置灰）：ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL / ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL。
- 不入目录：CLAUDECODE / CLAUDE_CODE_CHILD_SESSION（只读标识）。
- 文档不一致点：CLAUDE_CODE_MAX_RETRIES 默认值 env-vars 页写 3、monitoring 页写 10，tooltip 取 3 并注明。
