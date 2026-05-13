import type { Repository } from 'typeorm'
import { Singleton } from '@midwayjs/core'
import { InjectEntityModel } from '@midwayjs/typeorm'
import { Like } from 'typeorm'
import { OperationLog, Software, SoftwareVersion, SystemSetting } from '../entity'

@Singleton()
export class AdminService {
  @InjectEntityModel(Software)
  softwareModel: Repository<Software>

  @InjectEntityModel(SoftwareVersion)
  versionModel: Repository<SoftwareVersion>

  @InjectEntityModel(OperationLog)
  logModel: Repository<OperationLog>

  @InjectEntityModel(SystemSetting)
  settingModel: Repository<SystemSetting>

  async getSoftwareList(page: number, pageSize: number, keyword: string) {
    const where = keyword ? [{ name: Like(`%${keyword}%`) }, { displayName: Like(`%${keyword}%`) }] : {}

    const [data, total] = await this.softwareModel.findAndCount({
      where,
      relations: ['versions'],
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return { data, total, page, pageSize }
  }

  async getSoftwareById(id: number) {
    return await this.softwareModel.findOne({
      where: { id },
      relations: ['versions'],
    })
  }

  async createSoftware(data: Partial<Software>) {
    const software = this.softwareModel.create(data)
    return await this.softwareModel.save(software)
  }

  async updateSoftware(id: number, data: Partial<Software>) {
    await this.softwareModel.update(id, data)
    return await this.getSoftwareById(id)
  }

  async deleteSoftware(id: number) {
    const software = await this.getSoftwareById(id)
    if (!software) {
      return null
    }
    await this.softwareModel.delete(id)
    return software
  }

  async getVersionsBySoftwareId(softwareId: number) {
    return await this.versionModel.find({
      where: { softwareId },
      order: { createdAt: 'DESC' },
    })
  }

  async getVersionById(id: number) {
    return await this.versionModel.findOne({
      where: { id },
      relations: ['software'],
    })
  }

  async createVersion(softwareId: number, data: Partial<SoftwareVersion>) {
    const version = this.versionModel.create({
      ...data,
      softwareId,
    })
    return await this.versionModel.save(version)
  }

  async updateVersion(id: number, data: Partial<SoftwareVersion>) {
    await this.versionModel.update(id, data)
    return await this.getVersionById(id)
  }

  async deleteVersion(id: number) {
    const version = await this.getVersionById(id)
    if (!version) {
      return null
    }
    await this.versionModel.delete(id)
    return version
  }

  async getLogs(page: number, pageSize: number, keyword: string, action?: string) {
    const where: any = {}
    if (keyword) {
      where.detail = Like(`%${keyword}%`)
    }
    if (action) {
      where.action = action
    }

    const [data, total] = await this.logModel.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return { data, total, page, pageSize }
  }

  async getSettings() {
    return await this.settingModel.find()
  }

  async getSettingByKey(key: string) {
    return await this.settingModel.findOne({ where: { key } })
  }

  async updateSetting(key: string, value: string) {
    const setting = await this.getSettingByKey(key)
    if (setting) {
      await this.settingModel.update({ key }, { value })
    }
    else {
      await this.settingModel.save({ key, value })
    }
    return await this.getSettingByKey(key)
  }

  async createLog(action: string, target: string, detail: string | undefined | null, operator?: string) {
    return await this.logModel.save({
      action,
      target,
      detail: detail ?? '',
      operator,
    })
  }
}
