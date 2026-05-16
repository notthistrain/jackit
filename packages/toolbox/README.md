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
