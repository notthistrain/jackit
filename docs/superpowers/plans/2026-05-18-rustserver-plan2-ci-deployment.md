# rustserver CI & 部署实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 rustserver 建立 CI 交叉编译、GitHub Release 发布、systemd 服务管理和 curl 一键安装的完整部署流程。

**架构：** GitHub Actions 编译 Linux x86_64 二进制 → 打包到 GitHub Release → 服务器 curl install.sh 安装/更新 → systemd 管理。

**前置条件：** 计划 1（Core Service）已完成，`packages/rustserver/` 已有可编译的 Rust 项目。

**设计文档：** `docs/superpowers/specs/2026-05-18-rustserver-design.md`

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `.github/workflows/build-rustserver.yml` | CI 工作流：交叉编译 + 发布到 GitHub Release |
| `packages/rustserver/deploy/rustserver.service` | systemd 服务文件 |
| `packages/rustserver/deploy/install.sh` | curl 一键安装/更新脚本 |
| `.github/workflows/build-desktop.yml` | 修改：添加 publish 步骤 |

---

### 任务 1：GitHub Actions 工作流

**文件：**
- 创建：`.github/workflows/build-rustserver.yml`

- [ ] **步骤 1：创建 CI 工作流**

`.github/workflows/build-rustserver.yml`：

```yaml
name: Build Rustserver

on:
  push:
    branches: [main]
    paths:
      - 'packages/rustserver/**'
      - '.github/workflows/build-rustserver.yml'
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-unknown-linux-gnu

      - name: Rust cache
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: packages/rustserver -> target

      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y musl-tools

      - name: Add musl target
        run: rustup target add x86_64-unknown-linux-musl

      - name: Run tests
        working-directory: packages/rustserver
        run: cargo test

      - name: Build release (musl static)
        working-directory: packages/rustserver
        run: cargo build --release --target x86_64-unknown-linux-musl

      - name: Strip binary
        run: strip packages/rustserver/target/x86_64-unknown-linux-musl/release/rustserver

      - name: Prepare release package
        run: |
          mkdir -p /tmp/rustserver-release
          cp packages/rustserver/target/x86_64-unknown-linux-musl/release/rustserver /tmp/rustserver-release/
          cp packages/rustserver/deploy/rustserver.service /tmp/rustserver-release/
          cp packages/rustserver/deploy/install.sh /tmp/rustserver-release/
          cp packages/rustserver/config.example.toml /tmp/rustserver-release/config.toml
          cd /tmp/rustserver-release
          tar czf rustserver-linux-x86_64.tar.gz rustserver rustserver.service install.sh config.toml

      - name: Determine version
        id: version
        run: |
          VERSION=$(grep '^version' packages/rustserver/Cargo.toml | head -1 | sed 's/.*=.*"\(.*\)".*/\1/')
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "tag=rustserver-v$VERSION" >> $GITHUB_OUTPUT

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.version.outputs.tag }}
          name: Rustserver ${{ steps.version.outputs.tag }}
          files: /tmp/rustserver-release/rustserver-linux-x86_64.tar.gz
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Show binary size
        run: ls -lh /tmp/rustserver-release/rustserver
```

**设计说明：**
- 使用 `musl` 静态链接，生成的二进制无 glibc 依赖，兼容所有 Linux 发行版
- 只在 `packages/rustserver/` 有变更时触发
- 打包二进制 + systemd 文件 + install.sh + config.toml 为 tar.gz
- 版本号从 `Cargo.toml` 读取
- 发布到 GitHub Release，tag 格式 `rustserver-v0.1.0`

- [ ] **步骤 2：Commit**

```bash
git add .github/workflows/build-rustserver.yml
git commit -m "ci(rustserver): 添加 GitHub Actions 交叉编译工作流"
```

---

### 任务 2：systemd 服务文件

**文件：**
- 创建：`packages/rustserver/deploy/rustserver.service`

- [ ] **步骤 1：创建 systemd 服务文件**

`packages/rustserver/deploy/rustserver.service`：

```ini
[Unit]
Description=RustServer - Software Package Info Service
After=network.target

[Service]
Type=simple
User=rustserver
Group=rustserver
WorkingDirectory=/opt/rustserver
ExecStart=/opt/rustserver/rustserver --config /etc/rustserver/config.toml
Restart=always
RestartSec=5
LimitNOFILE=65536

# 安全加固
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/rustserver/data
PrivateTmp=true

# 日志输出到 journald
StandardOutput=journal
StandardError=journal
SyslogIdentifier=rustserver

[Install]
WantedBy=multi-user.target
```

**设计说明：**
- 使用专用用户 `rustserver` 运行（install.sh 创建）
- 配置文件在 `/etc/rustserver/config.toml`，二进制和数据在 `/opt/rustserver/`
- 安全加固：禁止提权、保护文件系统、只写 data 目录
- 崩溃自动重启（5 秒间隔）

- [ ] **步骤 2：Commit**

```bash
git add packages/rustserver/deploy/rustserver.service
git commit -m "feat(rustserver): systemd 服务文件"
```

---

### 任务 3：install.sh 安装脚本

**文件：**
- 创建：`packages/rustserver/deploy/install.sh`

- [ ] **步骤 1：创建 install.sh**

`packages/rustserver/deploy/install.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="your-github-org/upgrade-component"
INSTALL_DIR="/opt/rustserver"
CONFIG_DIR="/etc/rustserver"
SERVICE_USER="rustserver"
BINARY_NAME="rustserver"
RELEASE_PATTERN="rustserver-linux-x86_64.tar.gz"

echo "=== Rustserver Installer ==="

# 检查 root 权限
if [ "$(id -u)" -ne 0 ]; then
    echo "Error: Please run as root (sudo)"
    exit 1
fi

# 获取最新版本下载链接
echo "Fetching latest release..."
DOWNLOAD_URL=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep "browser_download_url.*${RELEASE_PATTERN}" \
    | head -1 \
    | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')

if [ -z "${DOWNLOAD_URL}" ]; then
    echo "Error: Could not find release asset"
    exit 1
fi

echo "Download URL: ${DOWNLOAD_URL}"

# 创建临时目录
TMPDIR=$(mktemp -d)
trap 'rm -rf "${TMPDIR}"' EXIT

# 下载
echo "Downloading..."
curl -sL "${DOWNLOAD_URL}" -o "${TMPDIR}/release.tar.gz"

# 解压
tar xzf "${TMPDIR}/release.tar.gz" -C "${TMPDIR}"

# 创建用户（如果不存在）
if ! id "${SERVICE_USER}" &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
    echo "Created user: ${SERVICE_USER}"
fi

# 创建目录
mkdir -p "${INSTALL_DIR}/data"
mkdir -p "${CONFIG_DIR}"

# 停止服务（如已安装）
if systemctl is-active --quiet rustserver 2>/dev/null; then
    echo "Stopping existing service..."
    systemctl stop rustserver
fi

# 安装二进制
cp "${TMPDIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

# 安装 systemd 文件
cp "${TMPDIR}/rustserver.service" /etc/systemd/system/rustserver.service

# 安装配置文件（仅首次）
if [ ! -f "${CONFIG_DIR}/config.toml" ]; then
    cp "${TMPDIR}/config.toml" "${CONFIG_DIR}/config.toml"
    echo ""
    echo "!!! IMPORTANT: Edit ${CONFIG_DIR}/config.toml and set your publish token !!!"
    echo ""
else
    echo "Config file already exists, skipped (not overwritten)"
fi

# 设置权限
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${CONFIG_DIR}"

# 启用并启动服务
systemctl daemon-reload
systemctl enable rustserver
systemctl start rustserver

echo ""
echo "=== Installation complete ==="
echo "Binary:    ${INSTALL_DIR}/${BINARY_NAME}"
echo "Config:    ${CONFIG_DIR}/config.toml"
echo "Data:      ${INSTALL_DIR}/data/"
echo "Service:   systemctl status rustserver"
echo "Logs:      journalctl -u rustserver -f"
echo ""
echo "Next step: Edit ${CONFIG_DIR}/config.toml and set your publish token"
```

**设计说明：**
- 幂等：重复执行不会覆盖配置文件
- 自动创建系统用户
- 自动停止旧服务 → 更新二进制 → 重启
- 需要将 `REPO` 变量替换为实际的 GitHub 仓库路径

- [ ] **步骤 2：Commit**

```bash
git add packages/rustserver/deploy/install.sh
git commit -m "feat(rustserver): curl 一键安装脚本"
```

---

### 任务 4：更新 build-desktop.yml 添加 publish 步骤

**文件：**
- 修改：`.github/workflows/build-desktop.yml`

- [ ] **步骤 1：在 build-desktop.yml 末尾添加 publish 步骤**

在 `.github/workflows/build-desktop.yml` 的 steps 中，在 `Upload Release Assets` 步骤之后添加：

```yaml
      - name: Publish software info to rustserver
        if: steps.check.outputs.should_build == 'true'
        shell: bash
        env:
          RUSTSERVER_URL: ${{ secrets.RUSTSERVER_URL }}
          RUSTSERVER_TOKEN: ${{ secrets.RUSTSERVER_TOKEN }}
          TAG: ${{ github.event_name == 'push' && github.ref_name || inputs.tag }}
        run: |
          if [ -z "$RUSTSERVER_URL" ] || [ -z "$RUSTSERVER_TOKEN" ]; then
            echo "RUSTSERVER_URL or RUSTSERVER_TOKEN not set, skipping publish"
            exit 0
          fi

          VERSION="${TAG#v}"
          APP="${{ matrix.app }}"
          DOWNLOAD_URL="https://github.com/${{ github.repository }}/releases/download/${TAG}/"

          # 根据应用类型确定文件名模式
          case "$APP" in
            toolbox) FILE_PATTERN="${APP}-setup.exe" ;;
            jackcom) FILE_PATTERN="${APP}-setup.exe" ;;
            jacc)    FILE_PATTERN="${APP}-setup.exe" ;;
          esac

          # 查找实际文件名
          EXE_FILE=$(ls packages/${APP}/src-tauri/target/release/bundle/nsis/*-setup.exe 2>/dev/null | head -1)
          if [ -n "$EXE_FILE" ]; then
            FILENAME=$(basename "$EXE_FILE")
            DOWNLOAD_URL="https://github.com/${{ github.repository }}/releases/download/${TAG}/${FILENAME}"
          fi

          curl -sf -X POST "${RUSTSERVER_URL}/api/publish/github" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${RUSTSERVER_TOKEN}" \
            -d "{
              \"name\": \"${APP}\",
              \"version\": \"${VERSION}\",
              \"downloadUrl\": \"${DOWNLOAD_URL}\",
              \"display\": \"${APP}\",
              \"identifier\": \"com.jackit.${APP}\"
            }" && echo "Published ${APP} ${VERSION} to rustserver" || echo "Publish failed (non-blocking)"
```

**设计说明：**
- 使用 GitHub Secrets 存储服务器 URL 和 token
- 在 secrets 未配置时静默跳过（不阻塞 CI）
- 从 release tag 提取版本号
- publish 失败不阻塞 CI（`|| echo "Publish failed"`）
- 需要在 GitHub 仓库 Settings → Secrets 中配置 `RUSTSERVER_URL` 和 `RUSTSERVER_TOKEN`

- [ ] **步骤 2：验证 YAML 语法**

```bash
# 检查 YAML 缩进是否正确
cat .github/workflows/build-desktop.yml | head -100
```

- [ ] **步骤 3：Commit**

```bash
git add .github/workflows/build-desktop.yml
git commit -m "ci(desktop): 构建后自动 publish 软件信息到 rustserver"
```

---

### 任务 5：更新 install.sh 中的仓库地址 + 最终验证

**文件：**
- 修改：`packages/rustserver/deploy/install.sh` — 更新 REPO 变量

- [ ] **步骤 1：查找实际的 GitHub 仓库路径**

```bash
git remote get-url origin
```

将输出格式如 `https://github.com/owner/repo.git` 或 `git@github.com:owner/repo.git`。提取 `owner/repo` 部分。

- [ ] **步骤 2：更新 install.sh 中的 REPO 变量**

将 `packages/rustserver/deploy/install.sh` 中的：
```bash
REPO="your-github-org/upgrade-component"
```
替换为实际的 `owner/repo`。

- [ ] **步骤 3：最终验证 — 检查所有文件就位**

```bash
echo "=== Files check ==="
ls -la .github/workflows/build-rustserver.yml
ls -la packages/rustserver/deploy/rustserver.service
ls -la packages/rustserver/deploy/install.sh
ls -la packages/rustserver/config.example.toml
echo "=== Cargo check ==="
cd packages/rustserver && cargo check
```

- [ ] **步骤 4：Commit（如有变更）**

```bash
git add packages/rustserver/deploy/install.sh
git commit -m "chore(rustserver): 更新 install.sh 仓库地址"
```
