#!/usr/bin/env bash
set -euo pipefail

REPO="notthistrain/jackit"
INSTALL_DIR="/opt/jackserver"
CONFIG_DIR="/etc/jackserver"
SERVICE_USER="jackserver"
BINARY_NAME="jackserver"
RELEASE_PATTERN="jackserver-linux-x86_64.tar.gz"

echo "=== Jackserver Installer ==="

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
if systemctl is-active --quiet jackserver 2>/dev/null; then
    echo "Stopping existing service..."
    systemctl stop jackserver
fi

# 安装二进制
cp "${TMPDIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

# 安装 systemd 文件
cp "${TMPDIR}/jackserver.service" /etc/systemd/system/jackserver.service

# 安装 nginx 配置（仅首次）
if [ -d /etc/nginx/conf.d ] && [ ! -f /etc/nginx/conf.d/jackserver.conf ]; then
    cp "${TMPDIR}/jackserver.conf" /etc/nginx/conf.d/jackserver.conf
    nginx -t 2>/dev/null && nginx -s reload 2>/dev/null
    echo "Nginx config installed and reloaded"
else
    echo "Nginx config skipped (already exists or nginx not installed)"
fi

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
systemctl enable jackserver
systemctl start jackserver

echo ""
echo "=== Installation complete ==="
echo "Binary:    ${INSTALL_DIR}/${BINARY_NAME}"
echo "Config:    ${CONFIG_DIR}/config.toml"
echo "Data:      ${INSTALL_DIR}/data/"
echo "Service:   systemctl status jackserver"
echo "Logs:      journalctl -u jackserver -f"
echo ""
echo "Next step: Edit ${CONFIG_DIR}/config.toml and set your publish token"
