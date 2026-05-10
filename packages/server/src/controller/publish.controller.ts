import type { UploadFileInfo } from '@midwayjs/busboy'
import type { ILogger } from '@midwayjs/core'
import type { IMidwayKoaContext } from '@midwayjs/koa'
import type { S3Service } from '../service/s3.service'
import type { SoftwareService } from '../service/software.service'
import type { SvnService } from '../service/svn.service'
import * as TOML from '@iarna/toml'
import { UploadMiddleware } from '@midwayjs/busboy'
import { Controller, Files, Inject, Logger, Post } from '@midwayjs/core'
import { Rule, RuleType } from '@midwayjs/validate'
import { statSync, createReadStream, readFileSync } from 'node:fs'
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

@Controller('/publish')
export class PublishController {
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

  @Post('/file', { middleware: [UploadMiddleware] })
  async file(@Files() files: Array<UploadFileInfo>) {
    this.logger.info('file upload request, files count: %d', files?.length || 0)

    if (!files?.length) {
      this.logger.warn('no files uploaded')
      return ResDTO.fail('No file uploaded')
    }

    this.logger.info(
      'uploaded files: %j',
      files.map((f) => ({ fieldName: f.fieldName, filename: f.filename, data: f.data })),
    )

    const infoFile = files.find((f) => f.fieldName === 'info' || f.filename?.endsWith('.toml'))
    if (!infoFile) {
      this.logger.warn('info file not found in uploaded files')
      return ResDTO.fail('info file is required')
    }
    const packageFile = files.find((f) => f.fieldName === 'pkg')
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

    return ResDTO.ok(result)
  }
}
