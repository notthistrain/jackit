import type { Context, NextFunction } from '@midwayjs/koa'
import type { ILogger } from '@midwayjs/logger'
import type { JwtPayload } from '../service/auth.service'
import type { PermissionService } from '../service/permission.service'
import { Inject, Logger, Middleware } from '@midwayjs/core'

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
