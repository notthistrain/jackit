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
