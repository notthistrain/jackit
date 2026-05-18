#!/usr/bin/env bash
set -euo pipefail

REPO="notthistrain/jackit"
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
