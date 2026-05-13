#!/bin/bash

# Upgrade Component Server 集成部署脚本

set -e

IMAGE_NAME="upgrade-component-server"
IMAGE_TAG="1.0.2"
IMAGE_FULL="${IMAGE_NAME}:${IMAGE_TAG}"

echo "=== Upgrade Component Server 部署脚本 ==="

# 确保在仓库根目录执行
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

# 1. 编译 server TypeScript
echo "1. 编译 Server..."
pnpm --filter @upgrade/server build

# 2. 构建 admin 前端
echo "2. 构建 Admin 前端..."
pnpm --filter @upgrade/admin build

# 3. 构建 Docker 镜像
echo "3. 构建 Docker 镜像..."
docker build -f packages/server/Dockerfile -t "${IMAGE_FULL}" .

# 4. 创建数据目录
echo "4. 创建数据目录..."
cd "${SCRIPT_DIR}/.dev"
mkdir -p rustfs/data rustfs/logs
mkdir -p server/data server/logs
chmod -R 777 rustfs server

# 5. 复制配置文件（如果不存在）
if [ ! -f config.toml ]; then
  echo "5. 创建默认配置文件..."
  cp ../config.example.toml config.toml
  echo "   请编辑 .dev/config.toml 填入实际配置值"
fi

# 6. 启动服务
echo "6. 启动服务..."
docker compose up -d

echo "7. 检查服务状态..."
docker compose ps

echo ""
echo "=== 部署完成 ==="
echo "访问地址: http://localhost:7001"
echo "API 地址: http://localhost:7001/api"
