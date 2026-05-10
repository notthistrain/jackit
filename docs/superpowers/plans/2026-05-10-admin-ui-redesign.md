# Admin UI 改版实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 admin 前端从浅色 Shadcn-vue 默认主题迁移到暗色仪表盘风格，Cyan-Blue 渐变主题色，毛玻璃卡片效果。

**架构：** 通过覆盖 Shadcn-vue 的 CSS 变量系统实现暗色主题，新增 Sidebar.vue 组件实现可收缩侧边栏，所有现有 Vue 组件重写模板和样式保持功能逻辑不变。Astro 页面文件调整布局引用。

**技术栈：** Astro 6 + Vue 3 + Shadcn-vue + Tailwind CSS 4 + TipTap

**设计规格：** `docs/superpowers/specs/2026-05-10-admin-ui-redesign-design.md`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/styles/global.css` | 重写 | 暗色主题 CSS 变量 + 渐变/玻璃工具类 + 富文本暗色样式 |
| `src/layouts/main.astro` | 重写 | Sidebar + Header + 内容区三栏布局 |
| `src/layouts/blank.astro` | 重写 | 公开页暗色渐变背景 |
| `src/components/layout/Sidebar.vue` | 新增 | 可收缩侧边栏，导航项 + 收缩逻辑 + localStorage 持久化 |
| `src/components/layout/Header.vue` | 重写 | 面包屑 + 用户头像下拉菜单 |
| `src/components/auth/LoginView.vue` | 重写 | 暗色毛玻璃登录卡片 + 水平表单 |
| `src/components/software/SoftwareTable.vue` | 重写 | 统计卡片 + 暗色表格 + 搜索/新增 |
| `src/components/software/SoftwareDetail.vue` | 重写 | 信息卡片 + 元数据网格 + 版本历史 |
| `src/components/software/VersionTable.vue` | 重写 | 版本列表（左边框高亮 + 操作按钮） |
| `src/components/software/SoftwareCreateDialog.vue` | 重写 | 暗色弹窗 + 水平表单 |
| `src/components/software/SoftwareEditDialog.vue` | 重写 | 暗色弹窗 + 水平表单 |
| `src/components/software/VersionEditDialog.vue` | 重写 | 暗色弹窗 + 水平表单 |
| `src/components/software/ManualView.vue` | 重写 | 纯净富文本展示（无导航元素） |
| `src/components/software/ManualEditor.vue` | 重写 | 暗色 TipTap 工具栏 |
| `src/components/software/DownloadView.vue` | 重写 | 暗色下载卡片（径向光晕 + 毛玻璃） |
| `src/components/logs/LogsTable.vue` | 重写 | 筛选栏 + 暗色表格 + 彩色 tag |
| `src/components/ToastProvider.vue` | 微调 | 暗色主题适配（如需要） |
| `src/pages/index.astro` | 微调 | 适配新布局 |
| `src/pages/software/index.astro` | 微调 | 适配新布局 |
| `src/pages/logs.astro` | 微调 | 适配新布局 |
| `src/pages/login.astro` | 微调 | 适配新布局 |
| `src/pages/manual.astro` | 微调 | 适配新布局 |
| `src/pages/download.astro` | 微调 | 适配新布局 |

---

### 任务 1：暗色主题 CSS 变量系统

**文件：**
- 重写：`packages/admin/src/styles/global.css`

**依赖：** 无

这是整个改版的基础。所有后续组件都依赖这些 CSS 变量。

- [ ] **步骤 1：重写 global.css**

替换整个文件内容，定义暗色主题 CSS 变量，移除浅色主题：

```css
@import "tailwindcss";

@theme inline {
  --color-background: hsl(222 47% 8%);
  --color-foreground: hsl(214 32% 91%);
  --color-card: hsl(222 47% 8%);
  --color-card-foreground: hsl(214 32% 91%);
  --color-popover: hsl(222 47% 8%);
  --color-popover-foreground: hsl(214 32% 91%);
  --color-primary: hsl(188 94% 43%);
  --color-primary-foreground: hsl(0 0% 100%);
  --color-secondary: hsl(215 20% 16%);
  --color-secondary-foreground: hsl(214 32% 91%);
  --color-muted: hsl(215 20% 16%);
  --color-muted-foreground: hsl(215 16% 57%);
  --color-accent: hsl(217 91% 60%);
  --color-accent-foreground: hsl(0 0% 100%);
  --color-destructive: hsl(0 84% 60%);
  --color-destructive-foreground: hsl(0 0% 100%);
  --color-border: hsl(220 13% 15%);
  --color-input: hsl(220 13% 18%);
  --color-ring: hsl(188 94% 43%);
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;

  /* 自定义颜色 */
  --color-dark-bg: #0c1222;
  --color-dark-sidebar: #0a1628;
  --color-dark-sidebar-end: #111d35;
  --color-dark-card-bg: rgba(255, 255, 255, 0.04);
  --color-dark-card-border: rgba(255, 255, 255, 0.08);
  --color-cyan: #06b6d4;
  --color-blue: #3b82f6;
  --color-cyan-text: #67e8f9;
  --color-blue-text: #93c5fd;
  --color-green-text: #6ee7b7;
  --color-red-text: #f87171;
  --color-purple-text: #c4b5fd;
  --color-label: #94a3b8;
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
}

* {
  border-color: hsl(220 13% 15%);
}

body {
  background-color: #0c1222;
  color: hsl(214 32% 91%);
  font-family: system-ui, -apple-system, sans-serif;
}

/* 渐变主题色工具类 */
.bg-gradient-primary {
  background: linear-gradient(135deg, #06b6d4, #3b82f6);
}

/* 毛玻璃卡片 */
.glass-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

/* 暗色输入框 */
.dark-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e2e8f0;
}

.dark-input:focus {
  border-color: #06b6d4;
  outline: none;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
}

.dark-input::placeholder {
  color: #475569;
}

/* 统计卡片变体 */
.stat-card-1 {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(59, 130, 246, 0.12));
  border: 1px solid rgba(6, 182, 212, 0.2);
}

.stat-card-2 {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(99, 102, 241, 0.12));
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.stat-card-3 {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.12));
  border: 1px solid rgba(16, 185, 129, 0.2);
}

/* 操作类型 tag */
.tag-publish {
  background: rgba(6, 182, 212, 0.12);
  color: #67e8f9;
}

.tag-edit {
  background: rgba(59, 130, 246, 0.12);
  color: #93c5fd;
}

.tag-delete {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
}

.tag-create {
  background: rgba(16, 185, 129, 0.12);
  color: #6ee7b7;
}

.tag-auth {
  background: rgba(168, 85, 247, 0.12);
  color: #c4b5fd;
}

/* 说明书富文本样式 */
.manual-content h1 {
  color: #e2e8f0;
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 4px;
}

.manual-content h2 {
  color: #cbd5e1;
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.manual-content p {
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.9;
  margin-bottom: 16px;
}

.manual-content ul,
.manual-content ol {
  color: #94a3b8;
  font-size: 13px;
  line-height: 2;
  padding-left: 20px;
  margin-bottom: 16px;
}

.manual-content code {
  background: rgba(6, 182, 212, 0.1);
  color: #67e8f9;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
}

.manual-content table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 16px;
}

.manual-content th {
  text-align: left;
  color: #64748b;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.manual-content td {
  color: #94a3b8;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.manual-content strong {
  color: #cbd5e1;
}

/* TipTap 编辑器暗色样式 */
.tiptap-editor .tiptap {
  color: #e2e8f0;
  min-height: 300px;
}

.tiptap-editor .tiptap:focus {
  outline: none;
}

.tiptap-toolbar button {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  padding: 3px 6px;
  color: #94a3b8;
  font-size: 12px;
}

.tiptap-toolbar button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tiptap-toolbar button.is-active {
  background: rgba(6, 182, 212, 0.12);
  border: 1px solid rgba(6, 182, 212, 0.25);
  color: #67e8f9;
}
```

- [ ] **步骤 2：启动 dev 验证暗色基础生效**

运行：`pnpm dev:admin`
预期：页面变成暗色背景，文字可见。不需要组件完美，只要基础颜色对。

- [ ] **步骤 3：Commit**

```bash
git add packages/admin/src/styles/global.css
git commit -m "feat(admin): dark theme CSS variable system

Cyan-Blue gradient theme with glass card utilities,
stat card variants, type tags, and manual content styles."
```

---

### 任务 2：可收缩侧边栏组件

**文件：**
- 创建：`packages/admin/src/components/layout/Sidebar.vue`

**依赖：** 任务 1（CSS 变量）

- [ ] **步骤 1：创建 Sidebar.vue**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface NavItem {
  icon: string
  label: string
  href: string
  match: string[]
}

const navItems: NavItem[] = [
  { icon: '📦', label: '软件管理', href: '/', match: ['/', '/software'] },
  { icon: '📋', label: '操作日志', href: '/logs', match: ['/logs'] },
]

const collapsed = ref(false)
const mobileOpen = ref(false)

const currentPath = ref('')

onMounted(() => {
  const stored = localStorage.getItem('sidebar-collapsed')
  if (stored !== null) {
    collapsed.value = stored === 'true'
  }

  currentPath.value = window.location.pathname

  // 响应式：768px 以下默认隐藏
  const mq = window.matchMedia('(max-width: 768px)')
  if (mq.matches) {
    collapsed.value = true
  }
  mq.addEventListener('change', (e) => {
    if (e.matches) {
      collapsed.value = true
      mobileOpen.value = false
    }
  })
})

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem('sidebar-collapsed', String(collapsed.value))
}

function toggleMobile() {
  mobileOpen.value = !mobileOpen.value
}

function isActive(item: NavItem): boolean {
  return item.match.some(m => {
    if (m === '/') return currentPath.value === '/'
    return currentPath.value.startsWith(m)
  })
}

const sidebarWidth = computed(() => collapsed.value ? '56px' : '200px')
</script>

<template>
  <!-- Mobile hamburger -->
  <button
    class="fixed top-2 left-2 z-50 p-2 rounded-lg md:hidden"
    style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);"
    @click="toggleMobile"
  >
    <span style="color: #94a3b8; font-size: 16px;">☰</span>
  </button>

  <!-- Mobile overlay -->
  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-40 md:hidden"
    style="background: rgba(0,0,0,0.5);"
    @click="mobileOpen = false"
  />

  <!-- Sidebar -->
  <aside
    class="flex flex-col h-full shrink-0 transition-all duration-300"
    :class="{ 'fixed z-50 md:relative': mobileOpen, 'hidden md:flex': !mobileOpen }"
    :style="{
      width: sidebarWidth,
      background: 'linear-gradient(180deg, #0a1628, #111d35)',
      borderRight: '1px solid rgba(6,182,212,0.12)',
    }"
  >
    <!-- Logo -->
    <div
      class="flex items-center gap-2 px-3"
      :class="collapsed ? 'justify-center py-3' : 'py-3'"
      style="border-bottom: 1px solid rgba(255,255,255,0.06);"
    >
      <div
        class="shrink-0 flex items-center justify-center rounded-lg bg-gradient-primary"
        style="width:28px; height:28px; font-size:12px;"
      >
        📦
      </div>
      <span
        v-if="!collapsed"
        class="font-semibold whitespace-nowrap"
        style="color: #e2e8f0; font-size: 12px;"
      >
        Upgrade
      </span>
    </div>

    <!-- Nav items -->
    <nav class="flex-1 px-1.5 py-2 space-y-0.5">
      <a
        v-for="item in navItems"
        :key="item.href"
        :href="item.href"
        class="flex items-center gap-2 rounded-md transition-colors"
        :class="collapsed ? 'justify-center px-0 py-1.5' : 'px-2 py-1.5'"
        :style="isActive(item)
          ? 'background: rgba(6,182,212,0.12); border: 1px solid rgba(6,182,212,0.2);'
          : 'border: 1px solid transparent;'"
      >
        <span class="shrink-0" :style="{ fontSize: '13px', opacity: isActive(item) ? '1' : '0.5' }">
          {{ item.icon }}
        </span>
        <span
          v-if="!collapsed"
          class="whitespace-nowrap text-xs font-medium"
          :style="{ color: isActive(item) ? '#67e8f9' : '#94a3b8' }"
        >
          {{ item.label }}
        </span>
      </a>
    </nav>

    <!-- Collapse toggle -->
    <div class="px-1.5 py-2" style="border-top: 1px solid rgba(255,255,255,0.06);">
      <button
        class="flex items-center gap-2 w-full rounded-md px-2 py-1.5 transition-colors"
        :class="collapsed ? 'justify-center' : ''"
        style="color: #94a3b8; font-size: 11px;"
        @click="toggleCollapse"
      >
        <span class="shrink-0">{{ collapsed ? '▶' : '◀' }}</span>
        <span v-if="!collapsed" class="whitespace-nowrap">收起</span>
      </button>
    </div>
  </aside>
</template>
```

- [ ] **步骤 2：Commit**

```bash
git add packages/admin/src/components/layout/Sidebar.vue
git commit -m "feat(admin): collapsible sidebar component

Supports expanded (200px) / collapsed (56px) states with
localStorage persistence and responsive mobile overlay."
```

---

### 任务 3：主布局 + 顶栏重写

**文件：**
- 重写：`packages/admin/src/layouts/main.astro`
- 重写：`packages/admin/src/components/layout/Header.vue`

**依赖：** 任务 1, 任务 2

- [ ] **步骤 1：重写 Header.vue**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { user, logout } = useAuth()
const showMenu = ref(false)

const username = computed(() => user.value?.username || 'Admin')

onMounted(() => {
  document.addEventListener('click', () => {
    showMenu.value = false
  })
})

function handleLogout() {
  logout()
  window.location.href = '/login'
}
</script>

<template>
  <header
    class="flex items-center justify-between px-4 md:px-6"
    style="height: 44px; border-bottom: 1px solid rgba(255,255,255,0.06);"
  >
    <!-- 面包屑 -->
    <div class="flex items-center gap-1 text-xs" style="color: #94a3b8;">
      <slot name="breadcrumb">
        <span>首页</span>
      </slot>
    </div>

    <!-- 右侧 -->
    <div class="flex items-center gap-3">
      <!-- 用户 -->
      <div class="relative">
        <button
          class="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors"
          style="font-size: 12px;"
          @click.stop="showMenu = !showMenu"
        >
          <div
            class="flex items-center justify-center rounded-full"
            style="width:22px; height:22px; background: rgba(6,182,212,0.2); font-size:10px;"
          >
            👤
          </div>
          <span style="color: #cbd5e1;">{{ username }}</span>
        </button>
        <div
          v-if="showMenu"
          class="absolute right-0 top-full mt-1 rounded-lg py-1 z-50"
          style="background: #1e293b; border: 1px solid rgba(255,255,255,0.1); min-width: 120px;"
        >
          <button
            class="w-full text-left px-3 py-1.5 text-xs transition-colors"
            style="color: #94a3b8;"
            @click="handleLogout"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
```

- [ ] **步骤 2：重写 main.astro**

```astro
---
import '@/styles/global.css'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import ToastProvider from '@/components/ToastProvider.vue'

interface Props {
  title: string
}

const { title } = Astro.props
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{title}</title>
  </head>
  <body>
    <div class="flex h-screen overflow-hidden" style="background: #0c1222;">
      <Sidebar client:load />
      <div class="flex flex-1 flex-col overflow-hidden">
        <Header client:load>
          <slot name="breadcrumb" slot="breadcrumb" />
        </Header>
        <main class="flex-1 overflow-auto p-4 md:p-6">
          <slot />
        </main>
      </div>
    </div>
    <ToastProvider client:load />
  </body>
</html>
```

- [ ] **步骤 3：重写 blank.astro**

```astro
---
import '@/styles/global.css'
import ToastProvider from '@/components/ToastProvider.vue'

interface Props {
  title: string
}

const { title } = Astro.props
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{title}</title>
  </head>
  <body style="background: linear-gradient(135deg, #020617, #0c1a3a, #0a1628); min-height: 100vh;">
    <slot />
    <ToastProvider client:load />
  </body>
</html>
```

- [ ] **步骤 4：启动 dev 验证布局**

运行：`pnpm dev:admin`
预期：侧边栏 + 顶栏 + 内容区出现，暗色背景，可收缩。页面内容暂时是原始 slot 内容。

- [ ] **步骤 5：Commit**

```bash
git add packages/admin/src/layouts/main.astro packages/admin/src/layouts/blank.astro packages/admin/src/components/layout/Header.vue
git commit -m "feat(admin): dark layout with sidebar and header

Main layout: collapsible sidebar + breadcrumb header + content area.
Blank layout: full-screen dark gradient for public pages."
```

---

### 任务 4：登录页重写

**文件：**
- 重写：`packages/admin/src/components/auth/LoginView.vue`
- 微调：`packages/admin/src/pages/login.astro`

**依赖：** 任务 3

- [ ] **步骤 1：重写 LoginView.vue**

保持原有的 `useAuth` 调用逻辑、表单验证逻辑不变，只重写 `<template>` 和 `<style>`。

关键变化：
- 移除 Lucide icon 导入（用 emoji 或纯文本替代）
- 全屏渐变背景 + 径向光晕（在 blank.astro 已有）
- 居中毛玻璃卡片 420px 宽
- 表单水平布局：label 64px + input flex:1
- 登录按钮渐变色
- 品牌信息在卡片内顶部

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

const { login } = useAuth()
const toast = useToast()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    toast.error('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await login(username.value, password.value)
    window.location.href = '/'
  }
  catch (err) {
    toast.error('登录失败，请检查用户名和密码')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen relative">
    <!-- 光晕装饰 -->
    <div class="absolute" style="top:-60px; right:-40px; width:300px; height:300px; background: radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%); border-radius:50%;" />
    <div class="absolute" style="bottom:-80px; left:-60px; width:250px; height:250px; background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%); border-radius:50%;" />

    <!-- 登录卡片 -->
    <div
      class="relative"
      style="width: 420px; background: rgba(255,255,255,0.04); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 40px 36px;"
    >
      <!-- 品牌 -->
      <div class="flex items-center gap-2.5 mb-7">
        <div class="flex items-center justify-center rounded-xl bg-gradient-primary" style="width:36px; height:36px; font-size:16px;">
          📦
        </div>
        <div>
          <div style="color: #f1f5f9; font-weight: 600; font-size: 15px;">Upgrade</div>
          <div style="color: #64748b; font-size: 10px;">组件升级管理平台</div>
        </div>
      </div>

      <!-- 表单 -->
      <form @submit.prevent="handleLogin" class="space-y-3.5">
        <div class="flex items-center gap-3">
          <label style="color: #94a3b8; font-size: 12px; min-width: 48px; white-space: nowrap;">用户名</label>
          <input
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            class="flex-1 dark-input px-3 py-2.5 text-xs"
          />
        </div>
        <div class="flex items-center gap-3">
          <label style="color: #94a3b8; font-size: 12px; min-width: 48px; white-space: nowrap;">密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="请输入密码"
            class="flex-1 dark-input px-3 py-2.5 text-xs"
            @keyup.enter="handleLogin"
          />
        </div>
      </form>

      <!-- 登录按钮 -->
      <button
        class="w-full mt-5 rounded-lg py-2.5 text-sm font-medium text-white transition-opacity"
        :class="{ 'opacity-60 cursor-not-allowed': loading }"
        :disabled="loading"
        style="background: linear-gradient(135deg, #06b6d4, #3b82f6);"
        @click="handleLogin"
      >
        {{ loading ? '登录中...' : '登 录' }}
      </button>

      <!-- 底部 -->
      <div class="text-center mt-4" style="color: #475569; font-size: 10px;">
        🔒 安全连接 · Upgrade Admin
      </div>
    </div>
  </div>
</template>
```

- [ ] **步骤 2：微调 login.astro**

```astro
---
import Layout from '@/layouts/blank.astro'
import LoginView from '@/components/auth/LoginView.vue'
---

<Layout title="登录 - Upgrade">
  <LoginView client:only="vue" />
</Layout>
```

- [ ] **步骤 3：启动 dev 验证登录页**

运行：`pnpm dev:admin`
访问 `http://localhost:4321/login`
预期：暗色渐变背景 + 居中毛玻璃卡片 + 水平表单布局。

- [ ] **步骤 4：Commit**

```bash
git add packages/admin/src/components/auth/LoginView.vue packages/admin/src/pages/login.astro
git commit -m "feat(admin): dark glass login page

Horizontal form layout, gradient background with radial glow,
backdrop-filter glass card, gradient submit button."
```

---

### 任务 5：软件管理首页重写

**文件：**
- 重写：`packages/admin/src/components/software/SoftwareTable.vue`
- 微调：`packages/admin/src/pages/index.astro`

**依赖：** 任务 3

- [ ] **步骤 1：重写 SoftwareTable.vue**

保持原有 API 调用逻辑（`useApi` + 分页 + 搜索 + 新增/编辑/删除弹窗触发），重写 `<template>` 暗色主题。关键视觉变化：

- 顶部 3 个统计卡片（stat-card-1/2/3 类名）
- 表格卡片：glass-card 包裹
- 表头：`rgba(255,255,255,0.04)` 背景
- 行 hover：`rgba(255,255,255,0.03)`
- 软件名称前加渐变色图标方块
- 分页当前页渐变色按钮
- "新增" 按钮渐变色

保持原有 props/events 定义不变，SoftwareCreateDialog/EditDialog/DeleteConfirm 的引用不变。

模板结构：
```
<div>
  <!-- 统计卡片行 -->
  <div class="flex gap-4 mb-4">
    <div class="flex-1 stat-card-1 rounded-xl p-4">...</div>
    <div class="flex-1 stat-card-2 rounded-xl p-4">...</div>
    <div class="flex-1 stat-card-3 rounded-xl p-4">...</div>
  </div>

  <!-- 表格卡片 -->
  <div class="glass-card p-4">
    <!-- 标题栏 -->
    <div class="flex justify-between items-center mb-3">
      <span style="color:#e2e8f0; font-size:13px; font-weight:600;">软件列表</span>
      <div class="flex gap-2">
        <input class="dark-input px-2.5 py-1.5 text-xs" placeholder="🔍 搜索..." />
        <button class="bg-gradient-primary rounded-md px-3 py-1.5 text-white text-xs">+ 新增</button>
      </div>
    </div>
    <!-- Table 用 shadcn Table 组件 -->
  </div>

  <!-- Dialogs 保持引用 -->
</div>
```

- [ ] **步骤 2：微调 index.astro**

简化页面结构，移除多余容器，让 SoftwareTable 直接占满内容区：

```astro
---
import Layout from '@/layouts/main.astro'
import SoftwareTable from '@/components/software/SoftwareTable.vue'
---

<Layout title="软件管理 - Upgrade">
  <SoftwareTable client:load />
</Layout>
```

- [ ] **步骤 3：启动 dev 验证**

预期：统计卡片 + 暗色表格 + 搜索/新增按钮可见。

- [ ] **步骤 4：Commit**

```bash
git add packages/admin/src/components/software/SoftwareTable.vue packages/admin/src/pages/index.astro
git commit -m "feat(admin): dark software management page

Stat cards with gradient variants, dark glass table,
search bar and gradient action buttons."
```

---

### 任务 6：软件详情页重写

**文件：**
- 重写：`packages/admin/src/components/software/SoftwareDetail.vue`
- 微调：`packages/admin/src/pages/software/index.astro`

**依赖：** 任务 5

- [ ] **步骤 1：重写 SoftwareDetail.vue**

保持原有 API 调用和版本管理逻辑，重写模板。关键视觉变化：

- 返回链接 "← 返回列表" Cyan 色
- 信息卡片头部：图标 + 名称 + 标识 + "📄 说明书" 按钮（描边次要样式） + "编辑" 按钮（渐变）
- 描述区：半透明底色
- 元数据网格：3 列（最新版本/版本数量/总下载）
- 版本历史卡片：版本项左边框高亮（最新 Cyan，其他淡灰）
- 每个版本行有操作按钮：编辑/下载/删除

新增：说明书按钮的跳转逻辑，点击跳转到 `/manual?id={id}`。

- [ ] **步骤 2：微调 software/index.astro**

```astro
---
import Layout from '@/layouts/main.astro'
import SoftwareDetail from '@/components/software/SoftwareDetail.vue'
---

<Layout title="软件详情 - Upgrade">
  <SoftwareDetail client:load />
</Layout>
```

- [ ] **步骤 3：Commit**

```bash
git add packages/admin/src/components/software/SoftwareDetail.vue packages/admin/src/pages/software/index.astro
git commit -m "feat(admin): dark software detail page

Info card with metadata grid, version history with
border highlight, manual entry button."
```

---

### 任务 7：弹窗组件暗色化

**文件：**
- 重写：`packages/admin/src/components/software/SoftwareCreateDialog.vue`
- 重写：`packages/admin/src/components/software/SoftwareEditDialog.vue`
- 重写：`packages/admin/src/components/software/VersionEditDialog.vue`

**依赖：** 任务 5, 任务 6

- [ ] **步骤 1：重写 SoftwareCreateDialog.vue**

保持原有 props/events/表单逻辑，重写模板。关键变化：

- DialogContent 添加暗色样式：`style="background: linear-gradient(180deg, #111827, #0f172a); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;"`
- 表单全部水平布局：label 64px + input flex:1
- 输入框使用 dark-input 类
- DialogHeader 标题白色，关闭按钮灰色
- DialogFooter：取消描边 + 确认渐变

```vue
<!-- 表单字段示例 -->
<div class="flex items-center gap-3">
  <label class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">软件名称</label>
  <input v-model="form.name" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="如：Toolbox" />
</div>
```

- [ ] **步骤 2：重写 SoftwareEditDialog.vue**

同 SoftwareCreateDialog 的暗色样式，保持编辑回填逻辑不变。

- [ ] **步骤 3：重写 VersionEditDialog.vue**

同上暗色样式。

- [ ] **步骤 4：Commit**

```bash
git add packages/admin/src/components/software/SoftwareCreateDialog.vue packages/admin/src/components/software/SoftwareEditDialog.vue packages/admin/src/components/software/VersionEditDialog.vue
git commit -m "feat(admin): dark dialog components with horizontal form layout

Glass dialog backgrounds, gradient confirm buttons,
horizontal label-input layout across all dialogs."
```

---

### 任务 8：操作日志页重写

**文件：**
- 重写：`packages/admin/src/components/logs/LogsTable.vue`
- 微调：`packages/admin/src/pages/logs.astro`

**依赖：** 任务 3

- [ ] **步骤 1：重写 LogsTable.vue**

保持原有 API 和分页逻辑，重写模板。关键变化：

- 顶部筛选栏：操作类型/操作人下拉 + 日期范围 + 搜索，全部 dark-input 样式
- 类型 tag 使用 CSS 类：tag-publish / tag-edit / tag-delete / tag-create / tag-auth
- 暗色表格

- [ ] **步骤 2：微调 logs.astro**

```astro
---
import Layout from '@/layouts/main.astro'
import LogsTable from '@/components/logs/LogsTable.vue'
---

<Layout title="操作日志 - Upgrade">
  <LogsTable client:load />
</Layout>
```

- [ ] **步骤 3：Commit**

```bash
git add packages/admin/src/components/logs/LogsTable.vue packages/admin/src/pages/logs.astro
git commit -m "feat(admin): dark logs page with colored type tags

Filter bar with dark inputs, semantic type tags
(publish/edit/delete/create/auth)."
```

---

### 任务 9：说明书查看页 + 编辑器重写

**文件：**
- 重写：`packages/admin/src/components/software/ManualView.vue`
- 重写：`packages/admin/src/components/software/ManualEditor.vue`
- 微调：`packages/admin/src/pages/manual.astro`

**依赖：** 任务 3

- [ ] **步骤 1：重写 ManualView.vue（公开页）**

纯净富文本展示。无导航、无按钮。居中单栏 max-width 720px。

```vue
<template>
  <div class="min-h-screen" style="background: #0c1222;">
    <div class="mx-auto px-5 py-10" style="max-width: 720px;">
      <div v-if="loading" class="text-center py-20" style="color: #64748b;">加载中...</div>
      <div v-else-if="error" class="text-center py-20" style="color: #f87171;">{{ error }}</div>
      <div v-else class="manual-content" v-html="content" />

      <div class="mt-6 text-center" style="color: #334155; font-size: 10px;">
        Powered by Upgrade
      </div>
    </div>
  </div>
</template>
```

保持原有 API 获取逻辑。

- [ ] **步骤 2：重写 ManualEditor.vue（管理员）**

暗色 TipTap 编辑器。工具栏按钮使用 tiptap-toolbar 类。保持原有编辑器初始化和保存逻辑。

- [ ] **步骤 3：微调 manual.astro**

```astro
---
import Layout from '@/layouts/blank.astro'
import ManualView from '@/components/software/ManualView.vue'
---

<Layout title="操作说明书 - Upgrade">
  <ManualView client:load />
</Layout>
```

- [ ] **步骤 4：Commit**

```bash
git add packages/admin/src/components/software/ManualView.vue packages/admin/src/components/software/ManualEditor.vue packages/admin/src/pages/manual.astro
git commit -m "feat(admin): dark manual view and editor

Clean public view (no navigation), dark TipTap editor
with cyan active toolbar states."
```

---

### 任务 10：下载页重写

**文件：**
- 重写：`packages/admin/src/components/software/DownloadView.vue`
- 微调：`packages/admin/src/pages/download.astro`

**依赖：** 任务 3

- [ ] **步骤 1：重写 DownloadView.vue**

居中毛玻璃下载卡片。移除 Lucide 导入。

```vue
<template>
  <div class="flex items-center justify-center min-h-screen relative">
    <!-- 光晕 -->
    <div class="absolute" style="top:20%; left:50%; transform:translateX(-50%); width:400px; height:200px; background: radial-gradient(ellipse, rgba(6,182,212,0.06) 0%, transparent 70%);" />

    <!-- 下载卡片 -->
    <div class="relative text-center" style="width:320px; background: rgba(255,255,255,0.04); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 36px 32px;">
      <!-- 图标 -->
      <div class="mx-auto mb-4 flex items-center justify-center rounded-xl" style="width:56px; height:56px; background: linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.2)); font-size:24px;">
        📦
      </div>

      <div style="color:#f1f5f9; font-size:18px; font-weight:600; margin-bottom:4px;">
        Toolbox 工具盒
      </div>
      <div style="color:#64748b; font-size:11px; margin-bottom:20px;">
        组件升级管理客户端
      </div>

      <!-- 版本信息 -->
      <div class="flex justify-center gap-4 mb-5">
        <div>
          <div style="color:#67e8f9; font-size:14px; font-weight:600;">{{ version || '—' }}</div>
          <div style="color:#475569; font-size:9px;">最新版本</div>
        </div>
        <div style="width:1px; background: rgba(255,255,255,0.08);"></div>
        <div>
          <div style="color:#e2e8f0; font-size:14px; font-weight:600;">{{ size || '—' }}</div>
          <div style="color:#475569; font-size:9px;">Windows</div>
        </div>
      </div>

      <!-- 下载按钮 -->
      <button
        class="w-full rounded-lg py-2.5 text-white text-sm font-medium transition-opacity"
        :class="{ 'opacity-60': downloading }"
        :disabled="downloading"
        style="background: linear-gradient(135deg, #06b6d4, #3b82f6);"
        @click="handleDownload"
      >
        {{ downloading ? '获取下载链接...' : '⬇ 立即下载' }}
      </button>

      <div v-if="error" class="mt-3 text-xs" style="color: #f87171;">{{ error }}</div>

      <div class="mt-3" style="color:#475569; font-size:9px;">
        适用于 Windows 10/11
      </div>
    </div>
  </div>
</template>
```

- [ ] **步骤 2：微调 download.astro**

```astro
---
import Layout from '@/layouts/blank.astro'
import DownloadView from '@/components/software/DownloadView.vue'
---

<Layout title="下载 - Upgrade">
  <DownloadView client:load />
</Layout>
```

- [ ] **步骤 3：Commit**

```bash
git add packages/admin/src/components/software/DownloadView.vue packages/admin/src/pages/download.astro
git commit -m "feat(admin): dark download page with glass card

Radial glow background, glass download card with
version info and gradient button."
```

---

### 任务 11：全局检查与清理

**文件：**
- 检查：所有已修改的文件
- 微调：`packages/admin/src/components/ToastProvider.vue`（如需暗色适配）
- 微调：`packages/admin/components.json`（更新 shadcn 配色）

**依赖：** 任务 1-10

- [ ] **步骤 1：全局 dev 验证**

运行：`pnpm dev:admin`

逐页检查：
1. `/login` — 登录页暗色毛玻璃
2. `/` — 软件管理统计卡片 + 表格
3. `/software?id=1` — 详情页信息卡片 + 版本列表
4. `/logs` — 操作日志筛选 + 表格 + 彩色 tag
5. `/manual?id=1` — 纯净说明书展示
6. `/download` — 下载卡片
7. 侧边栏收缩/展开
8. 响应式：缩小浏览器窗口到 768px 以下

- [ ] **步骤 2：build 验证**

运行：`pnpm --filter @upgrade-component/admin build`
预期：构建成功，产物输出到 `packages/server/admin/`。

- [ ] **步骤 3：清理无用代码**

- 检查 `useTheme.ts` — 暗色主题现在是默认且唯一的主题，可以简化为不再切换亮暗（如果用户确认不需要亮色模式）。如果保留切换功能，确保切换后 CSS 变量正确覆盖。
- 移除不再需要的 Lucide icon 导入
- 更新 `components.json` 中的 baseColor 为自定义暗色

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "chore(admin): cleanup after UI redesign

Simplify theme composable, remove unused imports,
update shadcn config for dark theme."
```
