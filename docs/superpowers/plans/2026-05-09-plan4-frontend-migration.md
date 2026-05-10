# Plan 4: 前端迁移 — Astro + Vue

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。

**目标：** 将 Wails v3 前端迁移到 Tauri 2，替换所有 Wails runtime 调用为 Tauri API

**架构：** 保留现有 Astro MPA + Vue 3 组件结构，将 `@wailsio/runtime` 和 `wails3/` 调用替换为 `@tauri-apps/api`。使用 Tauri Event 系统替代 Wails Events，使用 `invoke` 替代 Wails 绑定函数。shadcn-vue 组件从旧项目直接复制。

**技术栈：** Astro 6 + Vue 3 + Tauri 2 API + shadcn-vue + TailwindCSS 4

---

## 核心迁移映射

| Wails (旧) | Tauri 2 (新) |
|-------------|-------------|
| `Events.On('event', cb)` | `listen('event', cb)` from `@tauri-apps/api/event` |
| `Browser.OpenURL(url)` | `open(url)` from `@tauri-apps/plugin-opener` 或 `shell.open(url)` |
| `GetInstalledTools()` 等 Wails 绑定 | `invoke('db_query_tools', { filter: 'installed' })` |
| `Install(toolId, version)` | `invoke('tl_install', { toolId, version })` |
| `wails3/.../models` (类型) | 本地 `lib/types.ts` 定义 |
| `createGlobalState` (vueuse) | 保留不变 |

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 创建 | `src/lib/types.ts` | Tool / ToolVersion 类型定义 |
| 创建 | `src/lib/utils.ts` | cn() 工具函数 |
| 创建 | `src/lib/api.ts` | upgrade-component HTTP API 客户端 |
| 创建 | `src/lib/sync.ts` | 同步调度器 |
| 创建 | `src/composables/use-commands.ts` | 封装 Tauri invoke |
| 创建 | `src/composables/useAsyncButton.ts` | 原样迁移 |
| 创建 | `src/stores/tools.ts` | 替换 Wails 调用为 Tauri invoke |
| 创建 | `src/stores/updater.ts` | 替换 Wails 调用为 Tauri invoke + event |
| 创建 | `src/components/layout.vue` | 侧边栏布局（原样迁移） |
| 创建 | `src/components/titlebar.vue` | 自定义标题栏 |
| 创建 | `src/components/tool-card.vue` | 替换 Wails 调用 |
| 创建 | `src/components/update-dialog.vue` | 替换 Wails 调用 |
| 创建 | `src/components/pages/tools-page.vue` | 替换 Wails 调用 |
| 创建 | `src/components/pages/settings-page.vue` | 替换 Wails 调用 |
| 复制 | `src/components/ui/*` | shadcn-vue 组件从旧项目复制 |
| 修改 | `src/pages/index.astro` | 集成 tools-page |
| 修改 | `src/pages/settings.astro` | 集成 settings-page |
| 修改 | `src/styles/global.css` | 完整样式 |
| 修改 | `src/env.d.ts` | 添加 Tauri 类型 |

所有路径相对于 `packages/toolbox/`。

---

### 任务 1：基础类型和工具函数

**文件：**
- 创建：`src/lib/types.ts`
- 创建：`src/lib/utils.ts`
- 修改：`src/env.d.ts`

- [ ] **步骤 1：创建 src/lib/types.ts**

从 Go 结构体和 Wails 类型迁移：

```typescript
export interface Tool {
  id: number
  name: string
  identifier: string
  display_name: string
  version: string
  icon: string
  description: string
  ext: string
  file_path: string
  installed_at: string
  remote_updated_at: string
  local_updated_at: string
  versions: ToolVersion[]
}

export interface ToolVersion {
  id: number
  tool_id: number
  version_id: number
  sequence: string
  size: number
  force: boolean
  changelog: string
  downloaded: boolean
  deleted: boolean
  created_at: string
}

export interface InstallProgress {
  toolId: number
  toolName: string
  status: string
  progress: number
  message: string
}

export interface UpdateInfo {
  version: string
  version_id: number
  size: number
  release_note: string
}

export interface UpdateProgress {
  status: string
  progress: number
  message: string
  version?: string
}

export interface SyncResult {
  success: boolean
  count: number
  message: string
  timestamp: string
}
```

- [ ] **步骤 2：创建 src/lib/utils.ts**

```typescript
import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **步骤 3：更新 src/env.d.ts**

```typescript
/// <reference types="astro/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
```

---

### 任务 2：Tauri Commands 封装

**文件：**
- 创建：`src/composables/use-commands.ts`

- [ ] **步骤 1：创建 src/composables/use-commands.ts**

封装所有 Tauri invoke 调用，替代 Wails 绑定函数：

```typescript
import { invoke } from '@tauri-apps/api/core'
import type { Tool, UpdateInfo } from '@/lib/types'

export async function getInstalledTools(): Promise<Tool[]> {
  return invoke('db_query_tools', { filter: 'installed' })
}

export async function getMarketTools(): Promise<Tool[]> {
  return invoke('db_query_tools', { filter: 'not_installed' })
}

export async function getAllTools(): Promise<Tool[]> {
  return invoke('db_query_tools', { filter: 'all' })
}

export async function installTool(toolId: number, version?: string): Promise<void> {
  return invoke('tl_install', { toolId, version: version || null })
}

export async function uninstallTool(toolId: number): Promise<void> {
  return invoke('tl_uninstall', { toolId })
}

export async function launchTool(filePath: string): Promise<number> {
  return invoke('tl_launch', { filePath })
}

export async function runToolById(toolId: number): Promise<void> {
  const tool = await invoke<Tool>('db_query_tool_by_id', { id: toolId })
  if (!tool.file_path) throw new Error('tool file path is empty')
  await launchTool(tool.file_path)
}

export async function checkUpdate(): Promise<UpdateInfo | null> {
  return invoke('updater_check')
}

export async function downloadUpdate(versionId: number, size: number): Promise<void> {
  return invoke('updater_download', { versionId, size })
}

export async function applyUpdate(): Promise<void> {
  return invoke('updater_apply')
}

export async function syncNow(): Promise<void> {
  return invoke('sync_now')
}

export async function getConfig(key: string): Promise<string> {
  return invoke('config_get', { key })
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  return invoke('config_set', { key, value })
}

export function getManualURL(serverAddr: string, manualPath: string, toolId: number): string {
  return `${serverAddr}${manualPath}?id=${toolId}`
}
```

---

### 任务 3：迁移 Stores

**文件：**
- 创建：`src/stores/tools.ts`
- 创建：`src/stores/updater.ts`

- [ ] **步骤 1：创建 src/stores/tools.ts**

从旧 `stores/tools.ts` 迁移，替换所有 Wails 调用：

```typescript
import { createGlobalState } from '@vueuse/core'
import { listen } from '@tauri-apps/api/event'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { Tool, InstallProgress, SyncResult } from '@/lib/types'
import { getInstalledTools, getMarketTools, installTool, uninstallTool, launchTool } from '@/composables/use-commands'

export const useToolsStore = createGlobalState(() => {
  const installedTools = ref<Tool[]>([])
  const marketTools = ref<Tool[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const installProgress = ref<Record<number, InstallProgress>>({})

  let unlistenInstall: (() => void) | null = null
  let unlistenSync: (() => void) | null = null
  let isSetup = false

  const marketToolsFiltered = computed(() => marketTools.value)

  const hasUpdate = (tool: Tool): boolean => {
    return !!(tool.version && tool.versions.length > 0 && tool.version !== tool.versions[0].sequence)
  }

  const isInstalling = (toolId: number): boolean => {
    const p = installProgress.value[toolId]
    return !!(p && p.status !== 'completed' && p.status !== 'failed')
  }

  const getProgress = (toolId: number): InstallProgress | undefined => {
    return installProgress.value[toolId]
  }

  const fetchTools = async () => {
    loading.value = true
    error.value = null
    try {
      const [installed, market] = await Promise.all([getInstalledTools(), getMarketTools()])
      installedTools.value = installed || []
      marketTools.value = market || []
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '获取工具列表失败'
    }
    finally {
      loading.value = false
    }
  }

  const doInstallTool = async (tool: Tool, versionId?: string) => {
    try {
      await installTool(tool.id, versionId)
      toast.success(`"${tool.display_name || tool.name}" 安装成功`)
      await fetchTools()
    }
    catch (err) {
      toast.error(`"${tool.display_name || tool.name}" 安装失败`, {
        description: err instanceof Error ? err.message : '安装失败',
      })
      throw err
    }
  }

  const doUninstallTool = async (tool: Tool) => {
    try {
      await uninstallTool(tool.id)
      toast.success(`"${tool.display_name || tool.name}" 卸载成功`)
      await fetchTools()
    }
    catch (err) {
      toast.error(`"${tool.display_name || tool.name}" 卸载失败`, {
        description: err instanceof Error ? err.message : '卸载失败',
      })
      throw err
    }
  }

  const runTool = async (tool: Tool) => {
    try {
      await launchTool(tool.file_path)
    }
    catch (err) {
      toast.error(`"${tool.display_name || tool.name}" 启动失败`, {
        description: err instanceof Error ? err.message : '启动失败',
      })
      throw err
    }
  }

  const setupEventListeners = async () => {
    if (isSetup) return
    isSetup = true

    unlistenInstall = await listen<InstallProgress>('tool:install:progress', (event) => {
      installProgress.value[event.payload.toolId] = event.payload
      if (event.payload.status === 'completed' || event.payload.status === 'failed') {
        setTimeout(() => { delete installProgress.value[event.payload.toolId] }, 3000)
      }
    })

    unlistenSync = await listen<SyncResult>('tools:sync:completed', (event) => {
      if (event.payload.success) {
        fetchTools()
        toast.success('同步成功', { description: event.payload.message })
      } else {
        toast.error('同步失败', { description: event.payload.message })
      }
    })
  }

  const cleanupEventListeners = () => {
    unlistenInstall?.()
    unlistenSync?.()
    isSetup = false
  }

  const initialize = async () => {
    await setupEventListeners()
    await fetchTools()
  }

  return {
    installedTools, marketTools, loading, error, installProgress,
    marketToolsFiltered, hasUpdate, isInstalling, getProgress,
    fetchTools, installTool: doInstallTool, uninstallTool: doUninstallTool, runTool,
    initialize, cleanupEventListeners,
  }
})
```

- [ ] **步骤 2：创建 src/stores/updater.ts**

```typescript
import { createGlobalState } from '@vueuse/core'
import { listen } from '@tauri-apps/api/event'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { UpdateInfo, UpdateProgress } from '@/lib/types'
import { checkUpdate, downloadUpdate, applyUpdate } from '@/composables/use-commands'

export const useUpdaterStore = createGlobalState(() => {
  const currentVersion = ref('')
  const updateInfo = ref<UpdateInfo | null>(null)
  const progress = ref<UpdateProgress | null>(null)
  const isChecking = ref(false)
  const showUpdateDialog = ref(false)

  let unlistenProgress: (() => void) | null = null
  let unlistenAvailable: (() => void) | null = null
  let isSetup = false

  const hasUpdate = computed(() => updateInfo.value !== null)
  const isDownloading = computed(() => progress.value?.status === 'downloading' || progress.value?.status === 'installing')
  const isReady = computed(() => progress.value?.status === 'ready')
  const isCompleted = computed(() => progress.value?.status === 'completed')

  const doCheckUpdate = async () => {
    isChecking.value = true
    try {
      const info = await checkUpdate()
      if (info) {
        updateInfo.value = info
        showUpdateDialog.value = true
      }
      return info
    } finally {
      isChecking.value = false
    }
  }

  const doDownloadUpdate = async () => {
    if (!updateInfo.value) return
    try {
      await downloadUpdate(updateInfo.value.version_id, updateInfo.value.size)
    } catch (err) {
      toast.error('下载更新失败', { description: err instanceof Error ? err.message : '下载失败' })
      throw err
    }
  }

  const updateAndRestart = async () => {
    try {
      await doDownloadUpdate()
      await applyUpdate()
    } catch (err) {
      console.error('Update and restart failed:', err)
    }
  }

  const setupEventListeners = async () => {
    if (isSetup) return
    isSetup = true

    unlistenProgress = await listen<UpdateProgress>('app:update:progress', (event) => {
      progress.value = event.payload
      if (event.payload.status === 'completed') toast.success('更新完成')
      else if (event.payload.status === 'failed') toast.error('更新失败', { description: event.payload.message })
    })

    unlistenAvailable = await listen<UpdateInfo>('app:update:available', (event) => {
      updateInfo.value = event.payload
      showUpdateDialog.value = true
    })
  }

  const cleanupEventListeners = () => {
    unlistenProgress?.()
    unlistenAvailable?.()
    isSetup = false
  }

  const initialize = async () => {
    await setupEventListeners()
  }

  const closeDialog = () => {
    if (!progress.value || progress.value.status === 'failed') {
      showUpdateDialog.value = false
    }
  }

  return {
    currentVersion, updateInfo, progress, isChecking, showUpdateDialog,
    hasUpdate, isDownloading, isReady, isCompleted,
    checkUpdate: doCheckUpdate, downloadUpdate: doDownloadUpdate, applyUpdate,
    updateAndRestart, initialize, cleanupEventListeners, closeDialog,
  }
})
```

---

### 任务 4：迁移 Vue 组件

**文件：**
- 复制：`src/components/ui/*` — 从 `toolbox/frontend/src/components/ui/` 直接复制
- 创建：`src/composables/useAsyncButton.ts` — 原样复制
- 创建：`src/components/layout.vue`
- 创建：`src/components/titlebar.vue`
- 创建：`src/components/tool-card.vue`
- 创建：`src/components/update-dialog.vue`
- 创建：`src/components/pages/tools-page.vue`
- 创建：`src/components/pages/settings-page.vue`

- [ ] **步骤 1：复制 shadcn-vue 组件**

从 `toolbox/frontend/src/components/ui/` 复制所有子目录到 `packages/toolbox/src/components/ui/`。

需要复制的目录：`button/`、`card/`、`dialog/`、`dropdown-menu/`、`navigation-menu/`、`popover/`、`progress/`、`sonner/`、`tooltip/`

- [ ] **步骤 2：复制 useAsyncButton.ts**

原样从 `toolbox/frontend/src/composables/useAsyncButton.ts` 复制到 `packages/toolbox/src/composables/useAsyncButton.ts`

- [ ] **步骤 3：创建 layout.vue**

从旧 `layout.vue` 迁移，替换 `<a href="/">` 为 `<a href="/index.html">`：

```vue
<script setup lang="ts">
import { Box, Settings, Wrench } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  currentPage?: 'tools' | 'settings'
}>()
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <aside class="group w-14 hover:w-48 transition-all duration-300 ease-in-out border-r bg-card text-card-foreground flex flex-col overflow-hidden">
      <div class="p-3 border-b flex items-center">
        <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Box class="size-4 text-primary" />
        </div>
        <span class="ml-3 font-bold text-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          工具箱
        </span>
      </div>
      <nav class="flex-1 p-2 space-y-1">
        <a href="/index.html" class="block">
          <Button :variant="currentPage === 'tools' ? 'secondary' : 'ghost'" class="w-full justify-start gap-3 px-2">
            <Wrench class="size-5 shrink-0" />
            <span class="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">工具</span>
          </Button>
        </a>
        <a href="/settings/index.html" class="block">
          <Button :variant="currentPage === 'settings' ? 'secondary' : 'ghost'" class="w-full justify-start gap-3 px-2">
            <Settings class="size-5 shrink-0" />
            <span class="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">设置</span>
          </Button>
        </a>
      </nav>
    </aside>
    <main class="flex-1 overflow-auto p-6">
      <slot />
    </main>
  </div>
</template>
```

- [ ] **步骤 4：创建 titlebar.vue**

新增组件（规格要求），`decorations: false` 后替代原生标题栏：

```vue
<script setup lang="ts">
import { Minus, Square, X } from 'lucide-vue-next'
import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()

async function minimize() {
  await appWindow.minimize()
}

async function toggleMaximize() {
  await appWindow.toggleMaximize()
}

async function close() {
  await appWindow.close()
}
</script>

<template>
  <div
    data-tauri-drag-region
    class="flex items-center h-10 bg-card border-b px-4 select-none"
  >
    <div data-tauri-drag-region class="flex-1 text-sm font-medium">
      工具箱
    </div>
    <div class="flex items-center gap-1">
      <button
        class="p-1.5 rounded hover:bg-muted transition-colors"
        @click="minimize"
      >
        <Minus class="size-4" />
      </button>
      <button
        class="p-1.5 rounded hover:bg-muted transition-colors"
        @click="toggleMaximize"
      >
        <Square class="size-3.5" />
      </button>
      <button
        class="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
        @click="close"
      >
        <X class="size-4" />
      </button>
    </div>
  </div>
</template>
```

- [ ] **步骤 5：创建 tool-card.vue**

从旧 `tool-card.vue` 迁移，关键替换：
- `import type { Tool } from 'wails3/...'` → `import type { Tool } from '@/lib/types'`
- `Browser.OpenURL(url)` → 直接用 `window.open(url)` 或跳过外部浏览器（Tauri 2 中需要 opener 插件）
- `GetManualURL(tool.id)` → 使用 `use-commands.ts` 的 `getManualURL`

完整内容基本与旧版相同，只替换导入和 Browser 调用。由于模板部分不涉及 Wails API，保持不变。

- [ ] **步骤 6：创建 update-dialog.vue**

从旧 `update-dialog.vue` 迁移，只替换 store 引用路径（已通过 stores/updater.ts 迁移）。

- [ ] **步骤 7：创建 pages/tools-page.vue**

从旧 `tools-page.vue` 迁移，不变（只引用 store）。

- [ ] **步骤 8：创建 pages/settings-page.vue**

从旧 `settings-page.vue` 迁移，关键替换：
- `GetAppInfo` → `invoke('config_get', { key: 'app' })` 或硬编码
- `SyncNow` → `invoke('sync_now')`
- 移除 `DbStats` 相关（Tauri 版不暴露 DB 统计信息）

---

### 任务 5：更新 Astro 页面

**文件：**
- 修改：`src/pages/index.astro`
- 修改：`src/pages/settings.astro`
- 修改：`src/styles/global.css`

- [ ] **步骤 1：更新 src/styles/global.css**

```css
@import "tailwindcss";

html, body, #app {
  height: 100%;
  margin: 0;
}
```

- [ ] **步骤 2：重写 src/pages/index.astro**

```astro
---
import '../styles/global.css'
import Layout from '@/components/layout.vue'
import ToolsPage from '@/components/pages/tools-page.vue'
import Titlebar from '@/components/titlebar.vue'
import UpdateDialog from '@/components/update-dialog.vue'
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>工具箱</title>
  </head>
  <body>
    <div id="app" class="h-full flex flex-col">
      <Titlebar client:load />
      <Layout currentPage="tools" client:load>
        <ToolsPage client:load />
      </Layout>
      <UpdateDialog client:load />
    </div>
  </body>
</html>
```

- [ ] **步骤 3：重写 src/pages/settings.astro**

```astro
---
import '../styles/global.css'
import Layout from '@/components/layout.vue'
import SettingsPage from '@/components/pages/settings-page.vue'
import Titlebar from '@/components/titlebar.vue'
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>工具箱 - 设置</title>
  </head>
  <body>
    <div id="app" class="h-full flex flex-col">
      <Titlebar client:load />
      <Layout currentPage="settings" client:load>
        <SettingsPage client:load />
      </Layout>
    </div>
  </body>
</html>
```

- [ ] **步骤 4：构建验证**

```bash
cd D:/Project/upgrade-component/packages/toolbox
pnpm build
```

预期：`dist/` 包含 `index.html` 和 `settings/index.html`

---

### 任务 6：添加 pinia 依赖（可选）

如果使用 Pinia 替代 `createGlobalState`，需要安装并配置。但当前方案使用 `@vueuse/core` 的 `createGlobalState`（与旧项目一致），无需额外依赖。

跳过此任务。

---

### 任务 7：验证前端构建

- [ ] **步骤 1：安装新增依赖**

```bash
cd D:/Project/upgrade-component
pnpm install
```

- [ ] **步骤 2：验证构建**

```bash
cd D:/Project/upgrade-component/packages/toolbox
pnpm build
```

预期：成功生成 dist 目录
