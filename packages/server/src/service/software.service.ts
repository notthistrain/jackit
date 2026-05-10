import type { ILogger } from '@midwayjs/core'
import type { Repository } from 'typeorm'
import { Inject, Singleton } from '@midwayjs/core'
import { InjectEntityModel } from '@midwayjs/typeorm'
import { SoftwareVersion } from '../entity/software-version.entity'
import { Software } from '../entity/software.entity'

export interface SaveSoftwareVersionParams {
  name: string
  sequence: string
  key: string
  ext: string
  size: number
  displayName?: string
  identifier?: string
  description?: string
  force?: boolean
  changelog?: string
}

@Singleton()
export class SoftwareService {
  @Inject()
  logger: ILogger

  @InjectEntityModel(Software)
  softwareRepository: Repository<Software>

  @InjectEntityModel(SoftwareVersion)
  versionRepository: Repository<SoftwareVersion>

  async saveVersion(params: SaveSoftwareVersionParams) {
    let software = await this.softwareRepository.findOne({
      where: { name: params.name },
    })

    if (!software) {
      software = this.softwareRepository.create({
        name: params.name,
        displayName: params.displayName || params.name,
        ext: params.ext,
        identifier: params.identifier,
        description: params.description,
      })
      await this.softwareRepository.save(software)
      this.logger.info('Created new software: %s', params.name)
    }
    else if (params.displayName || params.identifier || params.description) {
      if (params.displayName)
        software.displayName = params.displayName
      if (params.identifier)
        software.identifier = params.identifier
      if (params.description)
        software.description = params.description
      await this.softwareRepository.save(software)
    }

    const existingVersion = await this.versionRepository.findOne({
      where: {
        softwareId: software.id,
        sequence: params.sequence,
      },
    })

    if (existingVersion) {
      existingVersion.key = params.key
      if (params.size !== undefined && params.size > 0)
        existingVersion.size = params.size
      if (params.force !== undefined)
        existingVersion.force = params.force
      if (params.changelog !== undefined)
        existingVersion.changelog = params.changelog
      await this.versionRepository.save(existingVersion)
      this.logger.info('Updated version: %s-%s', params.name, params.sequence)
      return existingVersion
    }

    const versionData: Partial<SoftwareVersion> = {
      sequence: params.sequence,
      key: params.key,
      softwareId: software.id,
      force: params.force || false,
      changelog: params.changelog,
    }
    if (params.size !== undefined && params.size > 0) {
      versionData.size = params.size
    }
    const version = this.versionRepository.create(versionData)

    const savedVersion = await this.versionRepository.save(version)
    this.logger.info('Saved new version: %s-%s', params.name, params.sequence)

    return savedVersion
  }

  async getAllSoftware(): Promise<Software[]> {
    return this.softwareRepository.find({
      relations: ['versions'],
      order: { createdAt: 'DESC' },
    })
  }

  async getSoftwareWithLatestVersion() {
    return this.softwareRepository.find({
      relations: ['versions'],
      order: { createdAt: 'DESC' },
    })
  }

  async getSoftwareByName(name: string): Promise<Software | null> {
    return this.softwareRepository.findOne({
      where: { name },
      relations: ['versions'],
      order: { versions: { createdAt: 'DESC' } },
    })
  }

  async getVersionById(id: number): Promise<SoftwareVersion | null> {
    return this.versionRepository.findOne({
      where: { id },
      relations: ['software'],
    })
  }
}
