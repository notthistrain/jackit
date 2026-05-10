# Plan 1: Monorepo 骨架搭建

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 建立根目录 pnpm monorepo，迁移 upgrade-component 子包，初始化 Tauri 2 toolbox 骨架

**架构：** 根目录 `pnpm-workspace.yaml` 管理 `packages/*` 下三个子包。upgrade-component 的 server 和 admin 从 `upgrade-component/packages/` 提升；toolbox 新建 Tauri 2 + Astro + Vue 骨架。

**技术栈：** pnpm 10 workspaces、Tauri 2 (Rust 1.93)、Astro 6 + Vue 3

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 创建 | `pnpm-workspace.yaml` | workspace 声明 |
| 创建 | `package.json` | 根 workspace 脚本 |
| 移动 | `upgrade-component/packages/server/` → `packages/server/` | Midway.js 服务端（原样） |
| 移动 | `upgrade-component/packages/admin/` → `packages/admin/` | Astro 管理后台（原样） |
| 创建 | `packages/toolbox/package.json` | toolbox 前端依赖 |
| 创建 | `packages/toolbox/astro.config.mjs` | Astro MPA 配置 |
| 创建 | `packages/toolbox/tsconfig.json` | TypeScript 配置 |
| 创建 | `packages/toolbox/src/env.d.ts` | Tauri 类型声明 |
| 创建 | `packages/toolbox/src/pages/index.astro` | 占位首页 |
| 创建 | `packages/toolbox/src/pages/settings.astro` | 占位设置页 |
| 创建 | `packages/toolbox/src/styles/global.css` | TailwindCSS 入口 |
| 创建 | `packages/toolbox/src-tauri/Cargo.toml` | Rust 依赖 |
| 创建 | `packages/toolbox/src-tauri/tauri.conf.json` | Tauri 窗口/应用配置 |
| 创建 | `packages/toolbox/src-tauri/capabilities/default.json` | Tauri 权限声明 |
| 创建 | `packages/toolbox/src-tauri/src/main.rs` | Rust 入口 |
| 创建 | `packages/toolbox/src-tauri/src/lib.rs` | command 注册 |
| 创建 | `packages/toolbox/src-tauri/build.rs` | Tauri 构建脚本 |
| 删除 | `upgrade-component/` | 迁移完成后清理 |

---

### 任务 1：创建根 Monorepo 配置

**文件：**
- 创建：`pnpm-workspace.yaml`
- 创建：`package.json`

- [ ] **步骤 1：创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
onlyBuiltDependencies:
  - better-sqlite3
```

- [ ] **步骤 2：创建根 package.json**

合并原 `upgrade-component/package.json` 的脚本，增加 toolbox 脚本：

```json
{
  "name": "upgrade-component",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:server": "pnpm --filter @upgrade-component/server dev",
    "dev:admin": "pnpm --filter @upgrade-component/admin dev",
    "dev:toolbox": "pnpm --filter @upgrade-component/toolbox dev",
    "build": "pnpm -r build",
    "test": "pnpm --filter @upgrade-component/server test",
    "lint": "pnpm -r lint"
  }
}
```

- [ ] **步骤 3：验证配置语法**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('OK')"
```

预期：`OK`

---

### 任务 2：迁移 upgrade-component 子包

**文件：**
- 移动：`upgrade-component/packages/server/` → `packages/server/`
- 移动：`upgrade-component/packages/admin/` → `packages/admin/`

- [ ] **步骤 1：创建 packages 目录并移动**

```bash
cd D:/Project/upgrade-component
mkdir -p packages
cp -r upgrade-component/packages/server packages/server
cp -r upgrade-component/packages/admin packages/admin
```

- [ ] **步骤 2：验证包名正确**

```bash
node -e "console.log(require('./packages/server/package.json').name)"
node -e "console.log(require('./packages/admin/package.json').name)"
```

预期：`@upgrade-component/server` 和 `@upgrade-component/admin`

- [ ] **步骤 3：删除旧 upgrade-component 目录**

```bash
rm -rf upgrade-component
```

- [ ] **步骤 4：验证 pnpm 识别 workspace**

```bash
pnpm ls -r --depth -1
```

预期：列出 `@upgrade-component/server` 和 `@upgrade-component/admin` 两个包

---

### 任务 3：创建 Toolbox Tauri 2 Rust 骨架

**文件：**
- 创建：`packages/toolbox/src-tauri/Cargo.toml`
- 创建：`packages/toolbox/src-tauri/tauri.conf.json`
- 创建：`packages/toolbox/src-tauri/capabilities/default.json`
- 创建：`packages/toolbox/src-tauri/build.rs`
- 创建：`packages/toolbox/src-tauri/src/main.rs`
- 创建：`packages/toolbox/src-tauri/src/lib.rs`

- [ ] **步骤 1：创建 Cargo.toml**

```toml
[package]
name = "upgrade-component-toolbox"
version = "0.1.0"
edition = "2021"

[lib]
name = "upgrade-component_toolbox_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-log = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **步骤 2：创建 tauri.conf.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/nicedoc/bun-tauri/refs/heads/main/packages/tidl/src/tidl.schema.json",
  "productName": "工具箱",
  "version": "0.1.0",
  "identifier": "com.seichitech.toolbox",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:4321",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "url": "/index.html",
        "title": "工具箱",
        "width": 900,
        "height": 690,
        "decorations": false
      }
    ],
    "security": {
      "csp": null
    }
  }
}
```

- [ ] **步骤 3：创建 capabilities/default.json**

```json
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-start-dragging"
  ]
}
```

- [ ] **步骤 4：创建 build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **步骤 5：创建 main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    upgrade-component_toolbox_lib::run()
}
```

- [ ] **步骤 6：创建 lib.rs**

```rust
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to 工具箱.", name)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 7：验证 Rust 编译**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo check
```

预期：`Finished` 且无 error

---

### 任务 4：创建 Toolbox 前端骨架

**文件：**
- 创建：`packages/toolbox/package.json`
- 创建：`packages/toolbox/astro.config.mjs`
- 创建：`packages/toolbox/tsconfig.json`
- 创建：`packages/toolbox/src/env.d.ts`
- 创建：`packages/toolbox/src/pages/index.astro`
- 创建：`packages/toolbox/src/pages/settings.astro`
- 创建：`packages/toolbox/src/styles/global.css`

- [ ] **步骤 1：创建 package.json**

```json
{
  "name": "@upgrade-component/toolbox",
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-log": "^2",
    "vue": "^3.5.32",
    "@vueuse/core": "^14.2.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-vue-next": "^1.0.0",
    "reka-ui": "^2.9.6",
    "vue-sonner": "^2.0.9"
  },
  "devDependencies": {
    "@astrojs/vue": "^6.0.1",
    "@tailwindcss/vite": "^4.2.1",
    "@tauri-apps/cli": "^2",
    "astro": "^6.1.6",
    "tailwind-merge": "^3.5.0",
    "tailwindcss": "^4.2.1",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **步骤 2：创建 astro.config.mjs**

```javascript
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()],
  },
  output: 'static',
});
```

- [ ] **步骤 3：创建 tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "preserve"
  }
}
```

- [ ] **步骤 4：创建 src/env.d.ts**

```typescript
/// <reference types="astro/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
```

- [ ] **步骤 5：创建 src/styles/global.css**

```css
@import "tailwindcss";
```

- [ ] **步骤 6：创建 src/pages/index.astro**

```astro
---
import '../styles/global.css';
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>工具箱</title>
  </head>
  <body>
    <h1>工具箱 - 首页</h1>
    <a href="/settings.html">设置</a>
  </body>
</html>
```

- [ ] **步骤 7：创建 src/pages/settings.astro**

```astro
---
import '../styles/global.css';
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>工具箱 - 设置</title>
  </head>
  <body>
    <h1>设置</h1>
    <a href="/index.html">返回工具列表</a>
  </body>
</html>
```

---

### 任务 5：安装依赖并验证

- [ ] **步骤 1：安装 Tauri CLI**

```bash
cargo install tauri-cli
```

- [ ] **步骤 2：pnpm install**

```bash
cd D:/Project/upgrade-component
pnpm install
```

预期：三个包都正确安装，无 peer dependency 错误

- [ ] **步骤 3：验证 workspace 列表**

```bash
pnpm ls -r --depth -1
```

预期：列出 `@upgrade-component/server`、`@upgrade-component/admin`、`@upgrade-component/toolbox`

- [ ] **步骤 4：验证前端构建**

```bash
cd D:/Project/upgrade-component/packages/toolbox
pnpm build
```

预期：`dist/` 目录生成，包含 `index.html` 和 `settings.html`

- [ ] **步骤 5：验证 Tauri 构建（仅 Rust 部分）**

```bash
cd D:/Project/upgrade-component/packages/toolbox/src-tauri
cargo build
```

预期：`Finished` 无 error
