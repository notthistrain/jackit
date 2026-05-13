# README 与 LICENSE 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 jackit 项目创建中文 README.md 和 Apache 2.0 LICENSE 文件。

**架构：** 在 monorepo 根目录创建两个纯文本文件：README.md（项目概览文档）和 LICENSE（开源协议全文）。无需修改任何现有代码。

**技术栈：** Markdown、纯文本

**设计文档：** `docs/superpowers/specs/2026-05-13-readme-design.md`

---

## 文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 创建 | `README.md` | 项目概览文档 |
| 创建 | `LICENSE` | Apache 2.0 协议全文 |

---

### 任务 1：创建 README.md

**文件：**
- 创建：`README.md`

- [ ] **步骤 1：创建 README.md**

在项目根目录创建 `README.md`，写入以下内容：

```markdown
# jackit

> Jack 的软件工具集——集分发、管理、工具于一体的桌面工具平台。

## 愿景

打造一款开箱即用的软件工具箱——集成各类实用工具，提供统一的软件分发与版本管理能力，让工具触手可及。

## 特性

- 统一的软件分发与版本管理平台
- 串口通信调试与协议解析
- 实时波形显示与数据解码
- 丰富的桌面工具集，持续扩展中
- Web 管理后台，轻松管理软件版本与用户权限

## 技术栈

| 模块 | 技术 |
|------|------|
| 桌面应用 | Tauri 2、React 19、Vue 3、Zustand |
| 后端服务 | Midway.js、TypeORM、SQLite、S3 |
| 管理后台 | Astro、Vue 3、Tiptap、shadcn-vue |
| 构建 | Vite MPA、pnpm workspace、TypeScript |

## 项目结构

```
jackit/
├── packages/
│   ├── server/      # 后端服务 — 软件分发、版本管理、认证权限
│   ├── admin/       # 管理后台 — 软件版本管理、操作日志
│   ├── jackcom/     # 串口工具 — 串口通信、协议解码、波形显示
│   └── toolbox/     # 工具箱 — 桌面工具集入口、自动更新
└── pnpm-workspace.yaml
```

## 模块简介

### server

基于 Midway.js 的后端服务，对接 S3 存储，提供软件版本管理、用户认证与权限控制、操作日志等 API。

### admin

基于 Astro + Vue 3 的 Web 管理后台，支持软件发布、版本编辑（富文本）、用户管理、操作日志查看等功能。

### jackcom

基于 Tauri 2 + React 的串口调试桌面应用。支持多窗口（主界面、协议解码、波形显示、历史记录），Rust 后端通过串口通信收发数据。

### toolbox

基于 Tauri 2 + Vue 3 的桌面工具集入口，集成各工具的启动、自动更新和全局设置管理。

## 开源协议

[Apache License 2.0](LICENSE)
```

- [ ] **步骤 2：验证 README.md 内容正确**

运行：`head -5 README.md`
预期：输出前 5 行，首行为 `# jackit`

- [ ] **步骤 3：Commit**

```bash
git add README.md
git commit -m "docs: 添加项目 README"
```

---

### 任务 2：创建 LICENSE 文件

**文件：**
- 创建：`LICENSE`

- [ ] **步骤 1：下载 Apache 2.0 协议全文**

运行以下命令从 Apache 官方下载 LICENSE 文件：

```bash
curl -s https://www.apache.org/licenses/LICENSE-2.0.txt -o LICENSE
```

如果 curl 不可用，手动创建 `LICENSE` 文件，写入 Apache 2.0 协议全文（从 https://www.apache.org/licenses/LICENSE-2.0.txt 获取）。

- [ ] **步骤 2：验证 LICENSE 文件**

运行：`head -3 LICENSE`
预期：首行包含 `Apache License`

- [ ] **步骤 3：Commit**

```bash
git add LICENSE
git commit -m "license: 添加 Apache 2.0 开源协议"
```
