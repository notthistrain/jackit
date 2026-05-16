# jacc — Claude Code 配置管理 GUI 设计文档

## 概述

jacc (Jack's Claude Config) 是一个基于 Tauri 的桌面应用，用于通过 GUI 灵活管理 Claude Code 的配置文件。作为 jackit monorepo 中的新子包，复用项目现有的技术栈和开发模式。

## 目标

- 以表单化 UI 管理 Claude Code 的 settings.json 配置
- 合并视图展示全局/项目配置，清晰标注来源和生效层级
- 管理模型库，支持多模型配置和一键切换
- 管理 Skills/Agents 的安装、启用/禁用

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 | 与 JackCom 一致 |
| 构建工具 | Vite 6 | 多页面应用 |
| 样式 | Tailwind CSS | 原子化 CSS |
| 图标 | Lucide React | 与 JackCom 一致 |
| 桌面框架 | Tauri 2.x | 跨平台桌面应用 |
| 后端语言 | Rust | Tauri 命令 |
| 数据库 | SQLite (sqlx) | 本地持久化 |
| 状态管理 | Zustand | 与 JackCom 一致 |

## 数据存储

### 目录规范

统一所有 jackit 应用的数据目录到 `~/.jackit/`：

```
~/.jackit/
├── toolbox/
│   ├── data/
│   │   └── toolbox.db
│   ├── config/
│   │   └── toolbox.yaml
│   ├── log/
│   └── tools/
│       ├── jackcom/
│       │   ├── jackcom.exe
│       │   ├── data/
│       │   │   └── jackcom.db
│       │   ├── config/
│       │   └── log/
│       └── jacc/
│           ├── jacc.exe
│           ├── data/
│           │   └── jacc.db
│           ├── config/
│           └── log/
```

每个 app 统一子目录规范：
- `data/` — 数据库文件
- `config/` — 配置文件
- `log/` — 日志文件
- 可执行文件在 app 根目录

### SQLite 数据模型

```sql
-- 模型库
CREATE TABLE models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model_name TEXT NOT NULL,
    slot TEXT,                     -- "opus" | "sonnet" | "haiku" | NULL
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
-- slot 非空表示该模型已激活到对应槽位，每个 slot 最多一条记录激活

-- 项目历史
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    name TEXT,
    last_opened_at TEXT DEFAULT (datetime('now')),
    pinned INTEGER DEFAULT 0
);

-- 用户偏好
CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- 存储: theme, language, window_width, window_height, window_x, window_y 等
```

## 功能模块

### 1. 通用设置 (General)

管理 settings.json 中的基础配置项：
- 模型选择（从模型库中选，显示当前激活的别名）
- Effort Level（下拉：low / medium / high）
- 启用的插件（多选标签）
- 危险模式确认开关
- 每项显示来源标签（全局/项目），可点击切换覆盖层级

### 2. 环境变量 (Env Vars)

管理非模型相关的环境变量：
- 紧凑表格展示：变量名 | 值 | 来源 | 删除
- 模型相关变量（ANTHROPIC_BASE_URL、ANTHROPIC_AUTH_TOKEN 等）显示为只读，标注"由模型库管理"
- 顶部黄色提示条说明模型变量的管理方式
- FAB 按钮添加新变量

### 3. 权限 (Permissions)

管理允许/拒绝规则：
- 紧凑表格展示：类型(Allow/Deny) | 工具(Bash/Read/Write/Edit) | 匹配模式 | 来源 | 删除
- Allow 用绿色标签，Deny 用红色标签
- FAB 按钮添加新规则，弹出表单选择类型/工具/层级/模式

### 4. MCP 服务器 (MCP Servers)

管理 MCP 服务器配置：
- 可折叠/展开的服务器卡片列表
- 折叠状态：状态圆点 + 名称 + 命令摘要 + 来源标签
- 展开状态：编辑 command、args、env（键值对列表）
- FAB 按钮添加新服务器

### 5. 模型库 (Models)

jacc 独有功能，数据存 SQLite：
- 顶部槽位切换下拉框（Opus / Sonnet / Haiku）
- 当前激活模型高亮卡片
- 模型列表，每条有"激活"、"测试"、"更多(⋯)"操作
- FAB 按钮添加新模型
- 激活操作：更新 DB 的 slot 字段 + 写入 settings.json 对应环境变量
- 测试连接：发送简单请求验证 URL + Key 有效性

### 6. Skills 管理

- 列表展示：图标 + 名称 + 描述 + 来源标签(项目/用户/插件) + 启用/禁用开关
- 禁用状态整行降低透明度
- 搜索框实时过滤
- 统计栏：总数 / 已启用 / 已禁用
- FAB 按钮弹出菜单：从本地导入 / 从 GitHub 安装
- 启用/禁用机制：禁用时将 skill 目录移到 `.claude/skills/.disabled/`，启用时移回 `.claude/skills/`

### 7. Agents 管理

与 Skills 管理结构一致。

## UI 设计

### 窗口

- 尺寸：约 800×560，紧凑独立窗口
- 自定义标题栏（与 JackCom 风格一致）
- 窗口位置/大小持久化到 preferences 表

### 布局

- 左侧侧边栏（180px）：项目切换器 + 导航分组 + 底部主题切换/版本号
- 右侧内容区：对应页面内容
- 导航分两组：配置（通用/环境变量/权限/MCP/模型库）+ 扩展（Skills/Agents）

### 主题

支持两套主题，跟随系统或手动切换：
- **浅色模式**：白色背景 (#fafafa)，轻量边框 (#e5e5e5/#e8e8e8)，蓝色高亮 (#1a73e8)
- **深色模式**：GitHub Dark 风格，背景 (#0d1117/#161b22)，边框 (#30363d)，蓝色高亮 (#58a6ff)

### 视觉规范

- 圆角：2-4px（微圆角，消除锐利感但不过度圆润）
- 环境变量/权限：紧凑表格风格，表头 + 行对齐
- 通用设置/MCP：卡片式列表
- Skills/Agents：图标 + 文字列表
- 来源标签：蓝色底 = 项目级，灰色底 = 全局
- 添加操作统一用 FAB（右下角悬浮圆形按钮）

### 项目切换器

- 位于侧边栏顶部
- 显示当前项目名和路径
- 点击展开下拉：最近项目列表（支持置顶）+ "打开其他项目..." 按钮
- 切换后刷新所有配置页面

### 空状态

- 首次启动无历史时显示空状态页面
- 居中图标 + 说明文字 + "选择项目目录" 按钮
- 不主动弹出目录选择器

## Rust 后端命令

```rust
// config — 读写 settings.json
fn read_merged_config(project_path: String) -> MergedConfig;
fn write_config(scope: Scope, project_path: Option<String>, key: String, value: Value);
fn delete_config(scope: Scope, project_path: Option<String>, key: String);

// models — 模型库
fn list_models() -> Vec<Model>;
fn add_model(alias, base_url, api_key, model_name, slot) -> Model;
fn update_model(id, ...);
fn delete_model(id);
fn activate_model(id, slot: String); // 绑定到槽位 + 写入 env
fn test_model(id) -> Result<(), String>;

// skills — 技能/代理管理
fn list_skills(project_path: String) -> Vec<SkillInfo>;
fn toggle_skill(project_path: String, name: String, enabled: bool);
fn import_skill(project_path: String, source_path: String);
fn install_skill_from_github(project_path: String, repo_url: String) -> Vec<SkillInfo>;
fn confirm_install_skill(project_path: String, temp_dir: String, skill_names: Vec<String>);

// projects — 项目历史
fn list_projects() -> Vec<Project>;
fn open_project(path: String);
fn add_project(path: String);
fn remove_project(id: i64);
fn pin_project(id: i64, pinned: bool);

// preferences — 用户偏好
fn get_preference(key: String) -> Option<String>;
fn set_preference(key: String, value: String);
```

## 数据流

1. 启动 → 读取 preferences 恢复窗口状态 → 读取 projects 打开上次项目
2. 无历史 → 显示空状态页，等待用户选择项目
3. 有项目 → `read_merged_config` 获取合并配置，每项标注来源
4. 用户修改 → 即时保存（`write_config` 写入对应层级文件）
5. 模型切换 → `activate_model` 更新 DB + 写入 settings.json 环境变量
6. Skill 安装 → clone 到临时目录 → 展示列表 → 用户选择 → 拷贝到 `.claude/skills/`

## 项目结构

```
packages/jacc/
├── src/
│   ├── App.tsx
│   ├── pages/
│   │   ├── General.tsx
│   │   ├── EnvVars.tsx
│   │   ├── Permissions.tsx
│   │   ├── McpServers.tsx
│   │   ├── Models.tsx
│   │   ├── Skills.tsx
│   │   └── Agents.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── ProjectSwitcher.tsx
│   │   ├── ConfigItem.tsx
│   │   ├── SourceBadge.tsx
│   │   ├── Fab.tsx
│   │   └── dialogs/
│   │       ├── AddModelDialog.tsx
│   │       ├── AddPermissionDialog.tsx
│   │       ├── AddEnvVarDialog.tsx
│   │       ├── AddMcpServerDialog.tsx
│   │       └── InstallSkillDialog.tsx
│   ├── hooks/
│   │   ├── useConfig.ts
│   │   ├── useModels.ts
│   │   ├── useProjects.ts
│   │   └── usePreferences.ts
│   ├── lib/
│   │   ├── config-schema.ts
│   │   └── merge.ts
│   ├── stores/
│   │   └── useAppStore.ts
│   └── styles/
│       └── index.css
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── config.rs
│   │   │   ├── models.rs
│   │   │   ├── skills.rs
│   │   │   ├── projects.rs
│   │   │   └── preferences.rs
│   │   └── db.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 附加工作

- 统一 jackcom 和 toolbox 的数据目录到 `~/.jackit/` 规范
- 将目录规范写入项目 README 和 CLAUDE.md
