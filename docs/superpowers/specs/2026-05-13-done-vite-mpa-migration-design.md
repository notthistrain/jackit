# Tauri 应用从 Astro 迁移到 Vite MPA

## 背景

jackcom（React）和 toolbox（Vue）是两个 Tauri 桌面应用，当前使用 Astro 作为前端构建工具。经过评估发现：

- Astro 在这两个项目中仅充当静态打包器，所有 Astro 页面都是 React/Vue 组件的空壳包装（`client:load`）
- Astro 的核心能力（岛屿架构、部分水合、内容集合、SSR）完全未被使用
- 每次版本升级需同步维护 `astro` + `@astrojs/react`/`@astrojs/vue` 集成包的兼容性
- 计划引入 Tauri 多窗口，Vite MPA 的多入口模式更自然

目标：将 jackcom 和 toolbox 从 Astro 迁移到 Vite MPA，简化构建链路，为多窗口架构做准备。

## 方案

用 Vite 的 `rollupOptions.input` 多入口模式替代 Astro 的文件路由。每个 Tauri 窗口对应一个 HTML 入口，React/Vue 组件直接挂载，无需框架包装层。

## 目录结构

以 jackcom 为例（toolbox 同理，React → Vue）：

```
src/
  pages/
    main/
      index.html       ← HTML 入口模板
      main.tsx          ← React 挂载点
    decoder/
      index.html
      decoder.tsx
    waveform/
      index.html
      waveform.tsx
    history/
      index.html
      history.tsx
  components/           ← 不变
  hooks/               ← 不变
  stores/              ← 不变
vite.config.ts         ← 替换 astro.config.mjs
```

`components/`、`hooks/`、`stores/` 完全不变，零改动。

## Vite 配置

### 设计原则

Tauri 桌面应用与 Web 应用的关键区别决定了配置策略：

| 维度 | Web 应用 | Tauri 桌面应用 |
|------|---------|---------------|
| JS 语法目标 | 需兼容旧浏览器 | WebView2/WebKit 均支持 ESNext |
| 资源加载 | 网络传输，需压缩和缓存 | 本地文件系统，无网络开销 |
| Source Map | 需要（线上调试） | 不需要（本地开发已够） |
| CSP 约束 | 通常无 | jackcom 有严格 CSP |
| Base Path | `/` 或 CDN 域名 | 相对路径（本地文件加载） |

### jackcom 配置（React）

```ts
// packages/jackcom/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  base: './',

  build: {
    target: 'esnext',
    sourcemap: false,
    reportCompressedSize: false,
    cssMinify: 'lightningcss',
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/pages/main/index.html'),
        decoder: resolve(__dirname, 'src/pages/decoder/index.html'),
        waveform: resolve(__dirname, 'src/pages/waveform/index.html'),
        history: resolve(__dirname, 'src/pages/history/index.html'),
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

### toolbox 配置（Vue）

```ts
// packages/toolbox/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  base: './',

  build: {
    target: 'esnext',
    sourcemap: false,
    reportCompressedSize: false,
    cssMinify: 'lightningcss',
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/pages/index/index.html'),
        settings: resolve(__dirname, 'src/pages/settings/index.html'),
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

### 配置要点说明

| 配置项 | 值 | 原因 |
|--------|-----|------|
| `base: './'` | 相对路径 | Tauri 从本地文件系统加载，不是 HTTP 服务器 |
| `target: 'esnext'` | 最新语法 | WebView2 (Chromium 120+) 原生支持，无需 polyfill |
| `cssMinify: 'lightningcss'` | LightningCSS | 比 PostCSS 快 100x，Vite 原生支持 |
| `reportCompressedSize: false` | 不报告 | 桌面应用无网络传输，gzip 大小无意义 |
| `sourcemap: false` | 不生成 | 开发时 Vite dev server 已提供源码映射，生产不需要 |
| `assetsInlineLimit: 4096` | 4KB 内联 | 减少本地文件 IO 请求数 |
| `strictPort: true` | 端口严格 | 防止 Tauri devUrl 指向的端口与实际端口不一致 |
| `manualChunks` | 手动分块 | 分离 react/vue/tauri/vendor，多窗口间可复用同一份缓存 |

### jackcom CSP 兼容性

jackcom 的 Tauri CSP 为 `"default-src 'self'; style-src 'self' 'unsafe-inline'"`。

关键约束：**禁止内联 `<script>`**。Vite 默认构建产物不包含内联脚本（全部为外部 `.js` 文件引用），所以天然兼容。但如果使用了需要内联脚本的 Vite 插件，需要在 CSP 中添加 `'unsafe-inline'` 对 script-src 的许可。

## 入口文件

每个页面由一个 HTML 模板 + 一个 JS/TSX 入口组成：

**HTML（`src/pages/main/index.html`）：**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JackCom — Main</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**React 入口（`src/pages/main/main.tsx`）：**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MainApp } from '@/components/MainApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MainApp />
  </StrictMode>
)
```

**Vue 入口（toolbox `src/pages/index/main.ts`）：**

```ts
import { createApp } from 'vue'
import App from '@/components/App.vue'

createApp(App).mount('#root')
```

## 构建产物

与当前 Astro 构建产物结构一致：
- `dist/main/index.html`
- `dist/decoder/index.html`
- `dist/waveform/index.html`
- `dist/history/index.html`

Tauri 的 `frontendDist` 和窗口 URL 配置无需改动。

## 多窗口支持（未来）

新增窗口只需三步：
1. 创建 `src/pages/xxx/index.html` + 入口文件
2. 在 `vite.config.ts` 的 `input` 添加一行
3. 在 Rust 侧 `WindowBuilder` 中 URL 指向 `/xxx/`

一个 HTML 入口 = 一个窗口，1:1 映射。

## 依赖变化

**移除：** `astro`、`@astrojs/react`（jackcom）/ `@astrojs/vue`（toolbox）

**新增：** `@vitejs/plugin-react`（jackcom）/ `@vitejs/plugin-vue`（toolbox）、`vite`

**不变：** React/Vue、TailwindCSS、Tauri 相关、所有业务组件

## 开发体验

| 项目 | 迁移前（Astro） | 迁移后（Vite） |
|------|----------------|---------------|
| dev 命令 | `astro dev` | `vite` |
| 构建命令 | `astro build` | `vite build` |
| HMR | 经 Astro 层 | 原生 Vite HMR |
| Tauri 联调 | `beforeDevCommand: pnpm dev` | 相同（内部从 `astro dev` 变为 `vite`） |

## 不在范围内

- admin 包（非 Tauri 应用，继续使用 Astro）
- server 包（后端服务）
- 业务组件、hooks、stores 的代码改动
