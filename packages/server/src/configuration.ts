import type { ILogger } from '@midwayjs/logger'
import type { AuthService } from './service/auth.service'
import type { RoleService } from './service/role.service'
import { join } from 'node:path'
import * as busboy from '@midwayjs/busboy'
import { App, Config, Configuration, Inject, Logger } from '@midwayjs/core'
import * as info from '@midwayjs/info'
import * as jwt from '@midwayjs/jwt'
import * as koa from '@midwayjs/koa'
import * as staticFile from '@midwayjs/static-file'
import * as typeorm from '@midwayjs/typeorm'
import * as validate from '@midwayjs/validate'
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
    {
      component: staticFile,
      enabledEnvironment: ['prod', 'unittest'],
    },
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

  @Config('jwt.secret')
  jwtSecret: string

  async onReady() {
    this.logger.info('upgrade-component 服务启动中...')

    // Warn if using insecure default JWT secret
    if (this.jwtSecret === 'dev_jwt_secret_change_in_production') {
      this.logger.warn('[安全警告] 正在使用默认 JWT 密钥，请在 config.toml 中设置 [jwt] secret')
    }

    await this.roleService.initDefaultRolesAndUsers()
    this.logger.info('注册中间件: RequestLogMiddleware')
    this.app.useMiddleware([RequestLogMiddleware])
    this.logger.info('注册中间件: AuthMiddleware')
    this.app.useMiddleware([AuthMiddleware])
    this.logger.info('注册中间件: PermissionMiddleware')
    this.app.useMiddleware([PermissionMiddleware])
    this.logger.info('注册过滤器: DefaultErrorFilter')
    this.app.useFilter([DefaultErrorFilter])
    this.logger.info('upgrade-component 服务启动完成，监听端口 7001')
  }
}
