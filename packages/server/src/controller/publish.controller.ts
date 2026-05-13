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
