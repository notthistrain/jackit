import type { ILogger } from '@midwayjs/core'
import type { IMidwayKoaContext } from '@midwayjs/koa'
import { Config, Controller, Inject, Logger, Post } from '@midwayjs/core'
import { Rule, RuleType } from '@midwayjs/validate'
import { AuthService } from '../service/auth.service'

class LoginDTO {
  @Rule(RuleType.string().required())
  username: string

  @Rule(RuleType.string().required())
  password: string
}

@Controller('/auth')
export class AuthController {
  @Inject()
  authService: AuthService

  @Inject()
  ctx: IMidwayKoaContext

  @Logger()
  logger: ILogger

  @Config('cookie')
  cookieConfig: { secure: boolean }

  @Post('/login')
  async login() {
    const body = this.ctx.request.body as LoginDTO
    this.logger.info('Login attempt: %s', body.username)

    const result = await this.authService.login(body.username, body.password)
    if (!result) {
      return {
        success: false,
        message: '用户名或密码错误',
      }
    }

    const refreshToken = await this.authService.generateRefreshToken(
      result.userId,
      result.username,
      result.role,
    )

    this.ctx.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.cookieConfig.secure,
      sameSite: 'strict',
      maxAge: this.authService.getRefreshTokenExpiresIn() * 1000,
    })

    this.ctx.cookies.set('accessToken', result.accessToken, {
      httpOnly: false,
      secure: this.cookieConfig.secure,
      sameSite: 'strict',
      maxAge: result.expiresIn * 1000,
    })

    return {
      success: true,
      data: result,
    }
  }

  @Post('/refresh')
  async refresh() {
    const refreshToken = this.ctx.cookies.get('refreshToken')
    if (!refreshToken) {
      return {
        success: false,
        message: '未找到刷新令牌',
      }
    }

    const result = await this.authService.refresh(refreshToken)
    if (!result) {
      return {
        success: false,
        message: '刷新令牌无效或已过期',
      }
    }

    return {
      success: true,
      data: result,
    }
  }

  @Post('/logout')
  async logout() {
    this.ctx.cookies.set('refreshToken', '', {
      httpOnly: true,
      expires: new Date(0),
    })

    this.ctx.cookies.set('accessToken', '', {
      httpOnly: false,
      expires: new Date(0),
    })

    return {
      success: true,
      message: '登出成功',
    }
  }
}
