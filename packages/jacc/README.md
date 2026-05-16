# Jacc

Jack's Claude Config — Claude Code 配置文件的桌面 GUI 管理工具。

可视化管理 Claude Code 的 `settings.json`、模型配置、Skills、MCP Servers、环境变量和权限规则，支持全局/项目级配置的合并视图。

## 功能

- **通用设置** — 模型槽位切换（Opus/Sonnet/Haiku）、Effort Level、危险模式确认、语言切换
- **模型管理** — 多模型库管理，支持 API 连接测试、槽位绑定、一键激活写入 settings.json
- **Skills 管理** — 启用/禁用切换、本地导入、从 GitHub 仓库在线安装
- **环境变量** — 查看和编辑 settings.json 中的 env 配置
- **MCP Servers** — 管理 MCP 服务器配置
- **权限规则** — 管理 allow/deny 权限列表
- **项目切换** — 多项目管理，快速切换当前项目的配置上下文
- **国际化** — 中文 / English 双语支持
- **亮色/暗色主题** — 跟随系统或手动切换

## 技术栈

- 桌面框架：Tauri 2
- 前端：React 19 + Vite 6
- 状态管理：Zustand 5
- 样式：TailwindCSS 4
- 数据库：SQLite（SQLx，异步）
- 后端：Rust
- 国际化：自研 React Context 方案

## 构建要求

- Node.js 20+
- pnpm 10+
- Rust 1.75+

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（端口 5172）
pnpm --filter @app/jacc tauri:dev

# 构建生产版本
pnpm --filter @app/jacc tauri:build
```

## 数据存储

应用数据存储在 `~/.jackit/toolbox/tools/jacc/` 下：

```
jacc/
├── jacc.exe
├── data/
│   └── jacc.db      # SQLite 数据库（模型、项目、偏好设置）
├── config/
└── log/
```

## 架构

```
packages/jacc/
├── src/                    # React 前端
│   ├── pages/              # 页面组件（General, Models, Skills, EnvVars, MCP, Permissions, Agents）
│   ├── components/         # 通用组件（Sidebar, TitleBar, SourceBadge, Dialogs）
│   ├── hooks/              # 自定义 Hooks（useConfig, useModels, useSkills, usePreferences）
│   ├── stores/             # Zustand 状态管理
│   └── i18n/               # 国际化（locales/zh.json, locales/en.json）
└── src-tauri/              # Rust 后端
    └── src/
        ├── commands/       # Tauri 命令（config, models, skills, projects, preferences）
        ├── db.rs           # 数据库初始化与迁移
        └── error.rs        # 统一错误处理
```

## 配置文件说明

Jacc 管理的是 Claude Code 的配置体系：

| 文件 | 作用 |
|------|------|
| `~/.claude/settings.json` | 全局配置（env、permissions、模型参数） |
| `.claude/settings.json` | 项目级配置（覆盖全局） |
| `.claude/skills/` | Skills 目录 |

合并视图会标注每个配置项的来源（global / project），方便定位和修改。
