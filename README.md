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

```text
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
