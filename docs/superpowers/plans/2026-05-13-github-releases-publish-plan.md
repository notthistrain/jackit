# Server GitHub Releases 发布能力 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 server 模块新增 GitHub Releases Assets 发布来源，拆分内网发布接口到独立 controller，废弃 InfoToml 统一从 body 读取元数据，并让下载逻辑兼容外部直链 URL。

**架构：** 新增 `PublishAuthMiddleware` 以接口级中间件方式注册到 `/api/publish/github`；将 svn/file 拆分到 `InternalPublishController`（路由 `/api/publish/internal/*`），统一从 body 读取元数据；`PublishController` 保留 s3 和 github（同级路由）；`ToolsController` 下载时通过 URL 前缀判断是走 S3 签名还是直接返回外部 URL。

**技术栈：** Midway.js + TypeORM + SQLite

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/server/src/config/toml-loader.ts` | 修改 | 新增 `publish` 配置节类型 |
| `packages/server/src/config/config.default.ts` | 修改 | 注册 `publish` 配置到 Midway |
| `packages/server/config.example.toml` | 修改 | 新增 `[publish]` 示例 |
| `packages/server/src/interface.ts` | 修改 | 新增 `IPublishConfig` 接口 |
| `packages/server/src/middleware/publish-auth.middleware.ts` | 创建 | token 认证，接口级中间件 |
| `packages/server/src/controller/publish.controller.ts` | 修改 | 移除 svn/file，保留 s3 + github（接口级注册中间件） |
| `packages/server/src/controller/internal-publish.controller.ts` | 创建 | 承载 svn + file 发布逻辑，统一 body 格式 |
| `packages/server/src/controller/tools.controller.ts` | 修改 | 下载逻辑增加 URL 前缀判断 |
| `packages/server/test/controller/publish.test.ts` | 修改 | 新增 github 测试 + internal 路由测试 |

---

### 任务 1：新增 `[publish]` 配置节

**文件：**
- 修改：`packages/server/src/config/toml-loader.ts`
- 修改：`packages/server/src/interface.ts`
- 修改：`packages/server/src/config/config.default.ts`
- 修改：`packages/server/config.example.toml`

- [ ] **步骤 1：在 `interface.ts` 新增 `IPublishConfig` 和 `PublishBaseDTO`**

在 `packages/server/src/interface.ts` 末尾追加：

```typescript
export interface IPublishConfig {
  token: string
}

/** 所有发布接口的公共 body 字段 */
export interface PublishBaseDTO {
  name: string
  version: string
  display?: string
  identifier?: string
  description?: string
  changelog?: string
  force?: boolean
}
```

- [ ] **步骤 2：在 `toml-loader.ts` 新增 `publish` 类型**

在 `packages/server/src/config/toml-loader.ts` 的 `TomlConfig` 接口中追加：

```typescript
publish?: { token?: string }
```

- [ ] **步骤 3：在 `config.default.ts` 注册 publish 配置**

在 `packages/server/src/config/config.default.ts` 的 export 对象中追加（在 `cookie` 之后）：

```typescript
publish: {
  token: toml.publish?.token ?? process.env.PUBLISH_TOKEN ?? '',
},
```

- [ ] **步骤 4：在 `config.example.toml` 新增示例**

在文件末尾追加：

```toml
[publish]
# GitHub Releases 发布认证 token（CI/CD 调用 /api/publish/github 接口时使用）
token = ""
```

- [ ] **步骤 5：验证编译通过**

运行：`cd packages/server && npx tsc --noEmit`
预期：无报错

- [ ] **步骤 6：Commit**

```bash
git add packages/server/src/config/toml-loader.ts packages/server/src/interface.ts packages/server/src/config/config.default.ts packages/server/config.example.toml
git commit -m "feat(server): 新增 [publish] 配置节"
```

---

### 任务 2：创建 PublishAuthMiddleware

**文件：**
- 创建：`packages/server/src/middleware/publish-auth.middleware.ts`

- [ ] **步骤 1：创建中间件**

创建 `packages/server/src/middleware/publish-auth.middleware.ts`。

此中间件以接口级方式注册（在 `@Post` 装饰器的 `middleware` 选项中引用），不需要在 `configuration.ts` 中全局注册，也不需要自己做路径判断：

```typescript
import type { Context, NextFunction } from '@midwayjs/koa'
import { Config, Middleware } from '@midwayjs/core'

@Middleware()
export class PublishAuthMiddleware {
  @Config('publish.token')
  publishToken: string

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const authHeader = ctx.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        ctx.status = 401
        ctx.body = { success: false, message: 'Missing or invalid Authorization header' }
        return
      }

      const token = authHeader.slice(7)
      if (token !== this.publishToken) {
        ctx.status = 401
        ctx.body = { success: false, message: 'Invalid publish token' }
        return
      }

      return await next()
    }
  }
}
```

- [ ] **步骤 2：验证编译通过**

运行：`cd packages/server && npx tsc --noEmit`
预期：无报错

- [ ] **步骤 3：Commit**

```bash
git add packages/server/src/middleware/publish-auth.middleware.ts
git commit -m "feat(server): 新增 PublishAuthMiddleware（接口级中间件）"
```

---

### 任务 3：重写 PublishController（保留 s3 + 新增 github）

**文件：**
- 修改：`packages/server/src/controller/publish.controller.ts`

将 `publish.controller.ts` 重写为只包含 s3 和 github 接口，移除 svn/file。github 接口在接口级注册 `PublishAuthMiddleware`。s3 接口字段名统一为 `version`（替代原来的 `sequence`）。

- [ ] **步骤 1：重写 `publish.controller.ts`**

```typescript
import type { ILogger } from '@midwayjs/core'
import type { IMidwayKoaContext } from '@midwayjs/koa'
import type { S3Service } from '../service/s3.service'
import type { SoftwareService } from '../service/software.service'
import type { PublishBaseDTO } from '../interface'
import { Controller, Inject, Logger, Post } from '@midwayjs/core'
import { PublishAuthMiddleware } from '../middleware/publish-auth.middleware'
import { ResDTO } from '../dto/tools.dto'

interface S3PublishDTO extends PublishBaseDTO {
  ext: string
}

interface GithubPublishDTO extends PublishBaseDTO {
  downloadUrl: string
}

@Controller('/publish')
export class PublishController {
  @Inject()
  ctx: IMidwayKoaContext

  @Inject()
  s3Service: S3Service

  @Inject()
  softwareService: SoftwareService

  @Logger()
  logger: ILogger

  @Post('/s3')
  async s3() {
    const { name, version, ext, display, identifier, description, changelog, force } = this.ctx.request.body as S3PublishDTO
    this.logger.info('publish from s3: name=%s, version=%s', name, version)

    if (!name || !version || !ext) {
      return ResDTO.fail('Missing required fields: name, version, ext')
    }

    const key = `${name}/${name}-${version}.${ext}`
    const size = await this.s3Service.getFileSize(key)

    await this.softwareService.saveVersion({
      name,
      sequence: version,
      key,
      ext,
      size,
      displayName: display,
      identifier,
      description,
      force: force ?? false,
      changelog,
    })

    return ResDTO.ok({
      key,
      sequence: version,
      name,
      ext,
      size,
    })
  }

  @Post('/github', { middleware: [PublishAuthMiddleware] })
  async github() {
    const { name, version, downloadUrl, display, identifier, description, changelog, force } = this.ctx.request.body as GithubPublishDTO
    this.logger.info('publish from github: name=%s, version=%s', name, version)

    if (!name || !version || !downloadUrl) {
      return ResDTO.fail('Missing required fields: name, version, downloadUrl')
    }

    await this.softwareService.saveVersion({
      name,
      sequence: version,
      key: downloadUrl,
      ext: '',
      size: 0,
      displayName: display,
      identifier,
      description,
      force: force ?? false,
      changelog,
    })

    return ResDTO.ok({
      key: downloadUrl,
      sequence: version,
      name,
    })
  }
}
```

- [ ] **步骤 2：验证编译通过**

运行：`cd packages/server && npx tsc --noEmit`
预期：无报错

- [ ] **步骤 3：Commit**

```bash
git add packages/server/src/controller/publish.controller.ts
git commit -m "refactor(server): PublishController 保留 s3 + 新增 github，接口级注册认证中间件"
```

---

### 任务 4：创建 InternalPublishController（统一 body 格式，废弃 InfoToml）

**文件：**
- 创建：`packages/server/src/controller/internal-publish.controller.ts`

所有接口统一从 request body 读取元数据，不再使用 InfoToml 文件。字段名统一：
- `name`（必需）— 软件标识
- `version`（必需）— 版本号
- `display`（可选）— 显示名称
- `identifier`（可选）— 标识符
- `description`（可选）— 描述
- `changelog`（可选）— 更新日志
- `force`（可选）— 强制更新

各接口特有字段：
- svn：`url`（SVN 源地址）、`ext`（文件扩展名）
- file：`ext`（文件扩展名），文件通过 multipart 上传

- [ ] **步骤 1：创建 `internal-publish.controller.ts`**

```typescript
import type { UploadFileInfo } from '@midwayjs/busboy'
import type { ILogger } from '@midwayjs/core'
import type { IMidwayKoaContext } from '@midwayjs/koa'
import type { S3Service } from '../service/s3.service'
import type { SoftwareService } from '../service/software.service'
import type { SvnService } from '../service/svn.service'
import type { PublishBaseDTO } from '../interface'
import { createReadStream, statSync } from 'node:fs'
import { UploadMiddleware } from '@midwayjs/busboy'
import { Controller, Files, Inject, Logger, Post } from '@midwayjs/core'
import { ResDTO } from '../dto/tools.dto'

interface SvnPublishDTO extends PublishBaseDTO {
  url: string
  ext: string
}

@Controller('/publish/internal')
export class InternalPublishController {
  @Inject()
  ctx: IMidwayKoaContext

  @Inject()
  svnService: SvnService

  @Inject()
  s3Service: S3Service

  @Inject()
  softwareService: SoftwareService

  @Logger()
  logger: ILogger

  @Post('/svn')
  async svn() {
    const { name, version, url, ext, display, identifier, description, changelog, force } = this.ctx.request.body as SvnPublishDTO
    this.logger.info('publish from svn: name=%s, version=%s', name, version)

    if (!name || !version || !url || !ext) {
      return ResDTO.fail('Missing required fields: name, version, url, ext')
    }

    const { stream, contentLength } = await this.svnService.downloadFile(url)

    const key = `${name}/${name}-${version}.${ext}`
    this.logger.info('upload file to s3: %s', key)

    await this.s3Service.uploadFile(key, stream, undefined, contentLength)
    this.logger.info('upload file to s3 success: %s', key)

    await this.softwareService.saveVersion({
      name,
      sequence: version,
      key,
      ext,
      size: contentLength,
      displayName: display,
      identifier,
      description,
      force: force ?? false,
      changelog,
    })

    return ResDTO.ok({
      key,
      sequence: version,
      name,
      ext,
      size: contentLength,
    })
  }

  @Post('/file', { middleware: [UploadMiddleware] })
  async file(@Files() files: Array<UploadFileInfo>) {
    this.logger.info('file upload request, files count: %d', files?.length || 0)

    if (!files?.length) {
      this.logger.warn('no files uploaded')
      return ResDTO.fail('No file uploaded')
    }

    this.logger.info(
      'uploaded files: %j',
      files.map(f => ({ fieldName: f.fieldName, filename: f.filename, data: f.data })),
    )

    // 从 body 表单字段读取元数据（不再使用 InfoToml）
    const body = this.ctx.request.body as PublishBaseDTO & { ext?: string, force?: string }
    const { name, version, ext = 'exe', display, identifier, description, changelog } = body
    const force = body.force === 'true'

    if (!name || !version) {
      return ResDTO.fail('Missing required fields: name, version')
    }

    const packageFile = files.find(f => f.fieldName === 'pkg')
    if (!packageFile) {
      this.logger.warn('pkg file not found in uploaded files')
      return ResDTO.fail('pkg is required')
    }

    let size: number
    try {
      size = statSync(packageFile.data).size
    }
    catch (error) {
      this.logger.error('Failed to stat package file: %s', (error as Error).message)
      return ResDTO.fail('Failed to read uploaded package file')
    }

    this.logger.info('file publish: name=%s, version=%s, size=%d', name, version, size)

    const key = `${name}/${name}-${version}.${ext}`
    this.logger.info('upload file to s3: %s, size: %d', key, size)

    const fileStream = createReadStream(packageFile.data)
    await this.s3Service.uploadFile(key, fileStream, packageFile.mimeType, size)
    this.logger.info('upload file to s3 success: %s', key)

    await this.softwareService.saveVersion({
      name,
      sequence: version,
      key,
      ext,
      size,
      displayName: display,
      identifier,
      description,
      force,
      changelog,
    })

    return ResDTO.ok({
      key,
      sequence: version,
      name,
      ext,
      size,
    })
  }
}
```

注意点：
- `file` 接口使用 busboy 上传文件时，表单字段通过 `this.ctx.request.body` 获取（Midway busboy 会将非文件字段解析到 body 中）
- `force` 在 multipart 表单中是字符串 `'true'`，需要手动转换
- 所有接口字段统一：`name`、`version`（替代原来的 `sequence`）、`display`、`identifier`、`description`、`changelog`、`force`

- [ ] **步骤 2：验证编译通过**

运行：`cd packages/server && npx tsc --noEmit`
预期：无报错

- [ ] **步骤 3：Commit**

```bash
git add packages/server/src/controller/internal-publish.controller.ts
git commit -m "feat(server): 新增 InternalPublishController（svn + file），统一 body 格式，废弃 InfoToml"
```

---

### 任务 5：改造下载逻辑

**文件：**
- 修改：`packages/server/src/controller/tools.controller.ts`

- [ ] **步骤 1：抽取 URL 判断辅助方法并改造 download 和 downloadLatest**

在 `ToolsController` 类中新增私有方法：

```typescript
private isExternalUrl(key: string): boolean {
  return key.startsWith('http://') || key.startsWith('https://')
}

private async getDownloadUrl(key: string, filename?: string): Promise<string> {
  if (this.isExternalUrl(key)) {
    return key
  }
  return await this.s3Service.getSignedUrl(key, undefined, filename)
}
```

改造 `download()` 方法，将：

```typescript
const signedUrl = await this.s3Service.getSignedUrl(version.key)
this.logger.info('Generated signed url for version: %d', id)
return ResDTO.ok({ url: signedUrl })
```

改为：

```typescript
const url = await this.getDownloadUrl(version.key)
this.logger.info('Generated download url for version: %d', id)
return ResDTO.ok({ url })
```

改造 `downloadLatest()` 方法，将：

```typescript
const filename = `${software.name}.${software.ext || 'exe'}`
const signedUrl = await this.s3Service.getSignedUrl(latestVersion.key, undefined, filename)
this.logger.info('Generated signed url for %s version %s', name, latestVersion.sequence)
return ResDTO.ok({
  url: signedUrl,
```

改为：

```typescript
const filename = `${software.name}.${software.ext || 'exe'}`
const url = await this.getDownloadUrl(latestVersion.key, filename)
this.logger.info('Generated download url for %s version %s', name, latestVersion.sequence)
return ResDTO.ok({
  url,
```

- [ ] **步骤 2：验证编译通过**

运行：`cd packages/server && npx tsc --noEmit`
预期：无报错

- [ ] **步骤 3：Commit**

```bash
git add packages/server/src/controller/tools.controller.ts
git commit -m "feat(server): 下载逻辑兼容外部 URL，S3 key 走签名，外部直链直接返回"
```

---

### 任务 6：更新测试

**文件：**
- 修改：`packages/server/test/controller/publish.test.ts`

- [ ] **步骤 1：更新 `publish.test.ts`**

```typescript
import type { Application, Framework } from '@midwayjs/koa'
import { inspect } from 'node:util'
import { close, createApp, createHttpRequest } from '@midwayjs/mock'

describe('Publish Controller', () => {
  let app: Application

  beforeAll(async () => {
    app = await createApp<Framework>()
  })

  afterAll(async () => {
    await close(app)
  })

  describe('POST /api/publish/github', () => {
    it('should reject request without Authorization header', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/github')
        .send({
          name: 'toolbox',
          version: '1.0.0',
          downloadUrl: 'https://github.com/test/releases/download/v1.0.0/toolbox.exe',
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should reject request with wrong token', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/github')
        .set('Authorization', 'Bearer wrong-token')
        .send({
          name: 'toolbox',
          version: '1.0.0',
          downloadUrl: 'https://github.com/test/releases/download/v1.0.0/toolbox.exe',
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should return error when missing required fields', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/github')
        .send({
          name: 'toolbox',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Missing required fields')
    })
  })

  describe('POST /api/publish/internal/svn', () => {
    it.skip('should publish from svn', async () => {
      const response = await createHttpRequest(app).post('/api/publish/internal/svn').send({
        name: 'scannerbib',
        version: '0.0.0',
        url: 'http://svn.example.com/svn/project/!svn/ver/1/releases/tool-0.0.0-1.x86_64.rpm',
        ext: 'rpm',
      })
      console.log('data: ', inspect(response.body.data))
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.key).toBeDefined()
    }, 30000)
  })

  describe('POST /api/publish/s3', () => {
    it('should handle missing file gracefully', async () => {
      const response = await createHttpRequest(app).post('/api/publish/s3').send({
        name: 'nonexistent',
        version: '0.0.0',
        ext: 'bat',
      })
      console.log('data: ', inspect(response.body.data))
      expect(response.status).toBeDefined()
    }, 30000)
  })

  describe('POST /api/publish/internal/file', () => {
    it('should require pkg file', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/internal/file')
        .field('name', 'test')
        .field('version', '1.0.0')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('pkg')
    }, 30000)

    it('should require name and version', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/internal/file')
        .attach('pkg', Buffer.from('test'), { filename: 'test.exe' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Missing required fields')
    }, 30000)
  })
})
```

- [ ] **步骤 2：运行测试验证**

运行：`cd packages/server && pnpm test`
预期：
- `should reject request without Authorization header` — PASS（401）
- `should reject request with wrong token` — PASS（401）
- `should return error when missing required fields` — PASS
- `should require pkg file` — PASS
- `should require name and version` — PASS
- `should handle missing file gracefully` — PASS（可能因为 S3 不存在而失败，但不会 500）

- [ ] **步骤 3：Commit**

```bash
git add packages/server/test/controller/publish.test.ts
git commit -m "test(server): 更新 publish 测试，覆盖 github/internal/body 格式"
```

---

### 任务 7：最终验证

- [ ] **步骤 1：完整编译检查**

运行：`cd packages/server && pnpm build`
预期：编译成功

- [ ] **步骤 2：运行全部测试**

运行：`cd packages/server && pnpm test`
预期：所有测试通过或符合预期（svn 的 skip 测试保持 skip）

- [ ] **步骤 3：代码检查**

运行：`cd packages/server && pnpm lint`
预期：无 lint 错误（如有则修复）

- [ ] **步骤 4：最终 Commit（如有 lint 修复）**

仅在步骤 3 有修复时 commit。
