# rustserver 轻量级软件包信息服务设计

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 用 Rust 重写现有 Node.js server 的核心功能——软件包信息存储与查询服务，替代 Midway.js + Docker 方案，直接以二进制运行在低配阿里云 ECS 上。

**架构：** axum 纯 API 服务，SQLite 单文件数据库，Nginx 反向代理，GitHub CI 交叉编译 + curl install.sh 一键部署。

**技术栈：** Rust、axum、tokio、sqlx (SQLite)、serde + toml、tracing

---

## 背景

现有 `packages/server` 是 Node.js/Midway.js 后端，通过 Docker 部署。阿里云 ECS 仅有 2GB 内存、2 核 CPU，可用内存不到 500MB，Docker 运行导致资源紧张。需要用 Rust 重写核心功能，以裸机二进制方式运行，大幅降低资源占用。

经过裁剪，保留以下核心功能，移除不需要的部分：

**保留：**
- publish API（CI 上传软件包信息）
- tools API（客户端查询版本 + 获取下载链接）
- health API（健康检查）

**移除：**
- JWT 用户认证（无 admin 面板）
- RBAC 权限系统
- Admin 管理面板及前端静态文件服务
- S3 存储服务（文件直接存 GitHub Releases）
- SVN 文件代理
- Multipart 文件上传
- OperationLog 操作日志

---

## 架构

```
GitHub CI ──POST /api/publish/github──┐
                                      │
Desktop App ──GET /api/tools/*───────►│  Nginx (TLS/域名/静态文件)
                                      │     │
Web 门户 ──GET /api/tools/*──────────►│     ▼
                                      └──► rustserver (localhost:7001)
                                            │
                                            ▼
                                         SQLite (单文件)
```

- rustserver 监听 `localhost:7001`，Nginx 反向代理处理外部请求
- Web 门户的静态文件由 RustFS 对象存储 + Nginx 提供，rustserver 不涉及
- SQLite 数据库文件位于 `./data/rustserver.db`

---

## 项目结构

```
packages/rustserver/
├── Cargo.toml
├── config.example.toml          # 配置文件模板
├── src/
│   ├── main.rs                  # 启动入口、graceful shutdown
│   ├── config.rs                # TOML 配置加载
│   ├── db.rs                    # SQLite 连接池 + schema 初始化
│   ├── error.rs                 # 统一错误类型 → JSON 响应
│   ├── middleware/
│   │   ├── mod.rs
│   │   ├── auth.rs              # Bearer token 校验
│   │   └── log.rs               # 请求日志（axum middleware）
│   ├── handler/
│   │   ├── mod.rs
│   │   ├── publish.rs           # POST /api/publish/github
│   │   ├── tools.rs             # GET /api/tools, /download/:id, /download-latest/:name
│   │   └── health.rs            # GET /api/health
│   └── model.rs                 # Software / SoftwareVersion 结构体 + CRUD
├── deploy/
│   ├── rustserver.service       # systemd 服务文件模板
│   └── install.sh               # curl 一键安装/更新脚本
└── tests/
    └── api_test.rs              # 集成测试
```

---

## 数据库

使用 sqlx + SQLite，启动时自动建表。

### 表结构

```sql
CREATE TABLE IF NOT EXISTS software (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL UNIQUE,
    display_name TEXT,
    description  TEXT,
    ext          TEXT,
    identifier   TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS software_version (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    software_id INTEGER NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    sequence    TEXT NOT NULL,
    key         TEXT NOT NULL,
    size        INTEGER DEFAULT 0,
    force       INTEGER DEFAULT 0,
    changelog   TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(software_id, sequence)
);
```

- `key` 字段存储 GitHub Release 的下载 URL（https:// 开头的直链）
- `software_version.key` 以 `http://` 或 `https://` 开头时，tools API 直接返回该 URL，无需签名

---

## API 设计

### 响应格式

沿用现有 server 的 `ResDTO` 风格：

```json
// 成功
{ "code": 0, "msg": "ok", "data": { ... } }

// 失败
{ "code": 1, "msg": "error description", "data": null }
```

### 接口列表

#### POST /api/publish/github

CI 构建完成后调用，注册软件版本信息。

**认证：** `Authorization: Bearer <token>`（token 在 config.toml 中配置）

**请求体：**
```json
{
  "name": "toolbox",
  "version": "0.1.0",
  "downloadUrl": "https://github.com/.../toolbox-0.1.0-setup.exe",
  "display": "工具箱",
  "identifier": "com.jackit.toolbox",
  "description": "Jackit 工具箱",
  "changelog": "修复了...",
  "force": false
}
```

**必填字段：** `name`、`version`、`downloadUrl`

**逻辑：**
1. 校验 Bearer token（timing-safe 比较）
2. 校验必填字段
3. 校验 downloadUrl 是合法 HTTP(S) URL
4. 查找或创建 software 记录（按 name 匹配）
5. 查找或创建 software_version 记录（按 software_id + sequence 匹配）
6. 返回创建/更新的版本信息

**响应：**
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "key": "https://github.com/.../toolbox-0.1.0-setup.exe",
    "sequence": "0.1.0",
    "name": "toolbox"
  }
}
```

#### GET /api/tools

列出所有软件及其版本列表。无认证。

**响应：**
```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "id": 1,
      "name": "toolbox",
      "ext": "exe",
      "displayName": "工具箱",
      "identifier": "com.jackit.toolbox",
      "description": "Jackit 工具箱",
      "versions": [
        {
          "versionId": 1,
          "sequence": "0.1.0",
          "size": 52428800,
          "force": false,
          "changelog": "首个版本",
          "createdAt": "2026-05-18T10:00:00"
        }
      ]
    }
  ]
}
```

#### GET /api/tools/download/:id

按版本 ID 获取下载链接。无认证。

**逻辑：**
1. 查找 version 记录
2. key 以 http(s):// 开头 → 直接返回 URL
3. 否则返回错误（本服务不处理 S3 签名）

**响应：**
```json
{
  "code": 0,
  "msg": "ok",
  "data": { "url": "https://github.com/..." }
}
```

#### GET /api/tools/download-latest/:name

按软件名获取最新版本下载链接。无认证。

**逻辑：**
1. 按 name 查找 software
2. 取最新版本（按 created_at DESC 排序第一条）
3. 返回下载链接 + 版本信息

**响应：**
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "url": "https://github.com/...",
    "version": "0.1.0",
    "size": 52428800,
    "displayName": "工具箱"
  }
}
```

#### GET /api/health

健康检查。无认证。

**响应：**
```json
{
  "code": 0,
  "msg": "ok",
  "data": { "status": "ok" }
}
```

---

## 配置

config.toml：

```toml
[server]
port = 7001

[database]
path = "./data/rustserver.db"

[publish]
token = "your-secret-token"
```

启动时从可执行文件同级目录或 `--config` 参数指定路径加载。

---

## 请求日志

使用 axum middleware 记录所有请求的 method、path、耗时、状态码。对 publish 接口额外记录 name 和 version 参数。token 等敏感信息不记录到日志。

---

## 错误处理

统一错误类型，覆盖：
- 请求参数校验错误 → 400
- 未认证 / token 错误 → 401
- 资源未找到 → 404
- 数据库错误 → 500

所有错误以 ResDTO JSON 格式返回。

---

## 依赖

```toml
[dependencies]
axum = "0.8"
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
chrono = "0.4"
```

---

## 部署

### GitHub CI

新增 `.github/workflows/build-rustserver.yml`：
- 触发：push 到 main 且 `packages/rustserver/` 有变更
- 交叉编译 `x86_64-unknown-linux-gnu` target
- 打包二进制 + systemd service 文件 + install.sh → 上传到 GitHub Release

### install.sh

脚本功能：
1. 下载最新 release 的二进制和 systemd 文件
2. 停止服务（如已安装）
3. 替换二进制
4. 启动服务

### systemd

```ini
[Unit]
Description=RustServer - Software Package Info Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/rustserver --config /etc/rustserver/config.toml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 与现有系统的关系

- **替代** `packages/server` 的 publish + tools 功能
- **客户端无需改动**：toolbox/jackcom/jacc 已有的 tools API 调用逻辑保持不变，只需将 API 地址指向 rustserver
- **CI 工作流需更新**：`build-desktop.yml` 中增加 publish 步骤（在 upload release assets 之后调用 rustserver API）
- **现有 server 可保留**作为 admin 管理用途（如需要），或后续逐步弃用
