# Toolbox Tauri 2 + pnpm Monorepo 重构设计

## 概述

将 toolbox（Wails 3 桌面应用）用 Tauri 2 重构，并将 svnlink 和 toolbox 以 pnpm monorepo 集成到统一目录下。

**核心原则**：Rust 负责系统级能力（数据库、文件操作、配置、自更新），TypeScript 负责业务逻辑（API 通信、同步调度、UI 状态管理）。

## Monorepo 结构

```
upgrade-component/                    # 根目录
├── package.json                      # workspace root (private)
├── pnpm-workspace.yaml               # packages: ['packages/*']
├── pnpm-lock.yaml
├── packages/
│   ├── server/                       # svnlink server (Midway.js，原样迁移)
│   ├── admin/                        # svnlink admin (Astro + Vue，原样迁移)
│   └── toolbox/                      # Tauri 2 桌面应用
│       ├── package.json              # 前端依赖 (Astro, Vue, TailwindCSS, shadcn-vue)
│       ├── astro.config.mjs          # Astro 配置（MPA 模式）
│       ├── components.json           # shadcn-vue 配置
│       ├── src-tauri/                # Rust 后端
│       │   ├── Cargo.toml
│       │   ├── tauri.conf.json
│       │   ├── capabilities/
│       │   └── src/
│       │       ├── main.rs
│       │       ├── lib.rs
│       │       ├── db/
│       │       ├── fs/
│       │       ├── config/
│       │       └── updater/
│       ├── src/                      # Astro + Vue 前端
│       │   ├── pages/
│       │   ├── components/
│       │   ├── composables/
│       │   ├── stores/
│       │   ├── lib/
│       │   └── styles/
│       └── public/
└── CLAUDE.md
```

- svnlink 的 `server/` 和 `admin/` 从 `svnlink/packages/` 提升到根 `packages/`
- 各包独立，不共享代码

## Rust 模块设计

### 目录结构

```
src-tauri/src/
├── main.rs              # 入口，初始化 Tauri app
├── lib.rs               # 注册所有 #[tauri::command]
├── db/
│   ├── mod.rs
│   ├── init.rs          # 数据库初始化（SQLite）
│   └── models.rs        # 工具表、版本表实体定义
├── fs/
│   ├── mod.rs
│   ├── install.rs       # 工具安装（下载→解压→写入目标目录）
│   ├── uninstall.rs     # 工具卸载（删除目录/文件）
│   └── launch.rs        # 启动工具（spawn 进程）
├── config/
│   ├── mod.rs
│   └── settings.rs      # YAML 配置读写（server URL、同步间隔等）
└── updater/
    ├── mod.rs
    ├── check.rs          # 调 svnlink API 对比版本
    ├── download.rs       # 下载 .new 文件 + 进度事件
    ├── apply.rs          # 生成 bat 脚本 → 替换 exe → 重启
    └── cleanup.rs        # 清理 .old/.new 残留文件
```

### 依赖选型

| 用途 | crate |
|------|-------|
| 数据库 | `rusqlite` |
| 配置 | `serde_yaml` |
| 日志 | `log` + `tauri-plugin-log` |
| HTTP（仅 updater 用） | `reqwest` |
| 进度通知 | Tauri Event 系统 |

### Tauri Commands（IPC 接口）

**数据库操作**：

| 命令 | 功能 | 参数 | 返回 |
|------|------|------|------|
| `db_query_tools` | 查询已安装工具列表 | filter? | `Vec<Tool>` |
| `db_upsert_tool` | 新增/更新工具记录 | Tool | `()` |
| `db_delete_tool` | 删除工具记录 | id | `()` |

**工具操作**：

| 命令 | 功能 | 参数 | 返回 |
|------|------|------|------|
| `tl_install` | 安装工具 | url, target_path | 进度事件流 |
| `tl_uninstall` | 卸载工具 | path | `()` |
| `tl_launch` | 启动工具 | path, args? | pid |

**配置操作**：

| 命令 | 功能 | 参数 | 返回 |
|------|------|------|------|
| `config_get` | 读取配置 | key | value |
| `config_set` | 写入配置 | key, value | `()` |

**自更新**：

| 命令 | 功能 | 返回 |
|------|------|------|
| `updater_check` | 调 svnlink API 检查新版本 | `Option<UpdateInfo>` |
| `updater_download` | 下载更新包 | 进度事件流 |
| `updater_apply` | 生成 bat 脚本并重启 | `()` |

## 前端架构

### 技术栈

- **框架**：Astro MPA + Vue 3（Composition API）
- **样式**：TailwindCSS
- **组件库**：shadcn-vue（通过 CLI 命令添加组件到项目源码）
- **状态管理**：Pinia
- **通知**：vue-sonner
- **图标**：lucide-vue-next

### 页面结构

两个 HTML 页面，同一个窗口内通过 `<a href>` 导航：

- `pages/index.astro` → 工具列表页（主页面）
- `pages/settings.astro` → 设置页

### 自定义菜单栏

窗口设置 `decorations: false`，用 `titlebar.vue` 替代原生标题栏：

```
┌─────────────────────────────────────────────────┐
│ 📦 工具箱   │  工具  │  设置  │         ─  □  ✕  │
├─────────────────────────────────────────────────┤
│              页面内容区域                         │
└─────────────────────────────────────────────────┘
```

- **左侧**：Logo + 应用名
- **中部**：导航菜单（`<a href="/index.html">工具</a>` | `<a href="/settings.html">设置</a>`），当前页面高亮
- **右侧**：最小化 / 最大化 / 关闭（调用 Tauri window API）
- 整个标题栏设置 `data-tauri-drag-region` 支持拖拽

两个页面都引入 `titlebar.vue`。

### 前端目录结构

```
src/
├── pages/
│   ├── index.astro              # 工具列表页
│   └── settings.astro           # 设置页
├── components/
│   ├── ui/                      # shadcn-vue 组件（CLI 生成）
│   ├── titlebar.vue             # 自定义标题栏/菜单栏
│   ├── tool-card.vue            # 工具卡片
│   ├── update-dialog.vue        # 更新对话框
│   └── pages/
│       ├── tools-page.vue       # 工具页逻辑
│       └── settings-page.vue    # 设置页逻辑
├── composables/
│   ├── use-commands.ts          # 封装 Tauri invoke 调用
│   └── use-sync.ts              # 远程同步逻辑
├── stores/
│   └── tools.ts                 # Pinia store
├── lib/
│   ├── api.ts                   # svnlink HTTP API 客户端
│   ├── types.ts                 # 类型定义
│   └── sync.ts                  # 同步调度器（5h 定时）
├── styles/
│   └── global.css               # TailwindCSS 入口
└── env.d.ts                     # Tauri 类型声明
```

### Tauri 窗口配置

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "url": "/index.html",
        "title": "工具箱",
        "decorations": false
      }
    ]
  }
}
```

## 数据流与同步

### 工具列表数据流

```
svnlink API ──fetch──→ lib/api.ts ──→ lib/sync.ts ──→ invoke('db_upsert_tool') ──→ SQLite
                                                                          ↓
Vue 组件 ←── Pinia store ←── invoke('db_query_tools') ←──────────────── SQLite
```

### 同步调度器（`lib/sync.ts`）

- 启动时立即执行一次同步
- 每 5 小时 `setInterval` 再次同步
- 用户可手动触发（下拉刷新）
- 流程：调用 `api.ts` 拉取远程工具列表 → 对比本地数据库版本 → 有差异则 invoke 写入

### 工具安装流程

```
用户点击安装 → invoke('tl_install', {url, path}) → Rust 下载解压
                                                    ↓
                                            emit('install-progress', {percent})
                                                    ↓
                                            前端监听事件更新进度条
                                                    ↓
                                            完成后 invoke('db_upsert_tool') 更新状态
```

## 自更新机制

复刻现有 Wails 3 的 Go 逻辑，不使用 tauri-plugin-updater：

1. **启动时**：`cleanup` 清理残留的 `.old` / `.new` 文件
2. **检查更新**：从 svnlink API 获取最新版本号，与当前版本对比
3. **下载**：下载新版本到 `<exe_path>.new`，通过 Tauri event 推送进度
4. **应用更新**：生成 Windows bat 脚本（等待进程退出 → 重命名 → 替换 → 重启），然后退出当前进程

## 功能范围（1:1 复刻）

- 工具浏览/安装/卸载/运行
- 远程同步（5 小时间隔）
- 自动更新检查与应用
- 设置页面
- 自定义标题栏/菜单栏
- 多页面（index + settings）
