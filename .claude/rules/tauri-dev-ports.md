---
description: Tauri 应用开发端口分配规则
globs:
  - packages/*/vite.config.ts
  - packages/*/src-tauri/tauri.conf.json
---

# Tauri 应用开发端口分配

所有 Tauri 桌面应用的 Vite dev server 端口从 5170 开始自增，避免冲突：

| 应用 | 端口 |
|------|------|
| toolbox | 5170 |
| jackcom | 5171 |
| jacc | 5172 |

新增 Tauri 应用时，取当前最大端口号 +1。

需要同步修改两处：
- `packages/<app>/vite.config.ts` 的 `server.port`
- `packages/<app>/src-tauri/tauri.conf.json` 的 `build.devUrl`
