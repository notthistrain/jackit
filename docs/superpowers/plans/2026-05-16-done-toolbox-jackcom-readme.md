# Toolbox & JackCom README 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 packages/toolbox 和 packages/jackcom 各编写一份中文 README.md

**架构：** 纯文档任务，各自独立的 markdown 文件，无代码依赖

**技术栈：** Markdown, shields.io badges

**GitHub 仓库：** `notthistrain/jackit`

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 创建 | `packages/toolbox/README.md` | Toolbox 项目介绍文档 |
| 创建 | `packages/jackcom/README.md` | JackCom 项目介绍文档 |

---

### 任务 1：编写 Toolbox README

**文件：**
- 创建：`packages/toolbox/README.md`

- [ ] **步骤 1：创建 packages/toolbox/README.md**

写入以下完整内容：

```markdown
# Jackit Toolbox

Jack 的软件工具集 — 统一管理、一键启动你的桌面工具。

[![License](https://img.shields.io/github/license/notthistrain/jackit)](../../LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-blue)]()
[![Release](https://img.shields.io/github/v/release/notthistrain/jackit)](https://github.com/notthistrain/jackit/releases)

## 功能特性

- 🧰 工具集中管理 — 安装、卸载、启动，一站搞定
- 🔄 自动更新 — 后台检测新版本，无感升级
- 📡 远程同步 — 从服务器获取最新工具列表
- ⚙️ 全局配置 — 统一管理所有工具的设置

## 截图

<!-- screenshot -->

## 安装

### 下载安装包

从 [Releases](https://github.com/notthistrain/jackit/releases) 页面下载对应平台的安装包。

### 从源码构建

前置条件：

- Node.js 20+
- pnpm 10+
- Rust 1.75+

```bash
# 克隆仓库
git clone https://github.com/notthistrain/jackit.git
cd jackit

# 安装依赖
pnpm install

# 开发模式
pnpm dev:toolbox

# 构建生产版本
pnpm build:toolbox
```

## 数据目录

所有数据存储在 `~/.jackit/toolbox/`：

```
~/.jackit/toolbox/
├── data/toolbox.db      # 数据库
├── config/toolbox.yaml  # 配置文件
├── log/                 # 日志
└── tools/               # 已安装的工具
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | Vue 3 + Vite |
| 样式 | TailwindCSS 4 |
| 数据库 | SQLite (rusqlite) |
| 后端 | Rust |

## License

[Apache-2.0](../../LICENSE)
```

- [ ] **步骤 2：验证文件已正确创建**

运行：`cat packages/toolbox/README.md | head -5`
预期：显示标题和简介行。

- [ ] **步骤 3：Commit**

```bash
git add packages/toolbox/README.md
git commit -m "docs(toolbox): 添加中文 README"
```

---

### 任务 2：编写 JackCom README

**文件：**
- 创建：`packages/jackcom/README.md`

- [ ] **步骤 1：创建 packages/jackcom/README.md**

写入以下完整内容：

```markdown
# JackCom

专业串口调试与协议分析工具 — 多窗口、多协议、实时波形。

[![License](https://img.shields.io/github/license/notthistrain/jackit)](../../LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-blue)]()
[![Release](https://img.shields.io/github/v/release/notthistrain/jackit)](https://github.com/notthistrain/jackit/releases)

## 功能特性

- 🔌 串口通信 — 支持多端口同时连接，灵活配置波特率/数据位/校验等参数
- 🔍 协议解析 — 自动识别 Modbus RTU、AT 指令、JSON 等协议并解码
- 📊 实时波形 — 数据可视化，直观观察信号变化
- 📋 历史记录 — 帧级别存储，支持筛选、导出
- 🪟 多窗口 — 主窗口 / 波形 / 解码器 / 历史，各司其职

## 截图

<!-- screenshot -->

## 安装

### 通过 Toolbox 安装（推荐）

在 [Jackit Toolbox](../toolbox) 中一键安装。

### 下载安装包

从 [Releases](https://github.com/notthistrain/jackit/releases) 页面下载。

### 从源码构建

前置条件：

- Node.js 20+
- pnpm 10+
- Rust 1.75+

```bash
# 克隆仓库
git clone https://github.com/notthistrain/jackit.git
cd jackit

# 安装依赖
pnpm install

# 开发模式
pnpm dev:jackcom

# 构建生产版本
pnpm build:jackcom
```

## 支持的协议

| 协议 | 说明 |
|------|------|
| Raw | 原始十六进制 + ASCII 显示 |
| Modbus RTU | 从站地址、功能码、寄存器解析、CRC 校验 |
| AT 指令 | 命令/响应识别、参数提取 |
| JSON | 结构化数据解析 |

## 开发

```bash
# 启动开发服务器
pnpm dev:jackcom

# 启动模拟串口设备（用于无硬件测试）
pnpm mock:mcu
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19 + Vite |
| 状态管理 | Zustand |
| 样式 | TailwindCSS 4 |
| 数据库 | SQLite (SQLx, async) |
| 串口 | serialport crate + tokio |
| 后端 | Rust |

## License

[Apache-2.0](../../LICENSE)
```

- [ ] **步骤 2：验证文件已正确创建**

运行：`cat packages/jackcom/README.md | head -5`
预期：显示标题和简介行。

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/README.md
git commit -m "docs(jackcom): 添加中文 README"
```
