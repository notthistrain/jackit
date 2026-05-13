import type { ILogger } from '@midwayjs/core'
import type { IMidwayKoaContext } from '@midwayjs/koa'
import type {
  CreateSoftwareDTO,
  CreateVersionDTO,
  GetLogsDTO,
  GetSoftwareListDTO,
  UpdateSettingDTO,
  UpdateSoftwareDTO,
  UpdateVersionDTO,
} from '../dto/admin.dto'
import type { AdminService } from '../service/admin.service'
import { Controller, Del, Get, Inject, Logger, Param, Post, Put, Query } from '@midwayjs/core'
import { Validate } from '@midwayjs/validate'

@Controller('/admin')
export class AdminController {
  @Inject()
  adminService: AdminService

  @Inject()
  ctx: IMidwayKoaContext

  @Logger()
  logger: ILogger

  @Get('/software')
  @Validate()
  async getSoftwareList(@Query() query: GetSoftwareListDTO) {
    this.logger.info('获取软件列表: page=%d, pageSize=%d, keyword=%s', query.page, query.pageSize, query.keyword || '')
    return await this.adminService.getSoftwareList(
      query.page,
      query.pageSize,
      query.keyword,
    )
  }

  @Get('/software/:id')
  async getSoftwareById(@Param('id') id: number) {
    this.logger.info('获取软件详情: id=%d', id)
    return await this.adminService.getSoftwareById(id)
  }

  @Post('/software')
  async createSoftware() {
    const body = this.ctx.request.body as CreateSoftwareDTO
    this.logger.info('创建软件: %j', body)
    const result = await this.adminService.createSoftware(body)
    await this.adminService.createLog(
      'create_software',
      `software:${result.id}`,
      JSON.stringify(body),
    )
    return result
  }

  @Put('/software/:id')
  async updateSoftware(@Param('id') id: number) {
    const body = this.ctx.request.body as UpdateSoftwareDTO
    this.logger.info('更新软件: id=%d, body=%j', id, body)
    const result = await this.adminService.updateSoftware(id, body)
    await this.adminService.createLog(
      'update_software',
      `software:${id}`,
      JSON.stringify(body),
    )
    return result
  }

  @Del('/software/:id')
  async deleteSoftware(@Param('id') id: number) {
    this.logger.info('删除软件: id=%d', id)
    const result = await this.adminService.deleteSoftware(id)
    if (result) {
      await this.adminService.createLog(
        'delete_software',
        `software:${id}`,
        JSON.stringify({ name: result.name }),
      )
    }
    return result
  }

  @Get('/software/:id/versions')
  async getSoftwareVersions(@Param('id') id: number) {
    this.logger.info('获取软件版本列表: softwareId=%d', id)
    return await this.adminService.getVersionsBySoftwareId(id)
  }

  @Post('/software/:id/versions')
  async createVersion(@Param('id') id: number) {
    const body = this.ctx.request.body as CreateVersionDTO
    this.logger.info('创建版本: softwareId=%d, body=%j', id, body)
    const result = await this.adminService.createVersion(id, body)
    await this.adminService.createLog(
      'create_version',
      `software:${id}:version:${result.id}`,
      JSON.stringify(body),
    )
    return result
  }

  @Get('/version/:id')
  async getVersionById(@Param('id') id: number) {
    this.logger.info('获取版本详情: id=%d', id)
    return await this.adminService.getVersionById(id)
  }

  @Put('/version/:id')
  async updateVersion(@Param('id') id: number) {
    const body = this.ctx.request.body as UpdateVersionDTO
    this.logger.info('更新版本: id=%d, body=%j', id, body)
    const result = await this.adminService.updateVersion(id, body)
    await this.adminService.createLog(
      'update_version',
      `version:${id}`,
      JSON.stringify(body),
    )
    return result
  }

  @Del('/version/:id')
  async deleteVersion(@Param('id') id: number) {
    this.logger.info('删除版本: id=%d', id)
    const result = await this.adminService.deleteVersion(id)
    if (result) {
      await this.adminService.createLog(
        'delete_version',
        `version:${id}`,
        JSON.stringify(result),
      )
    }
    return result
  }

  @Get('/logs')
  @Validate()
  async getLogs(@Query() query: GetLogsDTO) {
    this.logger.info('获取日志列表: page=%d, pageSize=%d, action=%s', query.page, query.pageSize, query.action || '')
    return await this.adminService.getLogs(
      query.page,
      query.pageSize,
      query.keyword,
      query.action,
    )
  }

  @Get('/settings')
  async getSettings() {
    this.logger.info('获取系统设置')
    return await this.adminService.getSettings()
  }

  @Put('/settings')
  async updateSetting() {
    const body = this.ctx.request.body as UpdateSettingDTO
    this.logger.info('更新系统设置: key=%s', body.key)
    const result = await this.adminService.updateSetting(body.key, body.value)
    await this.adminService.createLog(
      'update_setting',
      `setting:${body.key}`,
      body.value,
    )
    return result
  }
}
