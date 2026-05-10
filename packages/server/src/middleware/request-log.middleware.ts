import { Middleware, IMiddleware, Logger } from '@midwayjs/core'
import { NextFunction, Context } from '@midwayjs/koa'
import type { ILogger } from '@midwayjs/logger'

@Middleware()
export class RequestLogMiddleware implements IMiddleware<Context, NextFunction> {
  @Logger()
  logger: ILogger

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const startTime = Date.now()
      const { method, path, query, body } = ctx.request

      this.logger.info('[请求] %s %s query=%j body=%j', method, path, query, body)

      try {
        await next()

        const duration = Date.now() - startTime
        const { status, body: responseBody } = ctx

        if (status >= 400) {
          this.logger.warn('[响应] %s %s status=%d duration=%dms body=%j', method, path, status, duration, responseBody)
        }
        else {
          this.logger.info('[响应] %s %s status=%d duration=%dms', method, path, status, duration)
        }
      }
      catch (error) {
        const duration = Date.now() - startTime
        this.logger.error('[异常] %s %s duration=%dms error=%s', method, path, duration, (error as Error).message)
        throw error
      }
    }
  }
}
