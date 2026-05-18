#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/rustserver"
CONFIG_DIR="/etc/rustserver"
SERVICE_USER="rustserver"

echo "=== Rustserver Uninstaller ==="

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: Please run as root (sudo)"
    exit 1
fi

# 停止服务
if systemctl is-active --quiet rustserver 2>/dev/null; then
    echo "Stopping service..."
    systemctl stop rustserver
fi

# 禁用并删除 systemd 文件
if systemctl is-enabled --quiet rustserver 2>/dev/null; then
    systemctl disable rustserver
fi
rm -f /etc/systemd/system/rustserver.service
systemctl daemon-reload

# 删除安装目录
rm -rf "${INSTALL_DIR}"
echo "Removed ${INSTALL_DIR}"

# 删除配置目录（包含数据库，需确认）
if [ -d "${CONFIG_DIR}" ]; then
    read -rp "Remove config and data (${CONFIG_DIR})? [y/N] " confirm
    if [[ "${confirm}" =~ ^[Yy]$ ]]; then
        rm -rf "${CONFIG_DIR}"
        echo "Removed ${CONFIG_DIR}"
    else
        echo "Kept ${CONFIG_DIR}"
    fi
fi

# 删除用户
if id "${SERVICE_USER}" &>/dev/null; then
    userdel "${SERVICE_USER}"
    echo "Removed user: ${SERVICE_USER}"
fi

echo ""
echo "=== Uninstall complete ==="
