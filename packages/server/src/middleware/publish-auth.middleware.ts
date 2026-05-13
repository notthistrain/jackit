import type { Context, NextFunction } from '@midwayjs/koa'
import { Config, Middleware } from '@midwayjs/core'

@Middleware()
export class PublishAuthMiddleware {
  @Config('publish.token')
  publishToken: string

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const authHeader = ctx.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        ctx.status = 401
        ctx.body = { success: false, message: 'Missing or invalid Authorization header' }
        return
      }

      const token = authHeader.slice(7)
      if (token !== this.publishToken) {
        ctx.status = 401
        ctx.body = { success: false, message: 'Invalid publish token' }
        return
      }

      return await next()
    }
  }
}
