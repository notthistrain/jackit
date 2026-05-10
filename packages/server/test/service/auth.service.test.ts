import type { Application, Framework } from '@midwayjs/koa'
import { close, createApp } from '@midwayjs/mock'
import { AuthService } from '../../src/service/auth.service'

describe('AuthService', () => {
  let app: Application
  let authService: AuthService

  beforeAll(async () => {
    app = await createApp<Framework>()
    authService = await app.getApplicationContext().getAsync(AuthService)
  })

  afterAll(async () => {
    await close(app)
  })

  describe('hashPassword and verifyPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123'
      const hash = await authService.hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should verify correct password', async () => {
      const password = 'testPassword123'
      const hash = await authService.hashPassword(password)

      const isValid = await authService.verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject wrong password', async () => {
      const password = 'testPassword123'
      const hash = await authService.hashPassword(password)

      const isValid = await authService.verifyPassword('wrongPassword', hash)
      expect(isValid).toBe(false)
    })

    it('should verify empty password', async () => {
      const password = ''
      const hash = await authService.hashPassword(password)

      const isValid = await authService.verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })
  })

  describe('generateAccessToken and verifyToken', () => {
    it('should generate valid access token', async () => {
      const userId = 1
      const username = 'testuser'
      const role = 'super'

      const token = await authService.generateAccessToken(userId, username, role)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('should verify valid token and return payload', async () => {
      const userId = 1
      const username = 'testuser'
      const role = 'super'

      const token = await authService.generateAccessToken(userId, username, role)
      const payload = await authService.verifyToken(token)

      expect(payload).toBeDefined()
      expect(payload.userId).toBe(userId)
      expect(payload.username).toBe(username)
      expect(payload.role).toBe(role)
    })

    it('should reject invalid token', async () => {
      await expect(authService.verifyToken('invalid-token')).rejects.toThrow()
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate valid refresh token', async () => {
      const userId = 1
      const username = 'testuser'
      const role = 'super'

      const token = await authService.generateRefreshToken(userId, username, role)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })
  })

  describe('login', () => {
    it('should login with correct admin credentials', async () => {
      const result = await authService.login('admin', 'admin123')

      expect(result).not.toBeNull()
      expect(result!.accessToken).toBeDefined()
      expect(result!.expiresIn).toBe(3600)
      expect(result!.userId).toBeDefined()
      expect(result!.username).toBe('admin')
      expect(result!.role).toBe('super')
    })

    it('should login with guest credentials (empty password)', async () => {
      const result = await authService.login('guest', '')

      expect(result).not.toBeNull()
      expect(result!.accessToken).toBeDefined()
      expect(result!.username).toBe('guest')
      expect(result!.role).toBe('guest')
    })

    it('should fail login with wrong username', async () => {
      const result = await authService.login('nonexistent', 'password')

      expect(result).toBeNull()
    })

    it('should fail login with wrong password', async () => {
      const result = await authService.login('admin', 'wrongpassword')

      expect(result).toBeNull()
    })
  })

  describe('refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      const loginResult = await authService.login('admin', 'admin123')
      expect(loginResult).not.toBeNull()

      const refreshToken = await authService.generateRefreshToken(
        loginResult!.userId,
        loginResult!.username,
        loginResult!.role,
      )

      const refreshResult = await authService.refresh(refreshToken)

      expect(refreshResult).not.toBeNull()
      expect(refreshResult!.accessToken).toBeDefined()
      expect(refreshResult!.userId).toBe(loginResult!.userId)
      expect(refreshResult!.username).toBe('admin')
      expect(refreshResult!.role).toBe('super')
    })

    it('should fail refresh with invalid token', async () => {
      const result = await authService.refresh('invalid-refresh-token')

      expect(result).toBeNull()
    })
  })

  describe('getAccessTokenExpiresIn and getRefreshTokenExpiresIn', () => {
    it('should return correct expiration times', () => {
      expect(authService.getAccessTokenExpiresIn()).toBe(3600)
      expect(authService.getRefreshTokenExpiresIn()).toBe(604800)
    })
  })
})
