# Toolbox & JackCom README 设计规格

## 概述

为 `packages/toolbox` 和 `packages/jackcom` 各编写一份中文 README，面向 GitHub 开源社区访客，采用标准开源项目风格。

## 目标读者

GitHub 访客、潜在用户、开源社区开发者。

## 文件位置

- `packages/toolbox/README.md`
- `packages/jackcom/README.md`

## 语言

中文。

---

## Toolbox README 结构

### 标题与简介

```
# Jackit Toolbox

Jack 的软件工具集 — 统一管理、一键启动你的桌面工具。
```

Badges: license (Apache-2.0), platform (Windows), release version。

### 功能特性

- 🧰 工具集中管理 — 安装、卸载、启动，一站搞定
- 🔄 自动更新 — 后台检测新版本，无感升级
- 📡 远程同步 — 从服务器获取最新工具列表
- ⚙️ 全局配置 — 统一管理所有工具的设置

### 截图

预留 `<!-- screenshot -->` 占位，后续补充实际截图。

### 安装

两种方式：

1. **下载安装包** — 从 GitHub Releases 下载对应平台安装包
2. **从源码构建** — 列出前置条件（Node.js 20+, pnpm 10+, Rust 1.75+），给出命令：
   ```bash
   pnpm install
   pnpm dev:toolbox    # 开发模式
   pnpm build:toolbox  # 构建生产版本
   ```

### 数据目录

说明 `~/.jackit/toolbox/` 的目录结构：

```
~/.jackit/toolbox/
├── data/toolbox.db      # 数据库
├── config/toolbox.yaml  # 配置文件
├── log/                 # 日志
└── tools/               # 已安装的工具
```

### 技术栈

表格形式：

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | Vue 3 + Vite |
| 样式 | TailwindCSS 4 |
| 数据库 | SQLite (rusqlite) |
| 后端 | Rust |

### License

Apache-2.0，链接到根目录 LICENSE 文件。

---

## JackCom README 结构

### 标题与简介

```
# JackCom

专业串口调试与协议分析工具 — 多窗口、多协议、实时波形。
```

Badges: license, platform, release。

### 功能特性

- 🔌 串口通信 — 支持多端口同时连接，灵活配置波特率/数据位/校验等参数
- 🔍 协议解析 — 自动识别 Modbus RTU、AT 指令、JSON 等协议并解码
- 📊 实时波形 — 数据可视化，直观观察信号变化
- 📋 历史记录 — 帧级别存储，支持筛选、导出
- 🪟 多窗口 — 主窗口 / 波形 / 解码器 / 历史，各司其职

### 截图

预留 `<!-- screenshot -->` 占位。

### 安装

三种方式：

1. **通过 Toolbox 安装（推荐）** — 在 Jackit Toolbox 中一键安装
2. **下载安装包** — 从 GitHub Releases 下载
3. **从源码构建** — 前置条件同 Toolbox，命令：
   ```bash
   pnpm install
   pnpm dev:jackcom    # 开发模式
   pnpm build:jackcom  # 构建生产版本
   ```

### 支持的协议

| 协议 | 说明 |
|------|------|
| Raw | 原始十六进制 + ASCII 显示 |
| Modbus RTU | 从站地址、功能码、寄存器解析、CRC 校验 |
| AT 指令 | 命令/响应识别、参数提取 |
| JSON | 结构化数据解析 |

### 开发

说明本地开发流程，包括 Mock MCU 的使用：

```bash
pnpm dev:jackcom   # 启动开发服务器
pnpm mock:mcu      # 启动模拟串口设备（用于无硬件测试）
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19 + Vite |
| 状态管理 | Zustand |
| 样式 | TailwindCSS 4 |
| 数据库 | SQLite (SQLx, async) |
| 串口 | serialport crate + tokio |
| 后端 | Rust |

### License

Apache-2.0。

---

## 约束

- 不包含英文翻译
- 截图后续补充，先用占位符
- Badge 使用 shields.io 标准格式
- 不涉及 API 文档或详细架构说明
