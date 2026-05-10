import type { ILogger } from '@midwayjs/logger'
import { Inject, Logger, Middleware } from '@midwayjs/core'
import { NextFunction, Context } from '@midwayjs/koa'
import { JwtPayload } from '../service/auth.service'
import { PermissionService } from '../service/permission.service'

@Middleware()
export class PermissionMiddleware {
  @Inject()
  permissionService: PermissionService

  @Logger()
  logger: ILogger

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const user = ctx.state.user as JwtPayload | undefined

      if (!user) {
        return await next()
      }

      const role = user.role
      if (!role) {
        ctx.status = 403
        ctx.body = {
          success: false,
          message: '用户无角色',
          code: 'NO_ROLE',
        }
        return
      }

      const permissions = this.permissionService.getPermissions(role)
      if (!permissions) {
        this.logger.warn('No permission config for role: %s', role)
        ctx.status = 403
        ctx.body = {
          success: false,
          message: '角色无权限配置',
          code: 'NO_PERMISSION_CONFIG',
        }
        return
      }

      const { path, method } = ctx
      if (this.permissionService.matchPermission(path, method, permissions)) {
        return await next()
      }

      this.logger.warn('Permission denied: role=%s, path=%s, method=%s', role, path, method)
      ctx.status = 403
      ctx.body = {
        success: false,
        message: '权限不足',
        code: 'FORBIDDEN',
      }
    }
  }
}
