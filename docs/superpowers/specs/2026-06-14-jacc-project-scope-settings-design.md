# jacc settings.json 项目级编辑 + 敏感信息分流 设计

> 状态：设计已批准（2026-06-14），待写实现计划。
> 关联：本设计是对现有 `read_merged_config` / `write_config` 配置体系的演进，落在 jacc 包。

## 1. 背景与目标

jacc 当前管理 `~/.claude/settings.json`（全局）与 `<project>/.claude/settings.json`（项目）两层配置。后端 `ConfigScope::{Global, Project}` 已具备双维度读写能力，但前端把 scope 当作"某个 key 当前值来自哪一层"的**只读推导**，用户无法主动选择把配置写到项目级。

同时存在一个安全隐患：模型槽位会把 `ANTHROPIC_AUTH_TOKEN` 等密钥写进 settings.json，而项目级 settings.json 在项目目录下、极易被 git 提交，密钥暴露面远大于全局。

**目标：**
1. 让"项目级"成为用户可主动选择的编辑维度（不只是数据来源推导）。
2. 用对 Claude Code 的三层机制处理敏感信息：密钥落 `settings.local.json`（天然不进 git），团队配置落 `settings.json`（共享）。
3. 重构环境变量页：内置 Claude 支持的全部 env 变量目录，新增时可搜索、分组、hover 描述、按类型输入。
4. 四个配置页（通用 / 环境变量 / 权限 / MCP）统一交互模型：先选 scope，再编辑。

**非目标：**
- 不改模型槽位的凭证写入逻辑本身（槽位仍由其现有 `write_slot_env` 管理）。
- 不引入第三方密钥管理器或变量插值。
- 不做 OTEL per-signal mTLS 等长尾变体的逐一枚举（目录按"族"收录）。

## 2. 核心机制：三层文件，两态心智

Claude Code 的 settings 层级（优先级高→低）：Managed > 命令行 > **项目本地 `settings.local.json`** > **项目共享 `settings.json`** > **全局 `~/.claude/settings.json`**。其中 `settings.local.json` 由 Claude Code 创建时**自动加进 .gitignore**，专用于个人/机器特定/敏感配置。

本设计向用户**只暴露两态**——`全局` 与 `项目`——但"项目"在底层对应两个文件：

| scope（用户可见） | 读取来源 | 写入目标 |
|---|---|---|
| **全局** | `~/.claude/settings.json` | `~/.claude/settings.json` |
| **项目** | `<proj>/.claude/settings.json` ∪ `settings.local.json`（local 覆盖 shared） | **非敏感** → `settings.json`（共享）<br>**敏感** → `settings.local.json`（自动 gitignore） |

- 切到"项目"视图时，显示的是**项目层的实际内容**（两个项目文件的并集），不掺入全局值。
- 每个配置项带 `origin: 'shared' | 'local'` 标记，用于：(a) 来源列 pill 显示「共享」/「本地」；(b) 删除时定位正确的文件。
- 写入时按变量的**敏感标记**自动分流。敏感性来源：env 变量取自 env-catalog 的 `sensitive` 字段；顶层标量 key（effortLevel、skipDangerousModePermissionPrompt 等）一律非敏感。
- 敏感项落盘那一刻弹一次**轻提示** toast（非拦截式）："已写入 settings.local.json，不会提交到 git"。
- 首次创建 `settings.local.json` 时，自动把 `.claude/settings.local.json` 追加进项目根 `.gitignore`（若该行尚不存在），复刻 Claude Code 行为。

## 3. 后端设计（Rust / src-tauri）

### 3.1 claude_settings.rs 扩展

新增项目本地文件路径：
```rust
/// 项目本地 settings.local.json：<project>/.claude/settings.local.json
pub fn project_local_settings_path(project: &Path) -> PathBuf {
    project.join(".claude").join("settings.local.json")
}
```

新增 gitignore helper（独立函数，便于单测）：
```rust
/// 确保 <project>/.gitignore 含 ".claude/settings.local.json" 行。
/// 已存在则不动；文件不存在则创建。返回是否发生了写入。
pub fn ensure_local_settings_gitignored(project: &Path) -> AppResult<bool>;
```
- 读取 `<project>/.gitignore`（不存在视为空）。
- 按行精确匹配 `.claude/settings.local.json`（忽略首尾空白），已存在则返回 `false` 不写。
- 不存在则追加一行（保留原内容、原换行风格，末尾补换行），原子写入，返回 `true`。

### 3.2 config.rs 命令改动

新增"读单层"命令（区别于现有合并读 `read_merged_config`）：
```rust
#[derive(Debug, Serialize)]
pub struct LayerConfigItem {
    pub key: String,
    pub value: serde_json::Value,
    pub origin: ConfigOrigin, // Global | Shared | Local
}

#[derive(Debug, Serialize)]
pub struct LayerConfig { pub items: Vec<LayerConfigItem> }

/// 读取单个 scope 的实际内容。
/// - Global：读 ~/.claude/settings.json，origin 全为 Global
/// - Project：读 settings.json + settings.local.json 合并，
///   local 覆盖 shared；每项 origin 标 Shared 或 Local
#[tauri::command]
pub async fn read_config_layer(scope: ConfigScope, project_path: Option<String>) -> AppResult<LayerConfig>;
```

`write_config` 扩展——项目 scope 增加敏感分流：
```rust
#[tauri::command]
pub async fn write_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
    value: serde_json::Value,
    sensitive: bool, // 新增：仅 Project scope 生效
) -> AppResult<WriteConfigResult>;

#[derive(Debug, Serialize)]
pub struct WriteConfigResult {
    pub wrote_local: bool,       // 是否写入了 settings.local.json
    pub gitignore_updated: bool, // 是否新增了 .gitignore 条目
}
```
- Global scope：照旧写全局文件，`sensitive` 忽略，`wrote_local=false`。
- Project scope：`sensitive=true` → 写 `settings.local.json` + 调 `ensure_local_settings_gitignored`；`sensitive=false` → 写 `settings.json`。
- 前端据 `WriteConfigResult` 决定是否弹"已写入本地、不进 git"轻提示。

`delete_config` 扩展——按 origin 删对应文件：
```rust
#[tauri::command]
pub async fn delete_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
    origin: ConfigOrigin, // 新增：Project scope 下决定删 shared 还是 local
) -> AppResult<()>;
```
- Global scope：删全局文件，origin 忽略。
- Project scope：origin=Shared 删 `settings.json`，origin=Local 删 `settings.local.json`。

### 3.3 兼容性

- `read_merged_config` 保留不动（其它特性可能仍依赖；本特性的页面改用 `read_config_layer`）。
- 现有 `write_config` 调用方需补 `sensitive` 参数；非本特性调用方传 `false` 即可（语义不变，仍写全局或项目 settings.json）。这是**破坏性签名变更**，实现计划需统一更新所有调用点。

## 4. 前端设计（React / TypeScript）

### 4.1 scope 状态与切换组件

- `useAppStore` 增加 `configScope: 'global' | 'project'` 与 `setConfigScope`，默认 `'global'`。切换项目时不重置（保留用户上次选择）。
- 新增共享组件 `shared/components/ui/ScopeSwitcher.tsx` + `scope-switcher.variants.ts`：二态分段控件 `[全局 | 项目]`，受控（value + onChange）。命名导出 + 导出 Props。
- 四个配置页顶部统一放置 `ScopeSwitcher`，绑定 `configScope`。

### 4.2 useConfig 重构

```ts
// 现：单一 read_merged_config
// 改：按 configScope 读单层
export function useConfig() {
  const { configScope, currentProject } = useAppStore()
  // read_config_layer(configScope, currentProject)
  // 返回 items（含 origin）、loading、refresh
  // writeConfig(key, value, sensitive) —— scope 从 store 取
  // deleteConfig(key, origin) —— scope 从 store 取
}
```
- 项目 scope 但 `currentProject == null` 时，不发请求，返回空 + 一个 `needsProject: true` 标志。
- 写入返回 `WriteConfigResult`，hook 据 `wrote_local` 触发轻提示 toast。

### 4.3 无项目守卫

通用/环境变量/权限/MCP 四页：当 `configScope === 'project' && !currentProject` 时，渲染复用的 `EmptyState`（引导选项目），不渲染配置表。其余情况照常。

### 4.4 来源列与 SourceBadge

- `SourceBadge` 扩展支持 `origin` 维度的 `shared` / `local` 文案与配色（「共享」灰、「本地」绿）。`models`（槽位托管）保留现有 🧠。
- **整个来源列只在项目视图渲染**（列头 + 单元格）；全局视图所有项都来自全局，来源列连同列头一并隐藏，表格相应让出宽度给值列。

### 4.5 env-catalog 数据模块

新增 `features/env-vars/api/env-catalog.ts`，内置 ~150 个 Claude Code 环境变量（数据来源见附录 A）。每项结构：
```ts
export interface EnvVarMeta {
  name: string
  group: EnvGroup            // 认证 | 端点网关 | 模型 | AWS | Vertex | Foundry | 缓存 | 功能开关 | 上下文记忆 | Effort思考 | 超时限制 | 网络代理 | TLS证书 | 遥测隐私 | UI显示 | 会话进程 | 调试日志
  type: 'string' | 'boolean' | 'number' | 'enum'
  enumValues?: string[]      // type==='enum' 时
  description: string        // 中文，hover tooltip
  default?: string
  sensitive: boolean         // 决定项目级写入分流目标
  slotManaged?: boolean      // true=由模型槽位管理，目录中置灰不可选
  unit?: string              // number 类型的单位提示，如 'ms' / 'tokens'
}

export const ENV_CATALOG: EnvVarMeta[]
export function findEnvMeta(name: string): EnvVarMeta | undefined
export function searchCatalog(query: string): EnvVarMeta[] // 按 name 模糊匹配，分组返回
```
- `slotManaged` 标记的变量：`ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_DEFAULT_OPUS_MODEL` / `_SONNET_MODEL` / `_HAIKU_MODEL`（与 `claude_settings.rs::slot_env_key` 对齐）。
- 只读标识变量（`CLAUDECODE` / `CLAUDE_CODE_CHILD_SESSION`）不入目录。

### 4.6 环境变量页重构

**列表区：**
- 顶部 `ScopeSwitcher`。
- 表格行：变量名 + 值 + 来源 pill（项目视图）+ 删除。
- 槽位托管行（命中 `slotManaged`）：整行置灰、值显 `••••（槽位托管）`、来源标「🧠 槽位」、无删除按钮、不可编辑。

**新增表单（核心重构）：**
- 变量名输入改为 **combobox**：`features/env-vars/components/EnvVarCombobox.tsx`
  - 输入即搜索（`searchCatalog`），结果按 `group` 分组展示。
  - 每项 hover 浮出 `description` tooltip（敏感项注明"写项目级时自动入 settings.local.json"）。
  - `slotManaged` 项置灰 + 「🧠 由槽位管理」不可选。
  - 目录优先 + **允许自定义**：输入目录外的名字也能确认（视为 string 类型、非敏感、无描述）。
- 值输入区按选中变量的 `type` 自适应（`EnvValueInput.tsx`）：
  - `boolean` → 圆形开关（复用 ToggleRow 视觉），写盘 `0`/`1`，标签显"已开启(1)/已关闭(0)"+ 默认值。
  - `enum` → 下拉，只列 `enumValues`。
  - `number` → 数字框 + `unit`/默认提示。
  - `string` → 文本框。
- 提交时：从 catalog 取 `sensitive` 传给 `writeConfig`；自定义变量 `sensitive=false`。
- **已知取舍 — 自定义变量的敏感性**：目录外的自定义变量一律按 `sensitive=false` 处理，写入项目级时落 `settings.json`（共享）。若用户手输一个实际含密钥的自定义变量名（如某私有网关 token），系统无法自动识别其敏感性，会写进可能进 git 的共享文件。缓解：combobox 在确认自定义变量时给一行提示"自定义变量不会自动判定敏感，含密钥请确认是否应放全局"。不做拦截（用户可能有正当理由）。

### 4.7 其它三页（通用 / 权限 / MCP）

- 统一加顶部 `ScopeSwitcher` + 无项目守卫。
- 删除按项 scope 推导，改为：读写都走当前 `configScope`。
- 通用页槽位区：scope 切换影响槽位凭证写入的目标层（沿用 4.1 的 store scope）；槽位写凭证属敏感，项目级时落 `settings.local.json`。effortLevel / skipDangerous 走对应 scope 的 settings.json。
- 权限 / MCP：现有 `usePermissions` / `useMcpServers` 改为读写当前 scope 单层。

## 5. 实现阶段的硬约束：视觉伴侣验收

**所有涉及 UI 的实现任务，完成后必须用 brainstorming 视觉伴侣展示实际渲染效果，经用户验收后才进入下一步。** 适用范围：ScopeSwitcher、env combobox、类型化值输入、来源 pill、槽位置灰行、无项目 EmptyState、四页布局。纯后端任务（Rust 命令、gitignore helper）与纯数据任务（env-catalog）不强制，但其 UI 消费方仍需走视觉伴侣。

## 6. 测试策略

**后端（Rust 单测）：**
- `ensure_local_settings_gitignored`：空/已存在/已含该行/保留原内容 四种情形。
- `read_config_layer`：全局单层、项目 shared+local 合并、local 覆盖 shared、origin 标记正确、无项目路径报错。
- `write_config` 分流：项目 + sensitive → 写 local + gitignore；项目 + 非敏感 → 写 shared；全局忽略 sensitive。
- `delete_config` 按 origin 删对应文件。

**前端（Vitest + Testing Library）：**
- `env-catalog`：searchCatalog 模糊匹配/分组、findEnvMeta、slotManaged 标记正确。
- `ScopeSwitcher`：二态切换回调。
- `EnvVarCombobox`：搜索过滤、分组渲染、slotManaged 置灰不可选、自定义输入可确认、hover 描述。
- `EnvValueInput`：四种类型各自渲染正确控件、boolean 写盘 0/1、enum 限定值。
- `useConfig` 重构：按 scope 读单层、写传 sensitive、无项目 needsProject 标志、wrote_local 触发提示。
- 四页：无项目守卫渲染 EmptyState；项目视图来源 pill；槽位行置灰。

**全局验证标准**（沿用前端重构 design 规范）：组件 < 300 行 / JSX < 50 行、命名导出、Props 导出、变体文件、组件覆盖率 > 80%、tsc / eslint 零问题、零功能回退。

## 7. 范围与计划拆分建议

本特性较大，建议实现计划拆为两个可独立验证的子计划：

- **Plan A — 后端层模型 + scope 切换 + 四页接入**：claude_settings/config.rs 扩展、gitignore helper、`read_config_layer`、写入分流、`useAppStore` scope、`ScopeSwitcher`、`useConfig` 重构、四页接入顶部切换 + 无项目守卫 + 来源 pill。产出：四页可在全局/项目间切换并正确分流敏感信息。
- **Plan B — env 目录化**：`env-catalog.ts`、`EnvVarCombobox`、`EnvValueInput`、环境变量页新增表单重构、槽位置灰行。依赖 Plan A 的 scope 基础设施。

两个子计划都以视觉伴侣验收为 UI 任务的完成关卡。

## 附录 A：env 变量目录数据来源

清单取自 Claude Code 官方文档（抓取于 2026-06-14）：
- https://code.claude.com/docs/en/env-vars
- https://code.claude.com/docs/en/amazon-bedrock
- https://code.claude.com/docs/en/google-vertex-ai
- https://code.claude.com/docs/en/monitoring-usage
- https://code.claude.com/docs/en/network-config

约 150 个变量，分 17 组，含类型 / 描述 / 默认值 / 敏感标记。完整明细在实现 Plan B 时落入 `env-catalog.ts`。已知要点：
- 凭证类（敏感=true）：ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_CUSTOM_HEADERS / AWS_* 密钥 / GOOGLE_APPLICATION_CREDENTIALS / ANTHROPIC_FOUNDRY_API_KEY / AWS_BEARER_TOKEN_BEDROCK / OTEL_EXPORTER_OTLP_HEADERS / mTLS 私钥类 / HTTP(S)_PROXY（可能含 user:pass）等。
- 槽位托管（slotManaged=true，目录置灰）：ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL / ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL。
- 不入目录：CLAUDECODE / CLAUDE_CODE_CHILD_SESSION（只读标识）。
- 文档不一致点：CLAUDE_CODE_MAX_RETRIES 默认值 env-vars 页写 3、monitoring 页写 10，tooltip 取 3 并注明。
