# 桌面应用 CI/CD 构建与发布设计

## 背景

jackit monorepo 包含三个 Tauri 桌面应用（toolbox、jackcom、jacc），目前只能在本地手动构建。需要一套 GitHub Actions 流水线，在打 tag 后自动构建对应应用的安装包，并上传到 GitHub Release Assets 供下载。

## 目标

1. 手动打 tag 触发构建，或通过 workflow_dispatch 手动选择要构建的应用
2. 构建产物为 MSI + NSIS 安装包（x64）
3. 自动创建 GitHub Release 并上传产物到 Assets
4. 版本号从 tag 中提取

## 触发机制

### Tag 格式

统一 tag 格式：`v{version}`，如 `v0.1.0`。

推送 tag 时通过 workflow_dispatch inputs 或 tag push 触发。由于三个应用版本可能不同步，采用 `workflow_dispatch` 为主要触发方式，tag push 为辅助。

### workflow_dispatch 输入

| 输入 | 类型 | 说明 |
|------|------|------|
| tag | string | Release tag，如 `v0.1.0`（必填） |
| build_toolbox | boolean | 是否构建 toolbox，默认 false |
| build_jackcom | boolean | 是否构建 jackcom，默认 false |
| build_jacc | boolean | 是否构建 jacc，默认 false |

### Tag push 触发

当推送 `v*` 格式的 tag 时，自动构建所有三个应用。

## 构建矩阵

```yaml
strategy:
  matrix:
    app: [toolbox, jackcom, jacc]
```

通过条件判断跳过未选中的应用（tag push 时全部构建，workflow_dispatch 时按勾选构建）。

## 构建步骤

每个应用的构建流程：

1. **Checkout** — 检出代码
2. **Setup Node.js** — 安装 Node 20 + pnpm
3. **Setup Rust** — 安装 Rust stable toolchain
4. **Install dependencies** — `pnpm install`
5. **Build frontend** — `pnpm --filter {app} build`（Vite 构建前端）
6. **Build Tauri** — `pnpm --filter {app} tauri build`（Rust 编译 + 打包）
7. **Upload artifacts** — 上传 MSI 和 NSIS 安装包

## 产物命名

| 格式 | 文件名示例 |
|------|-----------|
| NSIS | `jacc_0.1.0_x64_setup.exe` |
| MSI | `jacc_0.1.0_x64.msi` |

版本号从 tag 中提取（去掉 `v` 前缀）。Tauri 默认产物命名已符合此格式，无需额外重命名。

## Release 发布

构建完成后：

1. 使用 `softprops/action-gh-release` 或 `gh release create` 创建 Release
2. 将所有构建产物上传为 Release Assets
3. Release title 为 tag 名称
4. Release body 自动生成 changelog（可选，后续增强）

## 工作流文件

单一工作流文件：`.github/workflows/build-desktop.yml`

## Runner 环境

- `runs-on: windows-latest`
- 架构：x64（仅 x64，暂不支持 ARM）

## 代码结构

```
.github/workflows/
├── build-server.yml          # 已有：server Docker 构建
└── build-desktop.yml         # 新增：桌面应用构建
```

## Secrets 管理

本流水线仅使用 GitHub 内置的 `GITHUB_TOKEN`，无需额外配置 secrets。

## 注意事项

1. Tauri 构建需要 WebView2（Windows runner 已预装）
2. pnpm 版本需与项目 `packageManager` 字段一致
3. Rust 编译缓存可用 `Swatinem/rust-cache` 加速
4. 前端依赖缓存可用 pnpm store cache
5. 矩阵中未选中的应用通过 `if` 条件跳过，不消耗 runner 时间

## 测试要点

1. workflow_dispatch 手动触发，勾选单个应用，验证只构建该应用
2. 推送 `v*` tag，验证三个应用全部构建
3. Release Assets 中包含正确命名的 MSI 和 EXE 文件
4. 产物可正常安装运行
