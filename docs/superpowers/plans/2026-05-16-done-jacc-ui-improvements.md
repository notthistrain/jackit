# jacc UI/UX 改进与国际化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 对 jacc 应用进行 Skills tab 切换、模型"绑定"概念重构、国际化三方面改进。

**架构：** 后端增加 context_size 字段并重命名 activate→bind 命令；前端搭建 i18n 基础设施（React Context + JSON 语言包），重构 Skills 页面为 tab 切换 + 乐观更新，重构 Models 页面术语，改造 General 页面模型行。

**技术栈：** Tauri 2 / Rust + sqlx / React 19 / TypeScript / Zustand / Tailwind CSS 4

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/i18n/index.tsx` | LocaleProvider + useT() hook |
| `src/i18n/locales/zh.json` | 中文翻译 |
| `src/i18n/locales/en.json` | 英文翻译 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src-tauri/src/db.rs` | 迁移：models 表加 context_size 列 |
| `src-tauri/src/commands/models.rs` | Model/ModelView/CreateModelInput/UpdateModelInput 加 context_size；activate_model → bind_model；test_model 返回错误码 |
| `src-tauri/src/lib.rs` | 注册 bind_model 命令（替换 activate_model） |
| `src/hooks/useModels.ts` | Model 接口加 context_size；activate → bind 重命名 |
| `src/hooks/useSkills.ts` | toggle 改为乐观更新，不再全量 refresh |
| `src/components/SkillList.tsx` | 增加 tab 切换（已启用/已禁用），移除全量刷新 |
| `src/pages/Models.tsx` | 术语"激活"→"绑定"，使用 t() |
| `src/pages/General.tsx` | 模型行改造（槽位下拉 + 绑定信息）+ 语言切换项 |
| `src/components/dialogs/AddModelDialog.tsx` | 增加 context_size 输入框 |
| `src/components/Sidebar.tsx` | 所有标签改用 t() |
| `src/components/TitleBar.tsx` | 标题改用 t() |
| `src/main.tsx` | 包裹 LocaleProvider |
| `src/App.tsx` | 加载 locale 偏好 |

---

## 任务 1：数据库迁移 — models 表加 context_size

**文件：**
- 修改：`packages/jacc/src-tauri/src/db.rs`

- [ ] **步骤 1：在 migrate 函数末尾添加 ALTER TABLE**

在 `db.rs` 的 `migrate` 函数末尾（`preferences` 表创建之后）追加：

```rust
    // 迁移：添加 context_size 字段
    sqlx::query(
        "ALTER TABLE models ADD COLUMN context_size TEXT DEFAULT NULL",
    )
    .execute(pool)
    .await
    .ok(); // 忽略 "duplicate column" 错误（已迁移过的数据库）
```

- [ ] **步骤 2：验证编译**

运行：`cd packages/jacc/src-tauri && cargo check`
预期：编译通过，无错误

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src-tauri/src/db.rs
git commit -m "feat(jacc): models 表添加 context_size 字段"
```

---

## 任务 2：后端重构 — activate→bind + context_size

**文件：**
- 修改：`packages/jacc/src-tauri/src/commands/models.rs`
- 修改：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：更新 Model 结构体**

在 `commands/models.rs` 中，`Model` 结构体的 `slot` 字段后添加：

```rust
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Model {
    pub id: i64,
    pub alias: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
    pub slot: Option<String>,
    pub context_size: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
```

- [ ] **步骤 2：更新 ModelView 结构体**

```rust
#[derive(Debug, Serialize)]
pub struct ModelView {
    pub id: i64,
    pub alias: String,
    pub base_url: String,
    pub api_key_masked: String,
    pub model_name: String,
    pub slot: Option<String>,
    pub context_size: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
```

更新 `From<&Model> for ModelView` 实现，添加：
```rust
context_size: m.context_size.clone(),
```

- [ ] **步骤 3：更新 CreateModelInput 和 UpdateModelInput**

```rust
#[derive(Debug, Deserialize)]
pub struct CreateModelInput {
    pub alias: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
    pub slot: Option<String>,
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
```

- [ ] **步骤 4：更新 add_model SQL**

```rust
#[tauri::command]
pub async fn add_model(pool: State<'_, SqlitePool>, input: CreateModelInput) -> AppResult<Model> {
    let id = sqlx::query(
        "INSERT INTO models (alias, base_url, api_key, model_name, slot, context_size) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&input.alias)
    .bind(&input.base_url)
    .bind(&input.api_key)
    .bind(&input.model_name)
    .bind(&input.slot)
    .bind(&input.context_size)
    .execute(pool.inner())
    .await?
    .last_insert_rowid();

    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;
    Ok(model)
}
```

- [ ] **步骤 5：更新 update_model 添加 context_size 支持**

在 `update_model` 函数中，`model_name` 处理之后添加：

```rust
    if let Some(ref context_size) = input.context_size {
        query.push_str(", context_size = ?");
        binds.push(context_size.clone());
    }
```

- [ ] **步骤 6：重命名 activate_model 为 bind_model**

将函数签名和注释改为：

```rust
#[tauri::command]
pub async fn bind_model(pool: State<'_, SqlitePool>, id: i64, slot: String) -> AppResult<()> {
    // 清除该槽位的旧绑定
    sqlx::query("UPDATE models SET slot = NULL WHERE slot = ?")
        .bind(&slot)
        .execute(pool.inner())
        .await?;

    // 绑定新模型到该槽位
    sqlx::query("UPDATE models SET slot = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(&slot)
        .bind(id)
        .execute(pool.inner())
        .await?;

    // 读取模型信息，写入 settings.json 环境变量
    let model = sqlx::query_as::<_, Model>("SELECT * FROM models WHERE id = ?")
        .bind(id)
        .fetch_one(pool.inner())
        .await?;

    write_model_to_settings(&model)?;
    Ok(())
}
```

- [ ] **步骤 7：更新 test_model 返回错误码**

将 `test_model` 中的中文字符串改为错误码：

```rust
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
```

- [ ] **步骤 8：更新 lib.rs 命令注册**

在 `src-tauri/src/lib.rs` 中，将 `activate_model` 替换为 `bind_model`：

找到 `.invoke_handler(tauri::generate_handler![...])` 中的 `commands::models::activate_model`，替换为 `commands::models::bind_model`。

- [ ] **步骤 9：验证编译**

运行：`cd packages/jacc/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 10：Commit**

```bash
git add packages/jacc/src-tauri/src/commands/models.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): activate→bind 重命名，添加 context_size 支持，错误码化"
```

---

## 任务 3：i18n 基础设施

**文件：**
- 创建：`packages/jacc/src/i18n/index.tsx`
- 创建：`packages/jacc/src/i18n/locales/zh.json`
- 创建：`packages/jacc/src/i18n/locales/en.json`
- 修改：`packages/jacc/src/main.tsx`
- 修改：`packages/jacc/src/App.tsx`

- [ ] **步骤 1：创建 i18n/index.tsx**

```tsx
/// <reference types="vite/client" />
import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

const localeModules = import.meta.glob<Record<string, string>>(
  './locales/*.json',
  { eager: true },
)

const messages: Record<string, Record<string, string>> = {}
for (const [path, mod] of Object.entries(localeModules)) {
  const locale = path.match(/\/([^/]+)\.json$/)?.[1] ?? ''
  if (locale) messages[locale] = (mod as any).default ?? mod
}

export type Locale = 'zh' | 'en'

const STORAGE_KEY = 'jacc:locale'
const DEFAULT_LOCALE: Locale = 'zh'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'zh' || saved === 'en') return saved
      return DEFAULT_LOCALE
    } catch {
      return DEFAULT_LOCALE
    }
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    } catch {
      // localStorage unavailable
    }
  }, [])

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    let text = messages[locale]?.[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, v)
      }
    }
    return text
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used within LocaleProvider')
  return ctx
}
```

- [ ] **步骤 2：创建 zh.json**

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
  "general.model": "模型",
  "general.model.desc": "当前绑定的模型，在「模型库」中管理",
  "general.model.unbound": "未绑定",
  "general.model.manage": "管理",
  "general.effortLevel": "Effort Level",
  "general.effortLevel.desc": "推理努力程度",
  "general.skipDangerous": "跳过危险模式确认",
  "general.skipDangerous.desc": "启用后不再弹出危险操作确认提示",
  "general.language": "语言",
  "general.language.desc": "界面显示语言",
  "models.title": "模型库",
  "models.slot.label": "当前槽位",
  "models.currentBound": "当前绑定",
  "models.bound": "已绑定",
  "models.unbound": "当前槽位未绑定模型",
  "models.bind": "绑定到 {slot}",
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
  "models.dialog.slot": "默认槽位",
  "models.dialog.slotNone": "不绑定",
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
  "common.notSet": "未设置"
}
```

- [ ] **步骤 3：创建 en.json**

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
  "general.model": "Model",
  "general.model.desc": "Currently bound model, manage in Models",
  "general.model.unbound": "Unbound",
  "general.model.manage": "Manage",
  "general.effortLevel": "Effort Level",
  "general.effortLevel.desc": "Reasoning effort level",
  "general.skipDangerous": "Skip Dangerous Mode Prompt",
  "general.skipDangerous.desc": "Skip confirmation for dangerous operations",
  "general.language": "Language",
  "general.language.desc": "Interface language",
  "models.title": "Models",
  "models.slot.label": "Current Slot",
  "models.currentBound": "Currently Bound",
  "models.bound": "Bound",
  "models.unbound": "No model bound to this slot",
  "models.bind": "Bind to {slot}",
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
  "models.dialog.slot": "Default Slot",
  "models.dialog.slotNone": "None",
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
  "common.notSet": "Not set"
}
```

- [ ] **步骤 4：修改 main.tsx 包裹 LocaleProvider**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from './i18n'
import App from './App'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
```

- [ ] **步骤 5：修改 App.tsx 加载 locale 偏好**

在 App.tsx 中，从 preferences 加载保存的 locale 并同步到 i18n：

```tsx
import { useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { useAppStore } from '@/stores/useAppStore'
import { usePreferences } from '@/hooks/usePreferences'
import { useT } from '@/i18n'

export default function App() {
  const { theme, setTheme } = useAppStore()
  const { get } = usePreferences()
  const { setLocale } = useT()

  useEffect(() => {
    get('theme').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setTheme(saved)
      }
    })
    get('locale').then((saved) => {
      if (saved === 'zh' || saved === 'en') {
        setLocale(saved)
      }
    })
  }, [get, setTheme, setLocale])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  return <Layout />
}
```

- [ ] **步骤 6：验证编译**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 7：Commit**

```bash
git add packages/jacc/src/i18n/ packages/jacc/src/main.tsx packages/jacc/src/App.tsx
git commit -m "feat(jacc): 搭建 i18n 基础设施（LocaleProvider + 中英语言包）"
```

---

## 任务 4：Skills 页面 — Tab 切换 + 乐观更新

**文件：**
- 修改：`packages/jacc/src/hooks/useSkills.ts`
- 修改：`packages/jacc/src/components/SkillList.tsx`

- [ ] **步骤 1：重构 useSkills hook — 乐观更新**

将 `toggle` 函数改为乐观更新模式，不再调用 `refresh()`：

```tsx
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'

export interface SkillInfo {
  name: string
  description: string
  enabled: boolean
  source: string
}

interface GithubInstallResult {
  temp_dir: string
  skills: SkillInfo[]
}

export function useSkills() {
  const { currentProject } = useAppStore()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!currentProject) return
    setLoading(true)
    try {
      const list = await invoke<SkillInfo[]>('list_skills', { projectPath: currentProject })
      setSkills(list)
    } finally {
      setLoading(false)
    }
  }, [currentProject])

  const toggle = useCallback(
    async (name: string, enabled: boolean) => {
      if (!currentProject) return

      // 乐观更新：立即修改本地状态
      setSkills((prev) =>
        prev.map((s) => (s.name === name ? { ...s, enabled } : s)),
      )

      try {
        await invoke('toggle_skill', { projectPath: currentProject, name, enabled })
      } catch {
        // 失败回滚
        setSkills((prev) =>
          prev.map((s) => (s.name === name ? { ...s, enabled: !enabled } : s)),
        )
      }
    },
    [currentProject],
  )

  const importSkill = useCallback(
    async (sourcePath: string) => {
      if (!currentProject) return
      await invoke('import_skill', { projectPath: currentProject, sourcePath })
      await refresh()
    },
    [currentProject, refresh],
  )

  const installFromGithub = useCallback(
    async (repoUrl: string): Promise<GithubInstallResult> => {
      if (!currentProject) return { temp_dir: '', skills: [] }
      return invoke<GithubInstallResult>('install_skill_from_github', {
        projectPath: currentProject,
        repoUrl,
      })
    },
    [currentProject],
  )

  const confirmInstall = useCallback(
    async (tempDir: string, skillNames: string[]) => {
      if (!currentProject) return
      await invoke('confirm_install_skill', {
        projectPath: currentProject,
        tempDir,
        skillNames,
      })
      await refresh()
    },
    [currentProject, refresh],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { skills, loading, refresh, toggle, importSkill, installFromGithub, confirmInstall }
}
```

- [ ] **步骤 2：重构 SkillList 组件 — 添加 Tab 切换**

完整替换 `SkillList.tsx`：

```tsx
import { open } from '@tauri-apps/plugin-dialog'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { InstallSkillDialog } from '@/components/dialogs/InstallSkillDialog'
import type { SkillInfo } from '@/hooks/useSkills'
import { SourceBadge } from '@/components/SourceBadge'
import { Fab } from '@/components/Fab'
import { useT } from '@/i18n'

type Tab = 'enabled' | 'disabled'

interface SkillListProps {
  title: string
  skills: SkillInfo[]
  loading: boolean
  onToggle: (name: string, enabled: boolean) => Promise<void>
  onImport: (sourcePath: string) => Promise<void>
  onInstallFromGithub: (repoUrl: string) => Promise<{ temp_dir: string; skills: SkillInfo[] }>
  onConfirmInstall: (tempDir: string, skillNames: string[]) => Promise<void>
}

export function SkillList({
  skills,
  loading,
  onToggle,
  onImport,
  onInstallFromGithub,
  onConfirmInstall,
}: SkillListProps) {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('enabled')
  const [search, setSearch] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const enabledSkills = skills.filter((s) => s.enabled)
  const disabledSkills = skills.filter((s) => !s.enabled)

  const currentList = tab === 'enabled' ? enabledSkills : disabledSkills
  const filtered = currentList.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleToggle(name: string, enabled: boolean) {
    setToggling(name)
    try {
      await onToggle(name, enabled)
    } finally {
      setToggling(null)
    }
  }

  async function handleImport() {
    const selected = await open({ directory: true })
    if (selected) {
      await onImport(selected)
    }
    setShowMenu(false)
  }

  if (loading) {
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>
  }

  return (
    <div className="p-6 pb-20">
      {/* Tab 栏 */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setTab('enabled')}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
            tab === 'enabled'
              ? 'text-foreground border-primary'
              : 'text-muted border-transparent hover:text-foreground'
          }`}
        >
          {t('skills.tab.enabled')} ({enabledSkills.length})
        </button>
        <button
          onClick={() => setTab('disabled')}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
            tab === 'disabled'
              ? 'text-foreground border-primary'
              : 'text-muted border-transparent hover:text-foreground'
          }`}
        >
          {t('skills.tab.disabled')} ({disabledSkills.length})
        </button>
        <div className="flex-1" />
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('skills.search')}
            className="bg-card border border-border pl-7 pr-3 py-1.5 rounded-[4px] text-xs text-foreground w-[160px]"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex flex-col gap-1.5">
        {filtered.map((skill) => (
          <div
            key={skill.name}
            className="flex items-center justify-between px-3.5 py-2.5 bg-card border border-border-light rounded-[4px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 bg-success-light rounded-[4px] flex items-center justify-center text-base shrink-0">
                {'\u{1F9E9}'}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">{skill.name}</div>
                <div className="text-[11px] text-muted truncate max-w-[300px]">{skill.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SourceBadge scope={skill.source as 'project' | 'user' | 'plugin'} />
              {skill.source === 'user' ? (
                <span className="text-[10px] text-muted">{t('skills.readonly')}</span>
              ) : (
                <button
                  onClick={() => handleToggle(skill.name, !skill.enabled)}
                  disabled={toggling === skill.name}
                  className={`w-9 h-5 rounded-full relative transition-colors ${
                    skill.enabled ? 'bg-success' : 'bg-border'
                  } ${toggling === skill.name ? 'opacity-50' : ''}`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      skill.enabled ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showMenu && (
        <div className="fixed bottom-20 right-6 bg-card border border-border rounded-[4px] shadow-lg py-1 min-w-[140px] z-40">
          <button
            onClick={handleImport}
            className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-sidebar"
          >
            {t('skills.importLocal')}
          </button>
          <button
            onClick={() => { setShowInstall(true); setShowMenu(false) }}
            className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-sidebar"
          >
            {t('skills.installGithub')}
          </button>
        </div>
      )}
      <Fab onClick={() => setShowMenu(!showMenu)} />

      <InstallSkillDialog
        open={showInstall}
        onClose={() => setShowInstall(false)}
        onFetch={onInstallFromGithub}
        onConfirm={onConfirmInstall}
      />
    </div>
  )
}
```

- [ ] **步骤 3：验证编译**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src/hooks/useSkills.ts packages/jacc/src/components/SkillList.tsx
git commit -m "feat(jacc): Skills 页面 tab 切换 + 乐观更新"
```

---

## 任务 5：Models 页面 — 术语重构 + context_size

**文件：**
- 修改：`packages/jacc/src/hooks/useModels.ts`
- 修改：`packages/jacc/src/pages/Models.tsx`
- 修改：`packages/jacc/src/components/dialogs/AddModelDialog.tsx`

- [ ] **步骤 1：更新 useModels hook**

```tsx
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface Model {
  id: number
  alias: string
  base_url: string
  api_key_masked: string
  model_name: string
  slot: string | null
  context_size: string | null
  created_at: string
  updated_at: string
}

export interface CreateModelInput {
  alias: string
  base_url: string
  api_key: string
  model_name: string
  slot: string | null
  context_size: string | null
}

export interface UpdateModelInput {
  alias?: string
  base_url?: string
  api_key?: string
  model_name?: string
  context_size?: string
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

  const bind = useCallback(async (id: number, slot: string) => {
    await invoke('bind_model', { id, slot })
    await refresh()
  }, [refresh])

  const test = useCallback(async (id: number): Promise<string> => {
    return invoke<string>('test_model', { id })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { models, loading, refresh, add, update, remove, bind, test }
}
```

- [ ] **步骤 2：更新 Models.tsx — 术语 + i18n**

完整替换 `Models.tsx`：

```tsx
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Fab } from '@/components/Fab'
import { AddModelDialog } from '@/components/dialogs/AddModelDialog'
import { useModels, type Model } from '@/hooks/useModels'
import { useT } from '@/i18n'

type Slot = 'opus' | 'sonnet' | 'haiku'

export function Models() {
  const { t } = useT()
  const { models, add, bind, test, remove, update } = useModels()
  const [currentSlot, setCurrentSlot] = useState<Slot>('opus')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Model | null>(null)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null)
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

  const boundModel = models.find((m) => m.slot === currentSlot)

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
      {/* 标题 + 槽位切换 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-foreground">{t('models.title')}</h2>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground">{t('models.slot.label')}:</span>
          <select
            value={currentSlot}
            onChange={(e) => setCurrentSlot(e.target.value as Slot)}
            className="bg-card border border-border px-3 py-1.5 rounded-[4px] text-xs font-medium text-foreground"
          >
            <option value="opus">Opus</option>
            <option value="sonnet">Sonnet</option>
            <option value="haiku">Haiku</option>
          </select>
        </div>
      </div>

      {/* 当前绑定模型 */}
      {boundModel && (
        <div className="flex items-center justify-between px-4 py-3 bg-primary-light border border-primary/30 rounded-[4px] mb-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
            <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground">{boundModel.alias}</div>
              <div className="text-[11px] text-muted truncate">
                {boundModel.base_url} · {boundModel.model_name}
                {boundModel.context_size && ` · ${boundModel.context_size}`}
              </div>
              {testResult?.id === boundModel.id && (
                <div className={`text-[10px] mt-1 truncate ${testResult.ok ? 'text-success' : 'text-danger'}`} title={testResult.msg}>
                  {testResult.msg}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleTest(boundModel.id)}
              disabled={testing === boundModel.id}
              className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar disabled:opacity-50"
            >
              {testing === boundModel.id ? '...' : t('models.test')}
            </button>
            <button
              onClick={() => setEditing(boundModel)}
              className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar"
            >
              {t('models.edit')}
            </button>
            <span className="text-[11px] px-2.5 py-1 bg-primary text-white rounded-[12px] ml-1">{t('models.bound')}</span>
          </div>
        </div>
      )}

      {!boundModel && (
        <div className="px-4 py-3 bg-sidebar border border-border-light rounded-[4px] mb-4 text-xs text-muted text-center">
          {t('models.unbound')}
        </div>
      )}

      {/* 模型列表 */}
      <div className="flex flex-col gap-2">
        {models
          .filter((m) => m.slot !== currentSlot)
          .map((model) => (
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
                  onClick={() => bind(model.id, currentSlot)}
                  className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar cursor-pointer"
                >
                  {t('models.bind', { slot: currentSlot })}
                </button>
                <button
                  onClick={() => handleTest(model.id)}
                  disabled={testing === model.id}
                  className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar disabled:opacity-50 cursor-pointer"
                >
                  {testing === model.id ? '...' : t('models.test')}
                </button>
                <div className="relative">
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
              context_size: input.context_size || undefined,
            })
          }
        }}
        initialValues={editing ? {
          alias: editing.alias,
          base_url: editing.base_url,
          api_key: '',
          model_name: editing.model_name,
          slot: editing.slot || '',
          context_size: editing.context_size || '',
        } : undefined}
      />
    </div>
  )
}
```

- [ ] **步骤 3：更新 AddModelDialog — 增加 context_size 字段**

在 `AddModelDialog.tsx` 中：

1. 更新 `initialValues` 接口添加 `context_size: string`
2. 添加 `contextSize` state
3. 在 `useEffect` 中加载/重置 `contextSize`
4. 在 `handleSubmit` 中传递 `context_size: contextSize || null`
5. 在"模型名称"输入框之后、"默认槽位"之前添加上下文容量输入框
6. 所有中文标签改用 `t()` 调用

完整替换：

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
    slot: string
    context_size: string
  }
}

export function AddModelDialog({ open, onClose, onSubmit, initialValues }: AddModelDialogProps) {
  const { t } = useT()
  const [alias, setAlias] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [slot, setSlot] = useState<string>('')
  const [contextSize, setContextSize] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && initialValues) {
      setAlias(initialValues.alias)
      setBaseUrl(initialValues.base_url)
      setApiKey(initialValues.api_key)
      setModelName(initialValues.model_name)
      setSlot(initialValues.slot)
      setContextSize(initialValues.context_size)
    } else if (!open) {
      setAlias('')
      setBaseUrl('')
      setApiKey('')
      setModelName('')
      setSlot('')
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
        slot: slot || null,
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
          <div>
            <div className="text-[11px] text-muted mb-1">{t('models.dialog.slot')}</div>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            >
              <option value="">{t('models.dialog.slotNone')}</option>
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
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

- [ ] **步骤 4：验证编译**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/hooks/useModels.ts packages/jacc/src/pages/Models.tsx packages/jacc/src/components/dialogs/AddModelDialog.tsx
git commit -m "feat(jacc): 模型页面术语重构（激活→绑定）+ context_size 支持"
```

---

## 任务 6：General 页面改造 + 语言切换

**文件：**
- 修改：`packages/jacc/src/pages/General.tsx`

- [ ] **步骤 1：完整替换 General.tsx**

```tsx
import { useState } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { useModels } from '@/hooks/useModels'
import { useAppStore } from '@/stores/useAppStore'
import { usePreferences } from '@/hooks/usePreferences'
import { SourceBadge } from '@/components/SourceBadge'
import { useT, type Locale } from '@/i18n'

type Slot = 'opus' | 'sonnet' | 'haiku'

export function General() {
  const { t, locale, setLocale } = useT()
  const { config, loading, writeConfig } = useConfig()
  const { models } = useModels()
  const { setPage } = useAppStore()
  const { set: setPreference } = usePreferences()
  const [viewSlot, setViewSlot] = useState<Slot>('opus')

  if (loading || !config) {
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>
  }

  const getItem = (key: string) => config.items.find((i) => i.key === key)

  const effortLevel = getItem('effortLevel')
  const skipDangerous = getItem('skipDangerousModePermissionPrompt')

  const boundModel = models.find((m) => m.slot === viewSlot)

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale)
    setPreference('locale', newLocale)
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-5">{t('general.title')}</h2>

      <div className="flex flex-col gap-2.5">
        {/* 模型 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.model')}</div>
            <div className="text-[11px] text-muted">{t('general.model.desc')}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={viewSlot}
              onChange={(e) => setViewSlot(e.target.value as Slot)}
              className="bg-sidebar border border-border text-foreground px-2 py-1 rounded-[2px] text-xs"
            >
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
            <span className="text-xs text-foreground bg-sidebar px-2.5 py-1 rounded-[2px] border border-border max-w-[160px] truncate">
              {boundModel
                ? `${boundModel.alias}${boundModel.context_size ? ` · ${boundModel.context_size}` : ''}`
                : t('general.model.unbound')}
            </span>
            <button
              onClick={() => setPage('models')}
              className="text-[11px] text-primary hover:underline"
            >
              {t('general.model.manage')}
            </button>
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

- [ ] **步骤 2：验证编译**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：Commit**

```bash
git add packages/jacc/src/pages/General.tsx
git commit -m "feat(jacc): General 页面改造（槽位下拉 + 语言切换）"
```

---

## 任务 7：Sidebar + TitleBar 国际化

**文件：**
- 修改：`packages/jacc/src/components/Sidebar.tsx`
- 修改：`packages/jacc/src/components/TitleBar.tsx`

- [ ] **步骤 1：更新 Sidebar.tsx**

```tsx
import {
  Bot,
  Key,
  Plug,
  Puzzle,
  Settings,
  Shield,
  Brain,
  Moon,
  Sun,
} from 'lucide-react'
import { useAppStore, type Page } from '@/stores/useAppStore'
import { usePreferences } from '@/hooks/usePreferences'
import { ProjectSwitcher } from './ProjectSwitcher'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

interface NavItem {
  id: Page
  labelKey: string
  icon: React.ReactNode
}

const settingsNav: NavItem[] = [
  { id: 'general', labelKey: 'sidebar.general', icon: <Settings size={14} /> },
  { id: 'envvars', labelKey: 'sidebar.envvars', icon: <Key size={14} /> },
  { id: 'permissions', labelKey: 'sidebar.permissions', icon: <Shield size={14} /> },
  { id: 'mcp', labelKey: 'sidebar.mcp', icon: <Plug size={14} /> },
  { id: 'models', labelKey: 'sidebar.models', icon: <Brain size={14} /> },
]

const extensionsNav: NavItem[] = [
  { id: 'skills', labelKey: 'sidebar.skills', icon: <Puzzle size={14} /> },
  { id: 'agents', labelKey: 'sidebar.agents', icon: <Bot size={14} /> },
]

export function Sidebar() {
  const { t } = useT()
  const { currentPage, setPage, theme, setTheme } = useAppStore()
  const { set: setPreference } = usePreferences()

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
    setPreference('theme', next)
  }

  const themeLabel = theme === 'system'
    ? t('sidebar.theme.system')
    : theme === 'light'
      ? t('sidebar.theme.light')
      : t('sidebar.theme.dark')

  return (
    <div className="w-[180px] bg-sidebar border-r border-border flex flex-col h-full">
      <ProjectSwitcher />

      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wider">{t('sidebar.config')}</div>
        {settingsNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={cn(
              'w-full text-left px-4 py-[7px] mx-2 text-xs flex items-center gap-2 rounded-[4px] cursor-pointer',
              currentPage === item.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}
            style={{ width: 'calc(100% - 16px)' }}
          >
            {item.icon}
            {t(item.labelKey)}
          </button>
        ))}

        <div className="px-3 py-1 mt-3 text-[10px] text-muted uppercase tracking-wider">{t('sidebar.extensions')}</div>
        {extensionsNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={cn(
              'w-full text-left px-4 py-[7px] mx-2 text-xs flex items-center gap-2 rounded-[4px] cursor-pointer',
              currentPage === item.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}
            style={{ width: 'calc(100% - 16px)' }}
          >
            {item.icon}
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted">
        <button onClick={toggleTheme} className="cursor-pointer hover:text-foreground flex items-center gap-1">
          {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          <span>{themeLabel}</span>
        </button>
        <span>v0.1.0</span>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：更新 TitleBar.tsx**

```tsx
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X } from 'lucide-react'
import { useT } from '@/i18n'

export function TitleBar() {
  const appWindow = getCurrentWindow()
  const { t } = useT()

  return (
    <div className="h-8 flex items-center bg-sidebar border-b border-border select-none">
      <div className="pl-3 text-xs text-muted" data-tauri-drag-region>
        {t('app.title')}
      </div>
      <div data-tauri-drag-region className="flex-1 h-full" />
      <div className="flex h-full">
        <button
          onClick={() => appWindow.minimize()}
          className="w-11 h-full flex items-center justify-center hover:bg-border/50 text-muted-foreground"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="w-11 h-full flex items-center justify-center hover:bg-border/50 text-muted-foreground"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="w-11 h-full flex items-center justify-center hover:bg-danger/80 hover:text-white text-muted-foreground"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：验证编译**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src/components/Sidebar.tsx packages/jacc/src/components/TitleBar.tsx
git commit -m "feat(jacc): Sidebar + TitleBar 国际化"
```

---

## 任务 8：剩余页面国际化 + InstallSkillDialog

**文件：**
- 修改：`packages/jacc/src/pages/Agents.tsx`
- 修改：`packages/jacc/src/components/dialogs/InstallSkillDialog.tsx`

- [ ] **步骤 1：更新 Agents.tsx**

在 Agents 页面中使用 `t()`：

```tsx
import { useT } from '@/i18n'

export function Agents() {
  const { t } = useT()

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('agents.title')}</h2>
      <div className="flex flex-col items-center justify-center py-16 text-muted">
        <div className="text-sm">{t('agents.developing')}</div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：更新 InstallSkillDialog.tsx**

在 InstallSkillDialog 中使用 `t()`：

```tsx
import { useState } from 'react'
import type { SkillInfo } from '@/hooks/useSkills'
import { useT } from '@/i18n'

interface GithubInstallResult {
  temp_dir: string
  skills: SkillInfo[]
}

interface InstallSkillDialogProps {
  open: boolean
  onClose: () => void
  onFetch: (repoUrl: string) => Promise<GithubInstallResult>
  onConfirm: (tempDir: string, skillNames: string[]) => Promise<void>
}

export function InstallSkillDialog({ open, onClose, onFetch, onConfirm }: InstallSkillDialogProps) {
  const { t } = useT()
  const [repoUrl, setRepoUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [available, setAvailable] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState(false)
  const [tempDir, setTempDir] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  async function handleFetch() {
    if (!repoUrl.trim()) return
    setFetching(true)
    setAvailable([])
    setSelected(new Set())
    setError('')
    try {
      const result = await onFetch(repoUrl)
      setTempDir(result.temp_dir)
      setAvailable(result.skills)
      if (result.skills.length === 0) {
        setError(t('skills.install.noSkills'))
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setFetching(false)
    }
  }

  function toggleSkill(name: string) {
    const next = new Set(selected)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    setSelected(next)
  }

  async function handleInstall() {
    if (selected.size === 0 || !tempDir) return
    setInstalling(true)
    try {
      await onConfirm(tempDir, Array.from(selected))
      onClose()
      setRepoUrl('')
      setAvailable([])
      setSelected(new Set())
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[420px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-4">{t('skills.install.title')}</h3>

        <div className="mb-4">
          <div className="text-[11px] text-muted mb-1">{t('skills.install.repoLabel')}</div>
          <div className="flex gap-2">
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder={t('skills.install.repoPlaceholder')}
              className="flex-1 bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
            <button
              onClick={handleFetch}
              disabled={fetching || !repoUrl.trim()}
              className="px-3 py-2 bg-primary text-white text-[11px] rounded-[4px] disabled:opacity-50 whitespace-nowrap"
            >
              {fetching ? t('skills.install.fetching') : t('skills.install.fetch')}
            </button>
          </div>
        </div>

        {fetching && (
          <div className="mb-4 px-3.5 py-2.5 bg-sidebar border border-border-light rounded-[4px] text-[11px] text-muted">
            {t('skills.install.cloning')}
          </div>
        )}

        {error && (
          <div className="mb-4 px-3.5 py-2.5 bg-danger-light border border-danger/30 rounded-[4px] text-[11px] text-danger">
            {error}
          </div>
        )}

        {available.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] text-muted mb-2">{t('skills.install.selectLabel')}</div>
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
              {available.map((skill) => (
                <label
                  key={skill.name}
                  className={`flex items-center gap-2 px-3 py-2 rounded-[4px] cursor-pointer border ${
                    selected.has(skill.name)
                      ? 'bg-success-light border-success/30'
                      : 'bg-sidebar border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(skill.name)}
                    onChange={() => toggleSkill(skill.name)}
                    className="accent-success"
                  />
                  <div>
                    <div className="text-xs font-medium text-foreground">{skill.name}</div>
                    <div className="text-[10px] text-muted">{skill.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px]"
          >
            {t('skills.install.cancel')}
          </button>
          {available.length > 0 && (
            <button
              onClick={handleInstall}
              disabled={installing || selected.size === 0}
              className="px-4 py-2 bg-success text-white text-xs rounded-[4px] disabled:opacity-50"
            >
              {installing ? t('skills.install.installing') : t('skills.install.install', { count: String(selected.size) })}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：验证编译**

运行：`cd packages/jacc && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/src/pages/Agents.tsx packages/jacc/src/components/dialogs/InstallSkillDialog.tsx
git commit -m "feat(jacc): Agents + InstallSkillDialog 国际化"
```

---

## 任务 9：最终验证

- [ ] **步骤 1：完整编译检查**

运行：`cd packages/jacc/src-tauri && cargo check`
预期：Rust 编译通过

运行：`cd packages/jacc && npx tsc --noEmit`
预期：TypeScript 编译通过

- [ ] **步骤 2：启动 dev 验证**

运行：`cd packages/jacc && npm run tauri dev`
预期：应用正常启动，无控制台错误

验证点：
1. Skills 页面有「已启用」「已禁用」两个 tab，切换正常
2. toggle skill 后不刷新列表，skill 从当前 tab 消失
3. Models 页面按钮文案为"绑定到 opus/sonnet/haiku"
4. General 页面有槽位下拉 + 绑定信息展示
5. General 页面有语言切换，切换后所有文案变为英文
6. 添加模型对话框有"上下文容量"输入框

- [ ] **步骤 3：Commit（如有修复）**

如果验证中发现问题并修复，提交修复 commit。
