# Server 模块 GitHub Releases 发布能力设计

## 背景

当前 server 模块基于 S3（MinIO/RustFS）存储文件，支持 SVN、S3、文件上传三种发布方式，适用于内网部署。现需新增 GitHub Releases Assets 作为外部发布来源，使 CI/CD 构建流程可以将 Release 附件的下载 URL 注册到 server，实现软件分发的统一管理。

## 目标

1. 新增 `POST /api/publish/github` 接口，接收 GitHub Release Asset 的下载 URL
2. 将现有 svn/file 发布接口拆分到独立的 InternalPublishController
3. 下载逻辑兼容 S3 签名 URL 和外部直链 URL
4. 保留现有 S3/SVN 功能不受影响

## 接口设计

### 新增：`POST /api/publish/github`

**认证**：`Authorization: Bearer <token>`，token 来自配置文件 `[publish]` 节。

**请求体**：

```json
{
  "name": "toolbox",
  "display": "工具箱",
  "identifier": "com.xxx.toolbox",
  "description": "桌面工具集",
  "version": "1.2.0",
  "downloadUrl": "https://github.com/{owner}/{repo}/releases/download/v1.2.0/toolbox.exe",
  "changelog": "修复了xxx",
  "force": false
}
```

| 字段 | 必需 | 说明 |
|------|------|------|
| name | 是 | 软件标识 |
| version | 是 | 版本号，CI/CD 从 package.json 获取 |
| downloadUrl | 是 | GitHub Release Asset 下载 URL |
| display | 否 | 显示名称 |
| identifier | 否 | 标识符 |
| description | 否 | 描述 |
| changelog | 否 | 更新日志 |
| force | 否 | 是否强制更新，默认 false |

**响应**：

```typescript
return ResDTO.ok({
    key,
    sequence,
    name,
    ext,
    size: contentLength,
})
```

### 重构路由

| 原路由 | 新路由 | 控制器 |
|--------|--------|--------|
| `POST /publish/svn` | `POST /api/publish/internal/svn` | InternalPublishController |
| `POST /publish/file` | `POST /api/publish/internal/file` | InternalPublishController |
| `POST /publish/s3` | 不变，`POST /api/publish/s3` | PublishController |
| — | `POST /api/publish/github` | PublishController（新增） |

## 代码结构

### 变更文件清单

```
packages/server/src/
├── controller/
│   ├── publish.controller.ts              # 改造：保留 s3，新增 github，移除 svn/file
│   └── internal-publish.controller.ts     # 新增：承载 svn + file 发布逻辑
├── middleware/
│   └── publish-auth.middleware.ts         # 新增：token 认证，仅拦截 /api/publish/github
├── controller/tools.controller.ts         # 改造：下载逻辑增加 URL 前缀判断
├── config/toml-loader.ts                  # 微调：新增 [publish] 配置节解析
└── config.example.toml                    # 新增 [publish] 配置示例
```

### 不变更

- 数据库 schema（SoftwareVersion.key 字段兼容 S3 key 和外部 URL）
- S3/SVN 核心业务逻辑
- admin 前端
- 认证白名单（`/api/publish` 前缀仍保持公开）

## 核心逻辑

### PublishAuthMiddleware

仅对 `/api/publish/github` 路径生效。校验请求头 `Authorization: Bearer <token>` 中的 token 与配置文件 `[publish].token` 是否匹配。其他路径直接放行。

### 下载逻辑改造

`ToolsController` 的 `/download/:id` 和 `/download-latest/:name` 接口，通过 `key` 字段前缀判断来源：

- `key` 以 `http://` 或 `https://` 开头 → 外部 URL（GitHub Releases），直接返回 `{ url: version.key }`
- 否则 → S3 object key，调用 `s3Service.getSignedUrl()` 生成签名 URL

### 配置新增

```toml
[publish]
token = "your-secret-token"  # CI/CD 调用 publish/github 接口的认证 token
```

## 认证策略

| 路由 | 认证方式 |
|------|---------|
| `/api/publish/github` | PublishAuthMiddleware（Bearer token） |
| `/api/publish/internal/*` | 无额外认证（白名单内，依赖内网安全） |
| `/api/publish/s3` | 无额外认证（白名单内，同现有逻辑） |

## CI/CD 集成

### Secrets 管理

在 GitHub Organization 级别设置以下 secrets，monorepo 下所有子项目共享：

```bash
gh secret set SERVER_URL --org <org> --visibility all
gh secret set PUBLISH_TOKEN --org <org> --visibility all
```

| Secret | 用途 |
|--------|------|
| SERVER_URL | server 地址，如 `https://upgrade.example.com`。未配置时跳过发布步骤，不影响构建。 |
| PUBLISH_TOKEN | 发布认证 token，与 server 配置文件中的 `[publish].token` 一致 |

### Workflow 文件

monorepo 的 workflow 统一放在 `.github/workflows/` 目录下。当前已有 `build-server.yml`（server Docker 镜像构建），需要为各子项目新建 release workflow：

| 文件 | 子项目 | 说明 |
|------|--------|------|
| `.github/workflows/release-toolbox.yml` | toolbox | 构建桌面端 + 创建 GitHub Release + 调用 server publish |
| `.github/workflows/release-jackcom.yml` | jackcom | 构建桌面端 + 创建 GitHub Release + 调用 server publish |

每个 workflow 的触发条件为：当对应子项目的 `package.json` 中 `version` 字段对应的 tag 被推送时触发，或手动 `workflow_dispatch`。

### Publish 步骤模板

以下为 release workflow 中调用 server publish 的步骤模板。必须在 GitHub Release 创建并上传 asset 之后执行。

下载 URL 不能手动拼接（GitHub Release Asset 的实际 URL 是带签名的长链接），需要通过 `gh` CLI 从 Release 中获取：

```yaml
- name: Publish to Upgrade Server
  if: ${{ secrets.SERVER_URL != '' }}
  env:
    SOFTWARE_NAME: toolbox          # 各子项目替换为对应名称
    ASSET_NAME: toolbox.exe         # 各子项目替换为对应产物文件名
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    VERSION=$(jq -r .version packages/${SOFTWARE_NAME}/package.json)
    TAG="v${VERSION}"
    # 按 asset 文件名精确匹配，获取 browser_download_url（不是 .url）
    DOWNLOAD_URL=$(gh release view "${TAG}" --json assets \
      --jq ".assets[] | select(.name == \"${{ env.ASSET_NAME }}\") | .browser_download_url")

    curl -X POST "${{ secrets.SERVER_URL }}/api/publish/github" \
      -H "Authorization: Bearer ${{ secrets.PUBLISH_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"${{ env.SOFTWARE_NAME }}\",
        \"version\": \"${VERSION}\",
        \"downloadUrl\": \"${DOWNLOAD_URL}\"
      }"
```

注意：
- `SOFTWARE_NAME` 和 `ASSET_NAME` 为各子项目的环境变量，在 workflow 中按实际情况设置
- `VERSION` 从子项目的 `package.json` 获取
- `DOWNLOAD_URL` 通过 `gh release view` 从 GitHub API 获取，而非手动拼接。必须使用 `browser_download_url` 字段（`.url` 是 API 端点，不是下载链接）。按 `ASSET_NAME` 精确匹配，避免多个 asset 时取错
- 对于公开仓库，`browser_download_url` 格式为 `https://github.com/{owner}/{repo}/releases/download/{tag}/{filename}`，每次访问时 GitHub 会重定向到带签名的临时 URL
- `SERVER_URL` 未配置时整个步骤跳过（`if` 条件），不影响构建流程
- 该步骤必须在 `gh release create` + `gh release upload` 之后执行

## 测试要点

1. `/api/publish/github` 接口正常注册软件和版本
2. 无效 token 返回 401
3. 缺少必需字段返回 400
4. 下载接口对 S3 key 和外部 URL 分别正确处理
5. 原有 svn/s3/file 接口功能不受影响
6. 新路由 `/api/publish/internal/*` 正常工作
