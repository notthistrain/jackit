# 桌面应用 CI/CD 构建流水线实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建 GitHub Actions 工作流，在打 tag 或手动触发时构建 Tauri 桌面应用（toolbox/jackcom/jacc）并上传安装包到 GitHub Release Assets。

**架构：** 单一 workflow 文件，使用 matrix strategy 并行构建三个应用。通过 `workflow_dispatch` inputs 选择构建目标，tag push 时全量构建。构建产物通过 `softprops/action-gh-release` 上传到 Release。

**技术栈：** GitHub Actions, Tauri 2, pnpm 10.30.3, Node 22, Rust stable, Windows runner

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `.github/workflows/build-desktop.yml` | 新增：桌面应用构建与发布工作流 |
| `packages/toolbox/src-tauri/tauri.conf.json` | 修改：补充缺失的 bundle 配置 |

---

### 任务 1：补充 toolbox 的 bundle 配置

toolbox 的 `tauri.conf.json` 缺少 `bundle` 配置节，无法生成 MSI/NSIS 安装包。需要补充。

**文件：**
- 修改：`packages/toolbox/src-tauri/tauri.conf.json`

- [ ] **步骤 1：添加 bundle 配置**

在 `packages/toolbox/src-tauri/tauri.conf.json` 的顶层对象中添加 `bundle` 字段（与 `app` 同级）：

```json
"bundle": {
  "active": true,
  "targets": ["msi", "nsis"],
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.ico"
  ]
}
```

- [ ] **步骤 2：验证配置有效**

运行：`cd packages/toolbox/src-tauri && cargo check`
预期：编译检查通过，无错误

- [ ] **步骤 3：Commit**

```bash
git add packages/toolbox/src-tauri/tauri.conf.json
git commit -m "chore(toolbox): 添加 bundle 配置以支持 MSI/NSIS 构建"
```

---

### 任务 2：创建 build-desktop.yml 工作流

**文件：**
- 创建：`.github/workflows/build-desktop.yml`

- [ ] **步骤 1：创建工作流文件**

创建 `.github/workflows/build-desktop.yml`，完整内容如下：

```yaml
name: Build Desktop Apps

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag (e.g. v0.1.0)'
        required: true
        type: string
      build_toolbox:
        description: 'Build toolbox'
        required: false
        type: boolean
        default: false
      build_jackcom:
        description: 'Build jackcom'
        required: false
        type: boolean
        default: false
      build_jacc:
        description: 'Build jacc'
        required: false
        type: boolean
        default: false

jobs:
  build:
    runs-on: windows-latest
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        app: [toolbox, jackcom, jacc]

    steps:
      - name: Check if app should build
        id: check
        shell: bash
        run: |
          if [ "${{ github.event_name }}" = "push" ]; then
            echo "should_build=true" >> $GITHUB_OUTPUT
          else
            case "${{ matrix.app }}" in
              toolbox) echo "should_build=${{ inputs.build_toolbox }}" >> $GITHUB_OUTPUT ;;
              jackcom) echo "should_build=${{ inputs.build_jackcom }}" >> $GITHUB_OUTPUT ;;
              jacc) echo "should_build=${{ inputs.build_jacc }}" >> $GITHUB_OUTPUT ;;
            esac
          fi

      - name: Checkout
        if: steps.check.outputs.should_build == 'true'
        uses: actions/checkout@v4

      - name: Setup pnpm
        if: steps.check.outputs.should_build == 'true'
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        if: steps.check.outputs.should_build == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Setup Rust
        if: steps.check.outputs.should_build == 'true'
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        if: steps.check.outputs.should_build == 'true'
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: packages/${{ matrix.app }}/src-tauri -> target

      - name: Install dependencies
        if: steps.check.outputs.should_build == 'true'
        run: pnpm install --frozen-lockfile

      - name: Build Tauri app
        if: steps.check.outputs.should_build == 'true'
        shell: bash
        run: pnpm --filter @app/${{ matrix.app }} tauri build

      - name: Determine version
        if: steps.check.outputs.should_build == 'true'
        id: version
        shell: bash
        run: |
          if [ "${{ github.event_name }}" = "push" ]; then
            VERSION="${GITHUB_REF_NAME#v}"
          else
            VERSION="${{ inputs.tag }}"
            VERSION="${VERSION#v}"
          fi
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Upload Release Assets
        if: steps.check.outputs.should_build == 'true'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.event_name == 'push' && github.ref_name || inputs.tag }}
          name: ${{ github.event_name == 'push' && github.ref_name || inputs.tag }}
          draft: false
          prerelease: false
          files: |
            packages/${{ matrix.app }}/src-tauri/target/release/bundle/nsis/*_x64-setup.exe
            packages/${{ matrix.app }}/src-tauri/target/release/bundle/msi/*.msi
```

- [ ] **步骤 2：验证 YAML 语法**

运行：`cd D:/Project/jackit && python -c "import yaml; yaml.safe_load(open('.github/workflows/build-desktop.yml'))" 2>/dev/null || npx yaml-lint .github/workflows/build-desktop.yml 2>/dev/null || echo "manual check needed"`

如果没有 yaml 校验工具，手动检查缩进是否正确（2 空格缩进，无 tab）。

- [ ] **步骤 3：Commit**

```bash
git add .github/workflows/build-desktop.yml
git commit -m "ci: 添加桌面应用构建与发布工作流"
```

---

## 规格覆盖度自检

| 规格需求 | 对应任务 |
|---------|---------|
| workflow_dispatch 输入（tag + 3 个 boolean） | 任务 2 步骤 1 |
| tag push 触发 | 任务 2 步骤 1（`on.push.tags`） |
| matrix 策略 | 任务 2 步骤 1（`strategy.matrix`） |
| 条件跳过未选中应用 | 任务 2 步骤 1（`check` step + `if` 条件） |
| 构建步骤（checkout → node → rust → install → build） | 任务 2 步骤 1 |
| 产物命名（Tauri 默认格式） | 无需额外处理，Tauri 自动生成 |
| MSI + NSIS 双格式 | 任务 1（toolbox 补配置）+ 已有配置（jackcom/jacc） |
| Release 创建与上传 | 任务 2 步骤 1（`softprops/action-gh-release`） |
| 版本从 tag 提取 | 任务 2 步骤 1（`Determine version` step） |
| Rust 缓存加速 | 任务 2 步骤 1（`Swatinem/rust-cache`） |
| pnpm 缓存 | 任务 2 步骤 1（`actions/setup-node` 的 `cache: pnpm`） |
| windows-latest runner | 任务 2 步骤 1（`runs-on`） |
| 仅 GITHUB_TOKEN | 任务 2 步骤 1（`permissions: contents: write`） |
