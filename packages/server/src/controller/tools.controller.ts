import type { ILogger } from '@midwayjs/core'
import type { SoftwareListItemDTO, SoftwareVersionDTO } from '../dto/tools.dto'
import type { S3Service } from '../service/s3.service'
import type { SoftwareService } from '../service/software.service'
import { Controller, Get, Inject, Logger, Param } from '@midwayjs/core'
import { ResDTO } from '../dto/tools.dto'

@Controller('/tools')
export class ToolsController {
  @Logger()
  logger: ILogger

  @Inject()
  softwareService: SoftwareService

  @Inject()
  s3Service: S3Service

  @Get('/')
  async getAllSoftware() {
    this.logger.info('Get all software request')
    const softwareList = await this.softwareService.getSoftwareWithLatestVersion()
    this.logger.info('Found %d software', softwareList.length)

    const data = softwareList.map((s) => {
      const versions = s.versions.map((v) => {
        const version: SoftwareVersionDTO = {
          versionId: v.id,
          sequence: v.sequence,
          size: v.size,
          force: v.force,
          changelog: v.changelog,
          createdAt: v.createdAt,
        }
        return version
      })
      const data: SoftwareListItemDTO = {
        id: s.id,
        name: s.name,
        ext: s.ext,
        displayName: s.displayName,
        identifier: s.identifier,
        description: s.description,
        versions,
      }
      return data
    })

    return ResDTO.ok(data)
  }

  @Get('/download/:id')
  async download(@Param('id') id: number) {
    this.logger.info('Download request for version id: %d', id)
    const version = await this.softwareService.getVersionById(id)
    if (!version) {
      this.logger.warn('Version not found: %d', id)
      return ResDTO.fail(`Version '${id}' not found`)
    }
    if (!version.key) {
      this.logger.warn('No s3Key for version: %d', id)
      return ResDTO.fail(`No download file for version '${id}'`)
    }
    const url = await this.getDownloadUrl(version.key)
    this.logger.info('Generated download url for version: %d', id)
    return ResDTO.ok({ url })
  }

  @Get('/download-latest/:name')
  async downloadLatest(@Param('name') name: string) {
    this.logger.info('Download latest request for software: %s', name)
    const software = await this.softwareService.getSoftwareByName(name)
    if (!software) {
      this.logger.warn('Software not found: %s', name)
      return ResDTO.fail(`Software '${name}' not found`)
    }
    if (!software.versions || software.versions.length === 0) {
      this.logger.warn('No versions for software: %s', name)
      return ResDTO.fail(`No versions available for '${name}'`)
    }
    const latestVersion = software.versions[0]
    if (!latestVersion.key) {
      this.logger.warn('No s3Key for latest version of: %s', name)
      return ResDTO.fail(`No download file for '${name}'`)
    }
    const filename = `${software.name}.${software.ext || 'exe'}`
    const url = await this.getDownloadUrl(latestVersion.key, filename)
    this.logger.info('Generated download url for %s version %s', name, latestVersion.sequence)
    return ResDTO.ok({
      url,
      version: latestVersion.sequence,
      size: latestVersion.size,
      displayName: software.displayName || software.name,
    })
  }

  private isExternalUrl(key: string): boolean {
    return key.startsWith('http://') || key.startsWith('https://')
  }

  private async getDownloadUrl(key: string, filename?: string): Promise<string> {
    if (this.isExternalUrl(key)) {
      return key
    }
    return await this.s3Service.getSignedUrl(key, undefined, filename)
  }
}
