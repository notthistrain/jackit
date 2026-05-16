# jacc 计划 1：项目脚手架 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 搭建 jacc Tauri 桌面应用的基础项目结构，包括前端 React + Vite 和后端 Rust Tauri 框架

**架构：** 单页面 Tauri 应用，前端 React 19 + Vite 6 + Tailwind CSS 4，后端 Rust + Tauri 2。遵循 jackcom 的项目配置模式。

**技术栈：** React 19, Vite 6, Tailwind CSS 4, Tauri 2, Rust, TypeScript 5.9, Zustand 5, Lucide React

---

## 文件结构

将要创建的文件及职责：

| 文件 | 职责 |
|------|------|
| `packages/jacc/package.json` | 前端依赖和脚本 |
| `packages/jacc/vite.config.ts` | Vite 构建配置（单页面） |
| `packages/jacc/tsconfig.json` | TypeScript 配置 |
| `packages/jacc/src/main.tsx` | React 入口 |
| `packages/jacc/src/App.tsx` | 根组件（空壳） |
| `packages/jacc/src/index.html` | HTML 入口 |
| `packages/jacc/src/styles/index.css` | Tailwind 入口 + 主题变量 |
| `packages/jacc/src-tauri/tauri.conf.json` | Tauri 窗口和应用配置 |
| `packages/jacc/src-tauri/Cargo.toml` | Rust 依赖 |
| `packages/jacc/src-tauri/src/main.rs` | Rust 入口 |
| `packages/jacc/src-tauri/src/lib.rs` | Tauri 命令注册 |
| `packages/jacc/src-tauri/build.rs` | Tauri 构建脚本 |

将要修改的文件：

| 文件 | 修改内容 |
|------|---------|
| `package.json`（根） | 添加 `dev:jacc` 脚本 |

---

### 任务 1：创建前端项目结构

**文件：**
- 创建：`packages/jacc/package.json`
- 创建：`packages/jacc/vite.config.ts`
- 创建：`packages/jacc/tsconfig.json`

- [ ] **步骤 1：创建 package.json**

```json
{
  "name": "@app/jacc",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "@tauri-apps/api": "catalog:",
    "@tauri-apps/plugin-dialog": "^2.7.1",
    "@tauri-apps/plugin-shell": "^2.3.5",
    "class-variance-authority": "catalog:",
    "clsx": "catalog:",
    "lucide-react": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "tailwind-merge": "catalog:",
    "zustand": "catalog:"
  },
  "devDependencies": {
    "@tailwindcss/vite": "catalog:",
    "@tauri-apps/cli": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "jsdom": "catalog:",
    "tailwindcss": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **步骤 2：创建 vite.config.ts**

```typescript
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    sourcemap: false,
    cssMinify: 'lightningcss',
  },

  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },
})
```

- [ ] **步骤 3：创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **步骤 4：Commit**

```bash
git add packages/jacc/package.json packages/jacc/vite.config.ts packages/jacc/tsconfig.json
git commit -m "feat(jacc): 初始化前端项目配置"
```

---

### 任务 2：创建前端入口文件

**文件：**
- 创建：`packages/jacc/src/index.html`
- 创建：`packages/jacc/src/main.tsx`
- 创建：`packages/jacc/src/App.tsx`
- 创建：`packages/jacc/src/styles/index.css`

- [ ] **步骤 1：创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>jacc</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **步骤 2：创建 main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **步骤 3：创建 App.tsx**

```tsx
export default function App() {
  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <p className="p-4">jacc is running</p>
    </div>
  )
}
```

- [ ] **步骤 4：创建 styles/index.css**

```css
@import 'tailwindcss';

@theme {
  /* 浅色主题变量 */
  --color-background: #fafafa;
  --color-foreground: #333333;
  --color-sidebar: #f5f5f5;
  --color-card: #ffffff;
  --color-border: #e5e5e5;
  --color-border-light: #e8e8e8;
  --color-muted: #999999;
  --color-muted-foreground: #666666;
  --color-primary: #1a73e8;
  --color-primary-light: #e8f4fd;
  --color-success: #2e7d32;
  --color-success-light: #e8f5e9;
  --color-danger: #c62828;
  --color-danger-light: #ffebee;
  --color-warning: #f57f17;
  --color-warning-light: #fff8e1;

  --radius-sm: 2px;
  --radius-md: 4px;
}

/* 深色主题 */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0d1117;
    --color-foreground: #e6edf3;
    --color-sidebar: #161b22;
    --color-card: #161b22;
    --color-border: #30363d;
    --color-border-light: #30363d;
    --color-muted: #8b949e;
    --color-muted-foreground: #c9d1d9;
    --color-primary: #58a6ff;
    --color-primary-light: rgba(31, 111, 235, 0.2);
    --color-success: #3fb950;
    --color-success-light: rgba(35, 134, 54, 0.2);
    --color-danger: #f85149;
    --color-danger-light: rgba(248, 81, 73, 0.15);
    --color-warning: #d29922;
    --color-warning-light: rgba(210, 153, 34, 0.15);
  }
}

/* 手动主题覆盖 */
[data-theme="light"] {
  --color-background: #fafafa;
  --color-foreground: #333333;
  --color-sidebar: #f5f5f5;
  --color-card: #ffffff;
  --color-border: #e5e5e5;
  --color-border-light: #e8e8e8;
  --color-muted: #999999;
  --color-muted-foreground: #666666;
  --color-primary: #1a73e8;
  --color-primary-light: #e8f4fd;
  --color-success: #2e7d32;
  --color-success-light: #e8f5e9;
  --color-danger: #c62828;
  --color-danger-light: #ffebee;
  --color-warning: #f57f17;
  --color-warning-light: #fff8e1;
}

[data-theme="dark"] {
  --color-background: #0d1117;
  --color-foreground: #e6edf3;
  --color-sidebar: #161b22;
  --color-card: #161b22;
  --color-border: #30363d;
  --color-border-light: #30363d;
  --color-muted: #8b949e;
  --color-muted-foreground: #c9d1d9;
  --color-primary: #58a6ff;
  --color-primary-light: rgba(31, 111, 235, 0.2);
  --color-success: #3fb950;
  --color-success-light: rgba(35, 134, 54, 0.2);
  --color-danger: #f85149;
  --color-danger-light: rgba(248, 81, 73, 0.15);
  --color-warning: #d29922;
  --color-warning-light: rgba(210, 153, 34, 0.15);
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
```

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/
git commit -m "feat(jacc): 添加前端入口文件和主题系统"
```

---

### 任务 3：创建 Tauri Rust 后端

**文件：**
- 创建：`packages/jacc/src-tauri/Cargo.toml`
- 创建：`packages/jacc/src-tauri/tauri.conf.json`
- 创建：`packages/jacc/src-tauri/build.rs`
- 创建：`packages/jacc/src-tauri/src/main.rs`
- 创建：`packages/jacc/src-tauri/src/lib.rs`

- [ ] **步骤 1：创建 Cargo.toml**

```toml
[package]
name = "jackit-jacc"
version = "0.1.0"
edition = "2021"

[lib]
name = "jackit_jacc_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
tokio = { version = "1", features = ["full"] }
dirs = "6"
thiserror = "2"
chrono = { version = "0.4", features = ["serde"] }
```

- [ ] **步骤 2：创建 tauri.conf.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/nicegui/nicegui/main/nicegui/static/tauri.conf.schema.json",
  "productName": "jacc",
  "version": "0.1.0",
  "identifier": "com.jackit.jacc",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "jacc",
        "width": 800,
        "height": 560,
        "resizable": true,
        "decorations": false,
        "center": true,
        "minWidth": 640,
        "minHeight": 400
      }
    ],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http:"
    }
  },
  "plugins": {
    "dialog": {},
    "shell": {
      "open": true
    }
  }
}
```

- [ ] **步骤 3：创建 build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **步骤 4：创建 src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    jackit_jacc_lib::run()
}
```

- [ ] **步骤 5：创建 src/lib.rs**

```rust
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 6：Commit**

```bash
git add packages/jacc/src-tauri/
git commit -m "feat(jacc): 初始化 Tauri Rust 后端"
```

---

### 任务 4：集成到 monorepo

**文件：**
- 修改：`package.json`（根目录）

- [ ] **步骤 1：在根 package.json 添加 dev:jacc 脚本**

在根 `package.json` 的 `scripts` 中添加：

```json
"dev:jacc": "pnpm --filter @app/jacc tauri dev"
```

- [ ] **步骤 2：安装依赖**

运行：`cd D:/Project/jackit && pnpm install`
预期：成功安装所有依赖，无报错

- [ ] **步骤 3：验证前端构建**

运行：`cd D:/Project/jackit/packages/jacc && pnpm build`
预期：成功构建到 dist 目录

- [ ] **步骤 4：验证 Rust 编译**

运行：`cd D:/Project/jackit/packages/jacc/src-tauri && cargo check`
预期：编译检查通过，无错误

- [ ] **步骤 5：Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(jacc): 集成到 monorepo 工作区"
```
