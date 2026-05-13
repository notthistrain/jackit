# Astro → Vite MPA 迁移实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 jackcom（React）和 toolbox（Vue）两个 Tauri 桌面应用从 Astro 构建迁移到 Vite MPA，消除无实际收益的 Astro 抽象层。

**架构：** 每个 Tauri 窗口 = 一个 HTML 入口。使用 Vite 的 `rollupOptions.input` 多入口模式 + `root` 选项将页面目录映射为构建输出。入口文件与 HTML 同目录，业务代码（components/hooks/stores）零改动。

**技术栈：** Vite 6、@vitejs/plugin-react、@vitejs/plugin-vue、TailwindCSS v4（@tailwindcss/vite）

---

## 文件结构

### jackcom 迁移后的目录

```
packages/jackcom/
  vite.config.ts          ← 新建：Vite MPA 配置（root: src/pages）
  vitest.config.ts        ← 修改：移除 astro 依赖，独立配置
  tsconfig.json           ← 修改：不再 extends astro/tsconfigs/strict
  package.json            ← 修改：scripts + 依赖
  astro.config.mjs        ← 删除
  src/
    pages/                ← Vite root 指向此处
      main/
        index.html        ← 新建
        main.tsx          ← 新建
      decoder/
        index.html        ← 新建
        decoder.tsx       ← 新建
      waveform/
        index.html        ← 新建
        waveform.tsx      ← 新建
      history/
        index.html        ← 新建
        history.tsx       ← 新建
    apps/                 ← 不变
    components/           ← 不变
    hooks/                ← 不变
    stores/               ← 不变
    styles/               ← 不变
```

### toolbox 迁移后的目录

```
packages/toolbox/
  vite.config.ts          ← 新建
  tsconfig.json           ← 修改
  package.json            ← 修改
  astro.config.mjs        ← 删除
  src/
    pages/
      index.html          ← 新建（不在子目录，匹配 dist/index.html 输出）
      index.ts            ← 新建
      settings/
        index.html        ← 新建
        settings.ts       ← 新建
    components/           ← 不变
    styles/               ← 不变
```

### 输出路径映射

**jackcom（`root: src/pages`，`outDir: ../../dist`）：**
| 源文件 | 输出文件 | Tauri URL |
|--------|---------|-----------|
| `src/pages/main/index.html` | `dist/main/index.html` | `/main` ✓ |
| `src/pages/decoder/index.html` | `dist/decoder/index.html` | `/decoder` ✓ |
| `src/pages/waveform/index.html` | `dist/waveform/index.html` | `/waveform` ✓ |
| `src/pages/history/index.html` | `dist/history/index.html` | `/history` ✓ |

**toolbox（`root: src/pages`，`outDir: ../../dist`）：**
| 源文件 | 输出文件 | Tauri URL |
|--------|---------|-----------|
| `src/pages/index.html` | `dist/index.html` | `/index.html` ✓ |
| `src/pages/settings/index.html` | `dist/settings/index.html` | `/settings` ✓ |

---

## 任务 1：jackcom — 创建 Vite 配置

**文件：**
- 创建：`packages/jackcom/vite.config.ts`
- 修改：`packages/jackcom/vitest.config.ts`

- [ ] **步骤 1：创建 vite.config.ts**

```ts
// packages/jackcom/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const root = resolve(__dirname, 'src/pages')

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },

  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext',
    sourcemap: false,
    reportCompressedSize: false,
    cssMinify: 'lightningcss',
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'main/index.html'),
        decoder: resolve(root, 'decoder/index.html'),
        waveform: resolve(root, 'waveform/index.html'),
        history: resolve(root, 'history/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]/index.js',
        chunkFileNames: 'assets/[name]/[hash].js',
        assetFileNames: 'assets/[name]/[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tauri-apps')) return 'vendor-tauri'
            if (id.includes('react') || id.includes('react-dom'))
              return 'vendor-react'
            return 'vendor'
          }
        },
      },
    },
  },

  server: {
    port: 4321,
    strictPort: true,
    open: false,
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand'],
  },
})
```

- [ ] **步骤 2：替换 vitest.config.ts**

当前 `vitest.config.ts` 依赖 `astro/config` 的 `getViteConfig`。替换为独立配置，插件和别名与 vite.config.ts 保持一致（vitest 不使用 `root` 选项，以项目根目录运行测试）：

```ts
// packages/jackcom/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **步骤 3：更新 tsconfig.json**

移除 `extends: "astro/tsconfigs/strict"`（Astro 移除后该路径不存在），改为直接声明所需编译选项：

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

---

## 任务 2：jackcom — 创建 MPA 页面入口

**文件：**
- 创建：`packages/jackcom/src/pages/main/index.html`
- 创建：`packages/jackcom/src/pages/main/main.tsx`
- 创建：`packages/jackcom/src/pages/decoder/index.html`
- 创建：`packages/jackcom/src/pages/decoder/decoder.tsx`
- 创建：`packages/jackcom/src/pages/waveform/index.html`
- 创建：`packages/jackcom/src/pages/waveform/waveform.tsx`
- 创建：`packages/jackcom/src/pages/history/index.html`
- 创建：`packages/jackcom/src/pages/history/history.tsx`

每个 Astro 页面的当前内容是：

```
---
import '../styles/globals.css'
import MainApp from '../apps/MainApp'
---
<MainApp client:load />
```

迁移后拆分为 HTML + TSX 两个文件，职责完全相同。

- [ ] **步骤 1：创建 main 页面入口**

```html
<!-- packages/jackcom/src/pages/main/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JackCom — Serial Debugger</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

```tsx
// packages/jackcom/src/pages/main/main.tsx
import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MainApp } from '@/apps/MainApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MainApp />
  </StrictMode>
)
```

- [ ] **步骤 2：创建 decoder 页面入口**

```html
<!-- packages/jackcom/src/pages/decoder/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JackCom — Decoder</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./decoder.tsx"></script>
</body>
</html>
```

```tsx
// packages/jackcom/src/pages/decoder/decoder.tsx
import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DecoderApp } from '@/apps/DecoderApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DecoderApp />
  </StrictMode>
)
```

- [ ] **步骤 3：创建 waveform 页面入口**

```html
<!-- packages/jackcom/src/pages/waveform/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JackCom — Waveform</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./waveform.tsx"></script>
</body>
</html>
```

```tsx
// packages/jackcom/src/pages/waveform/waveform.tsx
import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WaveformApp } from '@/apps/WaveformApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WaveformApp />
  </StrictMode>
)
```

- [ ] **步骤 4：创建 history 页面入口**

```html
<!-- packages/jackcom/src/pages/history/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JackCom — History</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./history.tsx"></script>
</body>
</html>
```

```tsx
// packages/jackcom/src/pages/history/history.tsx
import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HistoryApp } from '@/apps/HistoryApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HistoryApp />
  </StrictMode>
)
```

---

## 任务 3：jackcom — 更新依赖和脚本，验证构建

**文件：**
- 修改：`packages/jackcom/package.json`

- [ ] **步骤 1：更新 package.json scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

- [ ] **步骤 2：更新 package.json 依赖**

移除 Astro 相关依赖，添加 Vite 相关依赖：

```json
{
  "dependencies": {
    "@tauri-apps/api": "catalog:",
    "@tauri-apps/plugin-log": "catalog:",
    "react": "^19",
    "react-dom": "^19",
    "zustand": "^5",
    "@tanstack/react-virtual": "^3",
    "cmdk": "^1",
    "lucide-react": "^0.460",
    "class-variance-authority": "catalog:",
    "clsx": "catalog:",
    "tailwind-merge": "catalog:"
  },
  "devDependencies": {
    "@tailwindcss/vite": "catalog:",
    "@tauri-apps/cli": "catalog:",
    "@testing-library/react": "^16",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "jsdom": "^26",
    "tailwindcss": "catalog:",
    "typescript": "catalog:",
    "vite": "^6",
    "vitest": "^3"
  }
}
```

变更摘要：
- 移除：`astro`、`@astrojs/react`
- 新增：`vite`、`@vitejs/plugin-react`

- [ ] **步骤 3：安装依赖**

运行：`pnpm install`
预期：成功安装，无 peer dependency 错误

- [ ] **步骤 4：验证构建**

运行：`pnpm --filter @upgrade-component/jackcom build`
预期：`vite build` 成功，输出到 `packages/jackcom/dist/`

- [ ] **步骤 5：检查输出结构**

运行：`ls -R packages/jackcom/dist/`
预期输出包含：
```
dist/main/index.html
dist/decoder/index.html
dist/waveform/index.html
dist/history/index.html
dist/assets/
```

如果输出结构与预期不符，检查 `root` 配置和 `rollupOptions.input` 路径。

- [ ] **步骤 6：验证 HTML 中的资源引用**

运行：`head -20 packages/jackcom/dist/main/index.html`
预期：`<script>` 和 `<link>` 标签使用 `/assets/...` 绝对路径（不是 `./assets/...`）

如果使用了相对路径，说明 `base` 配置有问题——确保 vite.config.ts 中没有 `base: './'`。

- [ ] **步骤 7：运行测试**

运行：`pnpm --filter @upgrade-component/jackcom test`
预期：所有现有测试通过（vitest 现在使用独立的 vitest.config.ts）

- [ ] **步骤 8：Commit**

```bash
cd packages/jackcom
git add vite.config.ts vitest.config.ts tsconfig.json package.json pnpm-lock.yaml
git add src/pages/main/ src/pages/decoder/ src/pages/waveform/ src/pages/history/
git commit -m "refactor(jackcom): 迁移到 Vite MPA 构建体系"
```

---

## 任务 4：jackcom — 清理 Astro 残留

**文件：**
- 删除：`packages/jackcom/astro.config.mjs`
- 删除：`packages/jackcom/src/pages/main.astro`
- 删除：`packages/jackcom/src/pages/decoder.astro`
- 删除：`packages/jackcom/src/pages/waveform.astro`
- 删除：`packages/jackcom/src/pages/history.astro`

- [ ] **步骤 1：删除 Astro 配置**

```bash
rm packages/jackcom/astro.config.mjs
```

- [ ] **步骤 2：删除 Astro 页面文件**

```bash
rm packages/jackcom/src/pages/main.astro
rm packages/jackcom/src/pages/decoder.astro
rm packages/jackcom/src/pages/waveform.astro
rm packages/jackcom/src/pages/history.astro
```

注意：新的 `src/pages/main/` 等目录已在任务 2 创建，与旧 `.astro` 文件不冲突（目录 vs 文件）。

- [ ] **步骤 3：再次验证构建和测试**

运行：
```bash
pnpm --filter @upgrade-component/jackcom build
pnpm --filter @upgrade-component/jackcom test
```
预期：构建和测试均通过。

- [ ] **步骤 4：验证 Tauri dev 模式**

运行：`pnpm --filter @upgrade-component/jackcom dev`
预期：Vite dev server 在 `http://localhost:4321` 启动。
访问 `http://localhost:4321/main/` 应返回 HTML 页面。

如果 `/main`（无尾部斜杠）不工作，需要将 `packages/jackcom/src-tauri/tauri.conf.json` 中窗口 URL 从 `/main` 改为 `/main/index.html`。

- [ ] **步骤 5：Commit**

```bash
git rm packages/jackcom/astro.config.mjs
git rm packages/jackcom/src/pages/main.astro
git rm packages/jackcom/src/pages/decoder.astro
git rm packages/jackcom/src/pages/waveform.astro
git rm packages/jackcom/src/pages/history.astro
git commit -m "refactor(jackcom): 删除 Astro 构建残留文件"
```

---

## 任务 5：toolbox — 创建 Vite 配置和页面入口

**文件：**
- 创建：`packages/toolbox/vite.config.ts`
- 创建：`packages/toolbox/src/pages/index.html`
- 创建：`packages/toolbox/src/pages/index.ts`
- 创建：`packages/toolbox/src/pages/settings/index.html`
- 创建：`packages/toolbox/src/pages/settings/settings.ts`
- 修改：`packages/toolbox/tsconfig.json`

当前 toolbox Astro 页面组合多个 Vue 组件（以 `index.astro` 为例）：

```
<Titlebar client:load />
<Layout currentPage="tools" client:load>
  <ToolsPage client:load />
</Layout>
<UpdateDialog client:load />
```

迁移后需要一个 Vue 根组件将它们组装起来。入口 TS 文件直接内联这个组装逻辑，不需要创建额外的 `.vue` 文件。

- [ ] **步骤 1：创建 vite.config.ts**

```ts
// packages/toolbox/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const root = resolve(__dirname, 'src/pages')

export default defineConfig({
  root,
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },

  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext',
    sourcemap: false,
    reportCompressedSize: false,
    cssMinify: 'lightningcss',
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        settings: resolve(root, 'settings/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]/index.js',
        chunkFileNames: 'assets/[name]/[hash].js',
        assetFileNames: 'assets/[name]/[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tauri-apps')) return 'vendor-tauri'
            if (id.includes('vue')) return 'vendor-vue'
            return 'vendor'
          }
        },
      },
    },
  },

  server: {
    port: 4321,
    strictPort: true,
    open: false,
  },

  optimizeDeps: {
    include: ['vue', '@vueuse/core'],
  },
})
```

注意：toolbox 的 `index.html` 直接放在 `src/pages/` 下（不在子目录），因为 Astro 将 `index.astro` 输出为 `dist/index.html`（根目录），不是 `dist/index/index.html`。

- [ ] **步骤 2：创建 index 页面入口**

```html
<!-- packages/toolbox/src/pages/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>工具箱</title>
</head>
<body>
  <div id="app" class="h-full flex flex-col">
    <div id="titlebar"></div>
    <div id="layout"></div>
    <div id="update-dialog"></div>
  </div>
  <script type="module" src="./index.ts"></script>
</body>
</html>
```

```ts
// packages/toolbox/src/pages/index.ts
import '@/styles/global.css'
import { createApp, h } from 'vue'
import Titlebar from '@/components/titlebar.vue'
import Layout from '@/components/layout.vue'
import ToolsPage from '@/components/pages/tools-page.vue'
import UpdateDialog from '@/components/update-dialog.vue'

const app = createApp({
  render() {
    return h('div', { class: 'h-full flex flex-col' }, [
      h(Titlebar),
      h(Layout, { currentPage: 'tools' }, () => h(ToolsPage)),
      h(UpdateDialog),
    ])
  },
})

app.mount('#app')
```

注意：Astro 中每个组件用 `client:load` 独立挂载。Vite MPA 中它们共享一个 Vue 应用实例。`h()` 渲染函数替代 Astro 模板，组件的 props 和 slot 行为完全一致。

- [ ] **步骤 3：创建 settings 页面入口**

```html
<!-- packages/toolbox/src/pages/settings/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>工具箱 - 设置</title>
</head>
<body>
  <div id="app" class="h-full flex flex-col">
    <div id="titlebar"></div>
    <div id="layout"></div>
  </div>
  <script type="module" src="./settings.ts"></script>
</body>
</html>
```

```ts
// packages/toolbox/src/pages/settings/settings.ts
import '@/styles/global.css'
import { createApp, h } from 'vue'
import Titlebar from '@/components/titlebar.vue'
import Layout from '@/components/layout.vue'
import SettingsPage from '@/components/pages/settings-page.vue'

const app = createApp({
  render() {
    return h('div', { class: 'h-full flex flex-col' }, [
      h(Titlebar),
      h(Layout, { currentPage: 'settings' }, () => h(SettingsPage)),
    ])
  },
})

app.mount('#app')
```

- [ ] **步骤 4：更新 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

---

## 任务 6：toolbox — 更新依赖和脚本，验证构建

**文件：**
- 修改：`packages/toolbox/package.json`

- [ ] **步骤 1：更新 package.json scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

- [ ] **步骤 2：更新 package.json 依赖**

```json
{
  "dependencies": {
    "@tauri-apps/api": "catalog:",
    "@tauri-apps/plugin-log": "catalog:",
    "@vueuse/core": "catalog:",
    "class-variance-authority": "catalog:",
    "clsx": "catalog:",
    "lucide-vue-next": "catalog:",
    "reka-ui": "catalog:",
    "vue": "catalog:",
    "vue-sonner": "catalog:"
  },
  "devDependencies": {
    "@tailwindcss/vite": "catalog:",
    "@tauri-apps/cli": "catalog:",
    "@vitejs/plugin-vue": "^5",
    "tailwind-merge": "catalog:",
    "tailwindcss": "catalog:",
    "tw-animate-css": "catalog:",
    "typescript": "catalog:",
    "vite": "^6"
  }
}
```

变更摘要：
- 移除：`astro`、`@astrojs/vue`
- 新增：`vite`、`@vitejs/plugin-vue`

- [ ] **步骤 3：安装依赖**

运行：`pnpm install`
预期：成功安装

- [ ] **步骤 4：验证构建**

运行：`pnpm --filter @upgrade-component/toolbox build`
预期：`vite build` 成功

- [ ] **步骤 5：检查输出结构**

运行：`ls -R packages/toolbox/dist/`
预期输出包含：
```
dist/index.html
dist/settings/index.html
dist/assets/
```

关键：`dist/index.html` 在根目录（不是 `dist/index/index.html`）。

如果输出不对，检查 `src/pages/index.html` 是否直接在 `src/pages/` 下（不在子目录中）。

- [ ] **步骤 6：Commit**

```bash
cd packages/toolbox
git add vite.config.ts tsconfig.json package.json pnpm-lock.yaml
git add src/pages/index.html src/pages/index.ts
git add src/pages/settings/
git commit -m "refactor(toolbox): 迁移到 Vite MPA 构建体系"
```

---

## 任务 7：toolbox — 清理 Astro 残留

**文件：**
- 删除：`packages/toolbox/astro.config.mjs`
- 删除：`packages/toolbox/src/pages/index.astro`
- 删除：`packages/toolbox/src/pages/settings.astro`

- [ ] **步骤 1：删除 Astro 文件**

```bash
rm packages/toolbox/astro.config.mjs
rm packages/toolbox/src/pages/index.astro
rm packages/toolbox/src/pages/settings.astro
```

- [ ] **步骤 2：再次验证构建**

运行：`pnpm --filter @upgrade-component/toolbox build`
预期：构建成功

- [ ] **步骤 3：验证 Tauri dev 模式**

运行：`pnpm --filter @upgrade-component/toolbox dev`
预期：Vite dev server 在 `http://localhost:4321` 启动。
访问 `http://localhost:4321/index.html` 应返回 HTML 页面。

- [ ] **步骤 4：Commit**

```bash
git rm packages/toolbox/astro.config.mjs
git rm packages/toolbox/src/pages/index.astro
git rm packages/toolbox/src/pages/settings.astro
git commit -m "refactor(toolbox): 删除 Astro 构建残留文件"
```

---

## 任务 8：更新 catalog 和全局验证

**文件：**
- 修改：`pnpm-workspace.yaml`

- [ ] **步骤 1：更新 pnpm catalog**

在 `pnpm-workspace.yaml` 的 `catalog` 中添加 Vite 相关依赖：

```yaml
catalog:
  # ... 现有条目保持不变 ...

  # Vite（jackcom 和 toolbox 共享）
  vite: "^6"
  "@vitejs/plugin-react": "^4"
  "@vitejs/plugin-vue": "^5"
```

同时将 jackcom 和 toolbox 的 package.json 中对应的依赖改为 `catalog:` 引用：

jackcom devDeps 变更：`"vite": "catalog:"`, `"@vitejs/plugin-react": "catalog:"`
toolbox devDeps 变更：`"vite": "catalog:"`, `"@vitejs/plugin-vue": "catalog:"`

- [ ] **步骤 2：安装依赖**

运行：`pnpm install`
预期：成功安装，catalog 解析正确

- [ ] **步骤 3：全局构建验证**

运行：`pnpm -r build`
预期：所有 4 个包（admin、jackcom、server、toolbox）构建成功

- [ ] **步骤 4：全局测试验证**

运行：`pnpm test`
预期：server 和 jackcom 测试通过

- [ ] **步骤 5：依赖版本一致性检查**

运行：`pnpm list --depth 0 -r`
检查 vite 版本在 jackcom 和 toolbox 中一致。

- [ ] **步骤 6：Commit**

```bash
git add pnpm-workspace.yaml packages/jackcom/package.json packages/toolbox/package.json pnpm-lock.yaml
git commit -m "chore: 将 Vite 相关依赖纳入 pnpm catalog 管理"
```
