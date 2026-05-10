# Admin UI 改版设计

日期：2026-05-10

## 概述

对 admin 前端进行全面 UI 改版，从当前的 Shadcn-vue 默认浅色主题迁移到暗色仪表盘风格，采用 Cyan-Blue 渐变主题色，毛玻璃卡片效果。

### 设计方向

- **视觉风格**: 暗色外壳 + 渐变玻璃卡片
- **配色方案**: Cyan (#06b6d4) → Blue (#3b82f6) 渐变
- **布局**: 可收缩侧边栏 + 顶栏 + 内容区
- **响应式**: 基本响应式（关键页面平板/手机可用）

### 不改的部分

- Astro + Vue 3 架构
- 路由结构（Astro 文件路由）
- API 层（useApi / useAuth composable）
- 构建产物路径（输出到 ../server/admin）

---

## 色彩系统

### 主色调

| 用途 | 值 | 说明 |
|------|------|------|
| 背景底色 | `#0c1222` | 主背景，深蓝黑 |
| 侧边栏 | `#0a1628` → `#111d35` | 从上到下微渐变 |
| 内容卡片 | `rgba(255,255,255,0.04)` | 半透明毛玻璃 |
| 卡片边框 | `rgba(255,255,255,0.08)` | 微弱可见边框 |
| 主题渐变 | `#06b6d4` → `#3b82f6` | Cyan → Blue |
| 主要文字 | `#e2e8f0` | 标题、重要信息 |
| 次要文字 | `#94a3b8` | 正文、描述 |
| 辅助文字 | `#64748b` | 标签、占位符 |

### 语义色

| 类型 | 值 | 用途 |
|------|------|------|
| 成功/最新 | `#22c55e` | 最新版本标记、成功状态 |
| 危险/删除 | `#ef4444` → `#f87171` | 删除操作、错误提示 |
| 警告 | `#f59e0b` | 警告信息 |

### 统计卡片渐变

每个卡片使用主题色的不同角度变体：

- 卡片 1: `rgba(6,182,212,0.12)` → `rgba(59,130,246,0.12)` + `border: rgba(6,182,212,0.2)`
- 卡片 2: `rgba(59,130,246,0.12)` → `rgba(99,102,241,0.12)` + `border: rgba(59,130,246,0.2)`
- 卡片 3: `rgba(16,185,129,0.12)` → `rgba(6,182,212,0.12)` + `border: rgba(16,185,129,0.2)`

---

## 布局系统

### 管理后台布局（main.astro）

```
┌──────────────────────────────────────────────┐
│ [Sidebar]  │  [Top Bar - 44px]              │
│            │  面包屑          用户头像       │
│  展开状态  ├──────────────────────────────────│
│  200px     │                                  │
│  收起状态  │  [Content Area - padding 24px]  │
│  56px      │                                  │
│            │  卡片间距: 16px                  │
│            │                                  │
│ [收起按钮] │                                  │
└──────────────────────────────────────────────┘
```

### 侧边栏 (Sidebar.vue)

- **展开状态**: 200px 宽，显示图标 + 文字
- **收起状态**: 56px 宽，只显示图标
- **导航项**:
  - 📦 软件管理（首页）
  - 📋 操作日志
  - ⚙️ 系统设置
- **选中态**: `background: rgba(6,182,212,0.12); border: 1px solid rgba(6,182,212,0.2); color: #67e8f9`
- **底部**: 收起/展开按钮
- **状态持久化**: localStorage
- **背景**: `linear-gradient(180deg, #0a1628, #111d35)`

### 顶栏 (Header.vue)

- **高度**: 44px
- **左侧**: 面包屑导航（如 "首页 / 软件管理"）
- **右侧**: 暗色模式切换 + 用户头像 + 下拉菜单（退出登录）

### 响应式断点

| 断点 | 行为 |
|------|------|
| ≥1024px | 默认展开侧边栏 |
| 768-1024px | 默认收起侧边栏 |
| <768px | 侧边栏隐藏，通过 hamburger 按钮呼出 overlay |

### 公开页布局（blank.astro）

- 无侧边栏、无顶栏
- 全屏暗色渐变背景或纯内容
- 用于登录页、说明书查看页、下载页

---

## 页面设计

### 1. 登录页 (`/login`)

- **布局**: blank.astro，全屏居中
- **背景**: `linear-gradient(135deg, #020617, #0c1a3a, #0a1628)` + 两个径向光晕装饰（Cyan/Blue 低透明度）
- **登录卡片**: 420px 宽，`backdrop-filter: blur(20px)`，圆角 16px
- **表单布局**: label 左 (64px 固定宽) + 输入框右 (flex:1)
- **输入框**: `background: rgba(255,255,255,0.06)`，focus 时边框 Cyan 亮色
- **登录按钮**: 主题渐变色
- **品牌**: 左上角 Logo + 名称 "Upgrade · 组件升级管理平台"

### 2. 软件管理首页 (`/`)

- **统计卡片行**: 3 个渐变统计卡片（总软件/本周更新/总下载）
- **表格卡片**:
  - 标题栏: "软件列表" + 搜索框 + "新增" 渐变按钮
  - 表格列: 名称（带图标+颜色块）/ 标识 / 最新版本（Cyan 色）/ 更新时间 / 操作
  - 行 hover: `background: rgba(255,255,255,0.03)`
  - 分页: 底部居中，当前页用渐变色

### 3. 软件详情页 (`/software?id={id}`)

- **返回链接**: "← 返回列表"，Cyan 色
- **信息卡片**:
  - 头部: 图标 + 名称 + 标识描述 + "📄 说明书" 按钮（描边次要样式）+ "编辑" 按钮（渐变主样式）
  - 描述区: 半透明底色，圆角
  - 元数据网格: 3 列（最新版本/版本数量/总下载）
- **版本历史卡片**:
  - 标题栏: "版本历史" + "发布版本" 渐变按钮
  - 版本项: 左边框高亮（最新=Cyan，其他=淡灰），显示版本号/最新标记/大小/日期/更新日志/操作按钮（编辑/下载/删除）

### 4. 操作日志 (`/logs`)

- **筛选栏**: 操作类型下拉 + 操作人下拉 + 日期范围 + 搜索
- **表格卡片**:
  - 列: 时间 / 操作人 / 操作内容 / 类型（彩色 tag） / IP
  - 类型 tag 颜色:
    - 发布: `rgba(6,182,212,0.12)` bg + `#67e8f9` text
    - 编辑: `rgba(59,130,246,0.12)` bg + `#93c5fd` text
    - 删除: `rgba(239,68,68,0.12)` bg + `#f87171` text
    - 新增: `rgba(16,185,129,0.12)` bg + `#6ee7b7` text
    - 认证: `rgba(168,85,247,0.12)` bg + `#c4b5fd` text

### 5. 说明书查看页 (`/manual?id={id}`) — 公开匿名

- **布局**: blank.astro，无侧边栏、无顶栏、无任何导航元素
- **内容**: 纯富文本展示，居中单栏 (max-width 720px)
- **排版**:
  - H1: 26px, `#e2e8f0`, bold 700
  - H2: 17px, `#cbd5e1`, bold 600
  - 正文: 13px, `#94a3b8`, line-height 1.9
  - 代码: `background: rgba(6,182,212,0.1)`, `color: #67e8f9`
  - 表格: 暗色半透明行，细线边框
  - 列表: 左缩进 20px
- **底部**: 细线分隔 + "Powered by Upgrade"
- **无下载功能**: 用户通过 Toolbox 客户端下载软件

### 6. 下载页 (`/download`) — 公开匿名

- **布局**: blank.astro，无侧边栏、无顶栏
- **背景**: 暗色 + 居中径向光晕
- **下载卡片**: 320px 宽，毛玻璃效果
  - 图标 (56px 圆角方块，渐变底)
  - 软件名称 + 描述
  - 版本信息 (版本号 | 文件大小)
  - 渐变下载按钮
  - 系统要求提示
- **用途**: 仅用于下载 Toolbox 本身

### 7. 说明书编辑 — 管理员内部

- **入口**: 软件详情页的 "📄 说明书" 按钮
- **顶栏**: 面包屑（← 返回详情 / 编辑说明书）+ "预览" + "保存" 按钮
- **编辑器**: TipTap 富文本，暗色主题
  - 工具栏: H1/H2/H3 | B/I/U | 列表/排序/表格/代码/链接/图片
  - 按钮默认: `rgba(255,255,255,0.06)` bg + `#94a3b8` text
  - 选中态: `rgba(6,182,212,0.12)` bg + `border: rgba(6,182,212,0.25)` + `#67e8f9` text
  - 编辑区宽度与公开查看页一致，所见即所得

---

## 组件规范

### 表单统一规则

- 所有表单统一 **label 左 + 输入右** 水平布局
- label 固定宽度 64px，输入控件 flex:1
- 多行文本 (textarea) label 顶部对齐 (align-items: flex-start)

### 弹窗组件

- 遮罩: `rgba(0,0,0,0.5)`
- 弹窗背景: `linear-gradient(180deg, #111827, #0f172a)` + `border: rgba(255,255,255,0.1)`
- 圆角: 14px，阴影: `0 25px 50px rgba(0,0,0,0.4)`
- 头部: 标题 + 关闭按钮，底部细线
- 底部: "取消"（描边） + "确认"（渐变），右对齐
- 表单使用水平布局

### 表格

- 表头: `rgba(255,255,255,0.04)` bg，大写字母间距
- 数据行: 细线分隔 `rgba(255,255,255,0.04)`
- Hover: `rgba(255,255,255,0.03)`

### 按钮

| 类型 | 样式 |
|------|------|
| 主要操作 | `background: linear-gradient(135deg, #06b6d4, #3b82f6)` 白字 |
| 次要操作 | `background: rgba(6,182,212,0.1)` + `border: rgba(6,182,212,0.25)` Cyan 字 |
| 普通 | `background: rgba(255,255,255,0.06)` + `border: rgba(255,255,255,0.1)` 灰字 |
| 危险 | `background: rgba(239,68,68,0.1)` 红字 |

---

## 技术实现要点

### CSS 变量

在 `global.css` 中定义暗色主题 CSS 变量，覆盖 Shadcn-vue 默认主题：

```css
:root {
  --background: 222 47% 8%;         /* #0c1222 */
  --foreground: 214 32% 91%;        /* #e2e8f0 */
  --card: 222 47% 8%;
  --border: 220 13% 15%;
  --primary: 188 94% 43%;           /* #06b6d4 cyan */
  --primary-foreground: 0 0% 100%;
  --muted: 215 20% 16%;
  --muted-foreground: 215 16% 57%;  /* #94a3b8 */
  --accent: 217 91% 60%;            /* #3b82f6 blue */
  /* ... */
}
```

### 新增/重写文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/styles/global.css` | 重写 | 暗色主题 CSS 变量 + 渐变/玻璃工具类 |
| `src/layouts/main.astro` | 重写 | 侧边栏 + 顶栏 + 内容区布局 |
| `src/layouts/blank.astro` | 重写 | 公开页暗色背景 |
| `src/components/layout/Sidebar.vue` | 新增 | 可收缩侧边栏 |
| `src/components/layout/Header.vue` | 重写 | 面包屑 + 用户菜单 |
| `src/components/auth/LoginView.vue` | 重写 | 暗色毛玻璃登录 |
| `src/components/software/SoftwareTable.vue` | 重写 | 暗色表格 |
| `src/components/software/SoftwareDetail.vue` | 重写 | 暗色详情页 |
| `src/components/software/VersionTable.vue` | 重写 | 暗色版本列表 |
| `src/components/software/SoftwareCreateDialog.vue` | 重写 | 暗色弹窗 + 水平表单 |
| `src/components/software/SoftwareEditDialog.vue` | 重写 | 同上 |
| `src/components/software/VersionEditDialog.vue` | 重写 | 同上 |
| `src/components/software/ManualView.vue` | 重写 | 纯净富文本展示 |
| `src/components/software/ManualEditor.vue` | 重写 | 暗色 TipTap 编辑器 |
| `src/components/software/DownloadView.vue` | 重写 | 暗色下载卡片 |
| `src/components/logs/LogsTable.vue` | 重写 | 暗色日志表格 + 彩色 tag |
| `src/components/ToastProvider.vue` | 调整 | 暗色主题适配 |
| `components.json` | 修改 | 更新 Shadcn 配色 |

### 不新增的内容

- 不引入新 UI 库，继续用 Shadcn-vue
- 不改 Astro 路由结构
- 不改 API 调用逻辑
- 不改 Shadcn-vue 基础组件（Button, Dialog, Table 等）的内部实现，通过 CSS 变量覆盖主题
