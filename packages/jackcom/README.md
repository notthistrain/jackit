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
