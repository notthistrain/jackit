#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/jackserver"
CONFIG_DIR="/etc/jackserver"
SERVICE_USER="jackserver"

echo "=== Jackserver Uninstaller ==="

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: Please run as root (sudo)"
    exit 1
fi

# 停止服务
if systemctl is-active --quiet jackserver 2>/dev/null; then
    echo "Stopping service..."
    systemctl stop jackserver
fi

# 禁用并删除 systemd 文件
if systemctl is-enabled --quiet jackserver 2>/dev/null; then
    systemctl disable jackserver
fi
rm -f /etc/systemd/system/jackserver.service
systemctl daemon-reload

# 删除安装目录和配置目录（包含数据库，需确认）
read -rp "Remove all data including database? (${INSTALL_DIR}, ${CONFIG_DIR}) [y/N] " confirm
if [[ "${confirm}" =~ ^[Yy]$ ]]; then
    rm -rf "${INSTALL_DIR}" "${CONFIG_DIR}"
    echo "Removed ${INSTALL_DIR}"
    echo "Removed ${CONFIG_DIR}"
else
    echo "Kept ${INSTALL_DIR} and ${CONFIG_DIR}"
fi

# 删除用户
if id "${SERVICE_USER}" &>/dev/null; then
    userdel "${SERVICE_USER}"
    echo "Removed user: ${SERVICE_USER}"
fi

echo ""
echo "=== Uninstall complete ==="
