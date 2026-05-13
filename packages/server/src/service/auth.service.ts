import type { ILogger } from '@midwayjs/core'
import type { JwtService } from '@midwayjs/jwt'
import type { Repository } from 'typeorm'
import { Config, Inject, Logger, Singleton } from '@midwayjs/core'
import { InjectEntityModel } from '@midwayjs/typeorm'
import * as bcrypt from 'bcryptjs'
import { User } from '../entity'
import { Role } from '../entity/role.entity'

export interface LoginResult {
  accessToken: string
  expiresIn: number
  userId: number
  username: string
  role: string
}

export interface JwtPayload {
  userId: number
  username: string
  role: string
  iat?: number
  exp?: number
}

@Singleton()
export class AuthService {
  @InjectEntityModel(User)
  userModel: Repository<User>

  @InjectEntityModel(Role)
  roleModel: Repository<Role>

  @Inject()
  jwtService: JwtService

  @Logger()
  logger: ILogger

  @Config('admin.defaultPassword')
  adminDefaultPassword: string

  private readonly accessTokenExpiresIn = 3600
  private readonly refreshTokenExpiresIn = 604800

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  async generateAccessToken(userId: number, username: string, role: string): Promise<string> {
    const payload: JwtPayload = { userId, username, role }
    return this.jwtService.sign(payload, { expiresIn: this.accessTokenExpiresIn })
  }

  async generateRefreshToken(userId: number, username: string, role: string): Promise<string> {
    const payload: JwtPayload = { userId, username, role }
    return this.jwtService.sign(payload, { expiresIn: this.refreshTokenExpiresIn })
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    const result = await this.jwtService.verify(token)
    return result as unknown as JwtPayload
  }

  async login(username: string, password: string): Promise<LoginResult | null> {
    const user = await this.userModel.findOne({
      where: { username },
      relations: ['role'],
    })
    if (!user) {
      this.logger.warn('Login failed: user not found - %s', username)
      return null
    }

    const isValid = await this.verifyPassword(password, user.passwordHash)
    if (!isValid) {
      this.logger.warn('Login failed: invalid password - %s', username)
      return null
    }

    const roleName = user.role?.name || 'guest'
    const accessToken = await this.generateAccessToken(user.id, user.username, roleName)
    this.logger.info('User logged in: %s with role: %s', username, roleName)

    return {
      accessToken,
      expiresIn: this.accessTokenExpiresIn,
      userId: user.id,
      username: user.username,
      role: roleName,
    }
  }

  async refresh(refreshToken: string): Promise<LoginResult | null> {
    try {
      const payload = await this.verifyToken(refreshToken)
      const user = await this.userModel.findOne({
        where: { id: payload.userId },
        relations: ['role'],
      })
      if (!user) {
        return null
      }

      const roleName = user.role?.name || 'guest'
      const accessToken = await this.generateAccessToken(user.id, user.username, roleName)
      return {
        accessToken,
        expiresIn: this.accessTokenExpiresIn,
        userId: user.id,
        username: user.username,
        role: roleName,
      }
    }
    catch (error) {
      this.logger.warn('Token refresh failed: %s', (error as Error).message)
      return null
    }
  }

  async initDefaultUser(): Promise<void> {
    const existingUser = await this.userModel.findOne({ where: { username: 'admin' } })
    if (existingUser) {
      this.logger.info('Default admin user already exists')
      return
    }

    const password = this.adminDefaultPassword || 'admin123'
    const passwordHash = await this.hashPassword(password)
    const user = this.userModel.create({
      username: 'admin',
      passwordHash,
    })
    await this.userModel.save(user)
    this.logger.info('Default admin user created')
  }

  getAccessTokenExpiresIn(): number {
    return this.accessTokenExpiresIn
  }

  getRefreshTokenExpiresIn(): number {
    return this.refreshTokenExpiresIn
  }
}
