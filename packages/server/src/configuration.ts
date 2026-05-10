import { join } from 'node:path'
import * as busboy from '@midwayjs/busboy'
import { App, Configuration, Inject, Logger } from '@midwayjs/core'
import * as info from '@midwayjs/info'
import * as jwt from '@midwayjs/jwt'
import * as koa from '@midwayjs/koa'
import * as staticFile from '@midwayjs/static-file'
import * as typeorm from '@midwayjs/typeorm'
import * as validate from '@midwayjs/validate'
import type { ILogger } from '@midwayjs/logger'
import { AuthService } from './service/auth.service'
import { RoleService } from './service/role.service'
import { DefaultErrorFilter } from './filter/default.filter'
import { AuthMiddleware } from './middleware/auth.middleware'
import { PermissionMiddleware } from './middleware/permission.middleware'
import { RequestLogMiddleware } from './middleware/request-log.middleware'

@Configuration({
  imports: [
    koa,
    validate,
    typeorm,
    busboy,
    staticFile,
    jwt,
    {
      component: info,
      enabledEnvironment: ['local'],
    },
  ],
  importConfigs: [join(__dirname, './config')],
})
export class MainConfiguration {
  @App('koa')
  app: koa.Application

  @Logger()
  logger: ILogger

  @Inject()
  authService: AuthService

  @Inject()
  roleService: RoleService

  async onReady() {
    this.logger.info('SVNLink 服务启动中...')
    await this.roleService.initDefaultRolesAndUsers()
    this.logger.info('注册中间件: RequestLogMiddleware')
    this.app.useMiddleware([RequestLogMiddleware])
    this.logger.info('注册中间件: AuthMiddleware')
    this.app.useMiddleware([AuthMiddleware])
    this.logger.info('注册中间件: PermissionMiddleware')
    this.app.useMiddleware([PermissionMiddleware])
    this.logger.info('注册过滤器: DefaultErrorFilter')
    this.app.useFilter([DefaultErrorFilter])
    this.logger.info('SVNLink 服务启动完成，监听端口 7001')
  }
}
