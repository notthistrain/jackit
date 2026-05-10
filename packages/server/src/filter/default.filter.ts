import type { ILogger } from '@midwayjs/core'
import type { Context } from '@midwayjs/koa'
import { Catch, Logger } from '@midwayjs/core'

@Catch()
export class DefaultErrorFilter {
  @Logger()
  logger: ILogger

  async catch(err: Error, ctx: Context) {
    this.logger.error('catch error: %s', err.message)

    let statusCode = 500
    const message = err.message

    if (err.name === 'MidwayValidationError' || err.message.includes('is required')) {
      statusCode = 400
    }

    ctx.status = statusCode

    return {
      success: false,
      message,
    }
  }
}
