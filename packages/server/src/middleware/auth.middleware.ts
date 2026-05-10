import { join } from 'node:path'
import { existsSync, createReadStream } from 'node:fs'
import type { ILogger } from '@midwayjs/logger'
import { Inject, Logger, Middleware } from '@midwayjs/core'
import { NextFunction, Context } from '@midwayjs/koa'
import { AuthService, JwtPayload } from '../service/auth.service'

const adminDistPath = join(__dirname, '../../admin')

const routeAlias: Record<string, string> = {
  '/': '/index.html',
  '/software': '/software/index.html',
  '/logs': '/logs/index.html',
  '/manual': '/manual/index.html',
  '/login': '/login/index.html',
  '/download': '/download/index.html',
}

const PUBLIC_API_PREFIX = [
  '/api/publish',
  '/api/tools',
  '/api/health',
]

const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
]

const PUBLIC_PAGE_PATHS = [
  '/login',
  '/manual',
  '/download',
]

function isPublicApiPath(path: string): boolean {
  if (PUBLIC_API_PREFIX.some(prefix => path.startsWith(prefix))) {
    return true
  }
  return PUBLIC_API_PATHS.includes(path)
}

function isPublicPagePath(path: string): boolean {
  const queryIndex = path.indexOf('?')
  const cleanPath = queryIndex === -1 ? path : path.substring(0, queryIndex)
  return PUBLIC_PAGE_PATHS.includes(cleanPath)
}

function isApiRequest(path: string): boolean {
  return path.startsWith('/api/')
}

function handleRouteAlias(ctx: Context): boolean {
  const path = ctx.path
  const queryIndex = path.indexOf('?')
  const cleanPath = queryIndex === -1 ? path : path.substring(0, queryIndex)

  const aliasTarget = routeAlias[cleanPath]
  if (aliasTarget) {
    const filePath = join(adminDistPath, aliasTarget)
    if (existsSync(filePath)) {
      ctx.status = 200
      ctx.type = 'html'
      ctx.body = createReadStream(filePath)
      return true
    }
  }
  return false
}

@Middleware()
export class AuthMiddleware {
  @Inject()
  authService: AuthService

  @Logger()
  logger: ILogger

  private async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      return await this.authService.verifyToken(token) as JwtPayload
    }
    catch (error) {
      this.logger.warn('Token verification failed: %s', (error as Error).message)
      return null
    }
  }

  private getTokenFromRequest(ctx: Context): string | null {
    const authHeader = ctx.get('Authorization')
    if (authHeader) {
      return authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader
    }

    const cookieToken = ctx.cookies.get('accessToken')
    return cookieToken || null
  }

  private handleUnauthorizedApi(ctx: Context, message: string, code: string) {
    ctx.status = 401
    ctx.body = {
      success: false,
      message,
      code,
    }
  }

  private async handleApiRequest(ctx: Context, next: NextFunction) {
    const token = this.getTokenFromRequest(ctx)

    if (!token) {
      this.handleUnauthorizedApi(ctx, '未登录', 'UNAUTHORIZED')
      return
    }

    const payload = await this.verifyToken(token)
    if (!payload) {
      this.handleUnauthorizedApi(ctx, '登录已过期，请重新登录', 'TOKEN_EXPIRED')
      return
    }

    ctx.state.user = payload
    await next()
  }

  private async handlePageRequest(ctx: Context) {
    if (isPublicPagePath(ctx.path)) {
      handleRouteAlias(ctx)
      return
    }

    const token = this.getTokenFromRequest(ctx)

    if (!token) {
      ctx.redirect('/login')
      return
    }

    const payload = await this.verifyToken(token)
    if (!payload || !payload.role || payload.role === 'guest') {
      ctx.redirect('/login')
      return
    }

    ctx.state.user = payload
    handleRouteAlias(ctx)
  }

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const { path } = ctx

      if (isPublicApiPath(path)) {
        return await next()
      }

      if (isApiRequest(path)) {
        return await this.handleApiRequest(ctx, next)
      }

      return await this.handlePageRequest(ctx)
    }
  }
}
