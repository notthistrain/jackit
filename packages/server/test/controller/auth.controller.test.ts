import type { Application, Framework } from '@midwayjs/koa'
import { close, createApp, createHttpRequest } from '@midwayjs/mock'

describe('authController', () => {
  let app: Application

  beforeAll(async () => {
    app = await createApp<Framework>()
  })

  afterAll(async () => {
    await close(app)
  })

  describe('pOST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await createHttpRequest(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.expiresIn).toBe(3600)
      expect(response.body.data.userId).toBeDefined()
      expect(response.body.data.username).toBe('admin')
      expect(response.headers['set-cookie']).toBeDefined()
    })

    it('should fail login with wrong username', async () => {
      const response = await createHttpRequest(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('错误')
    })

    it('should fail login with wrong password', async () => {
      const response = await createHttpRequest(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('错误')
    })
  })

  describe('pOST /api/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      const loginResponse = await createHttpRequest(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        })

      const cookies = loginResponse.headers['set-cookie']

      const response = await createHttpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookies)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.accessToken).toBeDefined()
    })

    it('should fail refresh without refresh token', async () => {
      const response = await createHttpRequest(app)
        .post('/api/auth/refresh')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('刷新令牌')
    })
  })

  describe('pOST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await createHttpRequest(app)
        .post('/api/auth/logout')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('成功')
    })
  })
})
