# Server GitHub Releases 发布能力 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 server 模块新增 GitHub Releases Assets 发布来源，拆分内网发布接口到独立 controller，并让下载逻辑兼容外部直链 URL。

**架构：** 新增 `PublishAuthMiddleware` 对 `/api/publish/github` 做 token 认证；将 svn/file 拆分到 `InternalPublishController`（路由 `/api/publish/internal/*`）；`PublishController` 保留 s3 并新增 github 方法；`ToolsController` 下载时通过 URL 前缀判断是走 S3 签名还是直接返回外部 URL。

**技术栈：** Midway.js + TypeORM + SQLite + @iarna/toml

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/server/src/config/toml-loader.ts` | 修改 | 新增 `publish` 配置节类型 |
| `packages/server/src/config/config.default.ts` | 修改 | 注册 `publish` 配置到 Midway |
| `packages/server/config.example.toml` | 修改 | 新增 `[publish]` 示例 |
| `packages/server/src/interface.ts` | 修改 | 新增 `IPublishConfig` 接口 |
| `packages/server/src/middleware/publish-auth.middleware.ts` | 创建 | token 认证，仅拦截 `/api/publish/github` |
| `packages/server/src/configuration.ts` | 修改 | 注册 PublishAuthMiddleware |
| `packages/server/src/controller/publish.controller.ts` | 修改 | 移除 svn/file，保留 s3，新增 github |
| `packages/server/src/controller/internal-publish.controller.ts` | 创建 | 承载 svn + file 发布逻辑 |
| `packages/server/src/controller/tools.controller.ts` | 修改 | 下载逻辑增加 URL 前缀判断 |
| `packages/server/test/controller/publish.test.ts` | 修改 | 新增 github 发布测试 + internal 路由测试 |
| `packages/server/test/controller/tools.test.ts` | 创建 | 测试下载逻辑的 URL 前缀判断 |

---

### 任务 1：新增 `[publish]` 配置节

**文件：**
- 修改：`packages/server/src/config/toml-loader.ts`
- 修改：`packages/server/src/interface.ts`
- 修改：`packages/server/src/config/config.default.ts`
- 修改：`packages/server/config.example.toml`

- [ ] **步骤 1：在 `interface.ts` 新增 `IPublishConfig`**

在 `packages/server/src/interface.ts` 末尾追加：

```typescript
export interface IPublishConfig {
  token: string
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

创建 `packages/server/src/middleware/publish-auth.middleware.ts`：

```typescript
import type { Context, NextFunction } from '@midwayjs/koa'
import { Config, Middleware } from '@midwayjs/core'

@Middleware()
export class PublishAuthMiddleware {
  @Config('publish.token')
  publishToken: string

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 仅拦截 /api/publish/github
      if (!ctx.path.startsWith('/api/publish/github')) {
        return await next()
      }

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

- [ ] **步骤 2：在 `configuration.ts` 注册中间件**

在 `packages/server/src/configuration.ts` 中：

在 import 区域追加：
```typescript
import { PublishAuthMiddleware } from './middleware/publish-auth.middleware'
```

在 `onReady()` 方法中，`this.app.useMiddleware([AuthMiddleware])` 之前追加：
```typescript
this.logger.info('注册中间件: PublishAuthMiddleware')
this.app.useMiddleware([PublishAuthMiddleware])
```

注意：PublishAuthMiddleware 放在 AuthMiddleware 之前，因为 `/api/publish` 前缀在白名单中，AuthMiddleware 会直接放行。PublishAuthMiddleware 需要先执行才能拦截 github 路由。

- [ ] **步骤 3：验证编译通过**

运行：`cd packages/server && npx tsc --noEmit`
预期：无报错

- [ ] **步骤 4：Commit**

```bash
git add packages/server/src/middleware/publish-auth.middleware.ts packages/server/src/configuration.ts
git commit -m "feat(server): 新增 PublishAuthMiddleware，拦截 /api/publish/github"
```

---

### 任务 3：新增 `/api/publish/github` 接口

**文件：**
- 修改：`packages/server/src/controller/publish.controller.ts`

- [ ] **步骤 1：在 `publish.controller.ts` 新增 github 方法**

在 `packages/server/src/controller/publish.controller.ts` 的 `PublishController` 类中，`s3()` 方法之后追加：

```typescript
@Post('/github')
async github() {
  const body = this.ctx.request.body as {
    name: string
    version: string
    downloadUrl: string
    display?: string
    identifier?: string
    description?: string
    changelog?: string
    force?: boolean
  }

  const { name, version, downloadUrl, display, identifier, description, changelog, force } = body
  this.logger.info('publish from github: name=%s, version=%s', name, version)

  if (!name || !version || !downloadUrl) {
    return ResDTO.fail('Missing required fields: name, version, downloadUrl')
  }

  const savedVersion = await this.softwareService.saveVersion({
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
```

- [ ] **步骤 2：验证编译通过**

运行：`cd packages/server && npx tsc --noEmit`
预期：无报错

- [ ] **步骤 3：Commit**

```bash
git add packages/server/src/controller/publish.controller.ts
git commit -m "feat(server): 新增 POST /api/publish/github 接口"
```

---

### 任务 4：拆分 InternalPublishController

**文件：**
- 创建：`packages/server/src/controller/internal-publish.controller.ts`
- 修改：`packages/server/src/controller/publish.controller.ts`

- [ ] **步骤 1：创建 `internal-publish.controller.ts`**

创建 `packages/server/src/controller/internal-publish.controller.ts`，将 `publish.controller.ts` 中的 svn 和 file 方法搬过来：

```typescript
import type { UploadFileInfo } from '@midwayjs/busboy'
import type { ILogger } from '@midwayjs/core'
import type { IMidwayKoaContext } from '@midwayjs/koa'
import type { S3Service } from '../service/s3.service'
import type { SoftwareService } from '../service/software.service'
import type { SvnService } from '../service/svn.service'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import * as TOML from '@iarna/toml'
import { UploadMiddleware } from '@midwayjs/busboy'
import { Controller, Files, Inject, Logger, Post } from '@midwayjs/core'
import { Rule, RuleType } from '@midwayjs/validate'
import { ResDTO } from '../dto/tools.dto'

interface InfoTomlSoftware {
  name: string
  display: string
  identifier: string
  description?: string
}

interface InfoTomlVersion {
  sequence: string
  force?: boolean
  changelog?: string
}

interface InfoToml {
  software: InfoTomlSoftware
  version: InfoTomlVersion
}

class PublishDTO {
  @Rule(RuleType.string().required())
  sequence: string

  @Rule(RuleType.string().required())
  name: string

  @Rule(RuleType.string().required())
  ext: string
}

class SvnPublishDTO extends PublishDTO {
  @Rule(RuleType.string().required())
  url: string
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
    const body = this.ctx.request.body as SvnPublishDTO
    const { url, sequence, name, ext } = body
    this.logger.info('publish from svn: %j', body)

    const { stream, contentLength } = await this.svnService.downloadFile(url)

    const key = `${name}/${name}-${sequence}.${ext}`
    this.logger.info('upload file to s3: %s', key)

    await this.s3Service.uploadFile(key, stream, undefined, contentLength)
    this.logger.info('upload file to s3 success: %s', key)

    await this.softwareService.saveVersion({
      name,
      sequence,
      key,
      ext,
      size: contentLength,
    })

    return ResDTO.ok({
      key,
      sequence,
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

    const infoFile = files.find(f => f.fieldName === 'info' || f.filename?.endsWith('.toml'))
    if (!infoFile) {
      this.logger.warn('info file not found in uploaded files')
      return ResDTO.fail('info file is required')
    }
    const packageFile = files.find(f => f.fieldName === 'pkg')
    if (!packageFile) {
      this.logger.warn('pkg file not found in uploaded files')
      return ResDTO.fail('pkg is required')
    }

    this.logger.info('reading info.toml from temp file: %s', infoFile.data)

    let parsed: InfoToml
    try {
      const content = readFileSync(infoFile.data, 'utf-8')
      parsed = TOML.parse(content) as unknown as InfoToml
      this.logger.info('info.toml content:\n%s', content)
    }
    catch (error) {
      this.logger.error('Failed to parse TOML: %s', (error as Error).message)
      return ResDTO.fail('Invalid TOML file')
    }

    if (!parsed?.software || !parsed?.version) {
      return ResDTO.fail('Missing software or version section in info.toml')
    }

    const software = parsed.software
    const versionInfo = parsed.version

    if (!software?.name || !versionInfo?.sequence) {
      return ResDTO.fail('Missing required fields in info.toml: software.name or version.sequence')
    }

    const name = software.name
    const sequence = versionInfo.sequence
    const displayName = software.display
    const identifier = software.identifier
    const description = software.description
    const force = versionInfo.force ?? false
    const changelog = versionInfo.changelog
    const ext = 'exe'

    let size: number
    try {
      size = statSync(packageFile.data).size
    }
    catch (error) {
      this.logger.error('Failed to stat package file: %s', (error as Error).message)
      return ResDTO.fail('Failed to read uploaded package file')
    }

    this.logger.info('parsed info.toml: name=%s, sequence=%s, displayName=%s', name, sequence, displayName)

    const key = `${name}/${name}-${sequence}.${ext}`
    this.logger.info('upload file to s3: %s, size: %d', key, size)

    const fileStream = createReadStream(packageFile.data)
    await this.s3Service.uploadFile(key, fileStream, packageFile.mimeType, size)
    this.logger.info('upload file to s3 success: %s', key)

    const result = {
      key,
      sequence,
      name,
      ext,
      size,
      displayName,
      identifier,
      description,
      force,
      changelog,
    }

    await this.softwareService.saveVersion(result)

    return ResDTO.ok({
      key,
      sequence,
      name,
      ext,
      size,
    })
  }
}
```

- [ ] **步骤 2：清理 `publish.controller.ts`，移除 svn 和 file**

将 `packages/server/src/controller/publish.controller.ts` 改为只保留 s3 和 github 方法：

```typescript
import type { ILogger } from '@midwayjs/core'
import type { IMidwayKoaContext } from '@midwayjs/koa'
import type { S3Service } from '../service/s3.service'
import type { SoftwareService } from '../service/software.service'
import { Controller, Inject, Logger, Post } from '@midwayjs/core'
import { Rule, RuleType } from '@midwayjs/validate'
import { ResDTO } from '../dto/tools.dto'

class PublishDTO {
  @Rule(RuleType.string().required())
  sequence: string

  @Rule(RuleType.string().required())
  name: string

  @Rule(RuleType.string().required())
  ext: string
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
    const body = this.ctx.request.body as PublishDTO
    const { sequence, name, ext } = body
    this.logger.info('publish from s3: %j', body)

    const key = `${name}/${name}-${sequence}.${ext}`
    const size = await this.s3Service.getFileSize(key)

    await this.softwareService.saveVersion({
      name,
      sequence,
      key,
      ext,
      size,
    })

    return ResDTO.ok({
      key,
      sequence,
      name,
      ext,
      size,
    })
  }

  @Post('/github')
  async github() {
    const body = this.ctx.request.body as {
      name: string
      version: string
      downloadUrl: string
      display?: string
      identifier?: string
      description?: string
      changelog?: string
      force?: boolean
    }

    const { name, version, downloadUrl, display, identifier, description, changelog, force } = body
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

注意：移除了 `SvnService` 注入和 `UploadMiddleware`/`busboy` 相关 import（这些已搬到 InternalPublishController）。

- [ ] **步骤 3：验证编译通过**

运行：`cd packages/server && npx tsc --noEmit`
预期：无报错

- [ ] **步骤 4：Commit**

```bash
git add packages/server/src/controller/internal-publish.controller.ts packages/server/src/controller/publish.controller.ts
git commit -m "refactor(server): 拆分 svn/file 到 InternalPublishController，清理 PublishController"
```

---

### 任务 5：改造下载逻辑

**文件：**
- 修改：`packages/server/src/controller/tools.controller.ts`

- [ ] **步骤 1：抽取 URL 判断辅助方法并改造 download 和 downloadLatest**

将 `packages/server/src/controller/tools.controller.ts` 中的 `download()` 和 `downloadLatest()` 方法改为支持外部 URL 判断：

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
- 创建：`packages/server/test/controller/tools.test.ts`

- [ ] **步骤 1：更新 `publish.test.ts`，新增 github 和 internal 路由测试**

将 `packages/server/test/controller/publish.test.ts` 改为：

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

  describe('POST /api/publish/internal', () => {
    it('publish/internal/file should require info.toml', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/internal/file')
        .attach('pkg', Buffer.from('test'), { filename: 'test.exe' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('info')
    }, 30000)

    it.skip('publish/internal/svn', async () => {
      const response = await createHttpRequest(app).post('/api/publish/internal/svn').send({
        url: 'http://svn.example.com/svn/project/!svn/ver/1/releases/tool-0.0.0-1.x86_64.rpm',
        sequence: '0.0.0',
        name: 'scannerbib',
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
        sequence: '0.0.0',
        name: 'nonexistent',
        ext: 'bat',
      })
      console.log('data: ', inspect(response.body.data))
      expect(response.status).toBeDefined()
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
- `publish/internal/file should require info.toml` — PASS
- `publish/s3 should handle missing file gracefully` — PASS（可能因为 S3 不存在而失败，但不会 500）

- [ ] **步骤 3：Commit**

```bash
git add packages/server/test/controller/publish.test.ts
git commit -m "test(server): 更新 publish 测试，覆盖 github 和 internal 路由"
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
