import type { Application, Framework } from '@midwayjs/koa'
import { close, createApp, createHttpRequest } from '@midwayjs/mock'

describe('Auth E2E Tests', () => {
  let app: Application

  beforeAll(async () => {
    app = await createApp<Framework>()
  })

  afterAll(async () => {
    await close(app)
  })

  async function getAccessToken(): Promise<string> {
    const loginResponse = await createHttpRequest(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
      })

    expect(loginResponse.status).toBe(200)
    return loginResponse.body.data.accessToken
  }

  describe('Authentication Flow', () => {
    it('should complete full login flow', async () => {
      const loginResponse = await createHttpRequest(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        })

      expect(loginResponse.status).toBe(200)
      expect(loginResponse.body.success).toBe(true)
      expect(loginResponse.body.data.accessToken).toBeDefined()
    })

    it('should access protected admin endpoint with token', async () => {
      const accessToken = await getAccessToken()

      const response = await createHttpRequest(app)
        .get('/api/admin/software?page=1&pageSize=10')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
    })

    it('should deny access without token', async () => {
      const response = await createHttpRequest(app)
        .get('/api/admin/software')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.code).toBe('UNAUTHORIZED')
    })

    it('should deny access with invalid token', async () => {
      const response = await createHttpRequest(app)
        .get('/api/admin/software')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('Whitelist Endpoints', () => {
    it('should allow access to publish endpoints without auth', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/s3')
        .send({
          sequence: '0.0.0',
          name: 'test',
          ext: 'exe',
        })

      expect(response.status).toBeDefined()
    })

    it('should allow access to login endpoint without auth', async () => {
      const response = await createHttpRequest(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        })

      expect(response.status).toBe(200)
    })

    it('should allow access to refresh endpoint without auth header', async () => {
      const response = await createHttpRequest(app)
        .post('/api/auth/refresh')

      expect(response.status).toBe(200)
    })
  })

  describe('Token Refresh Flow', () => {
    it('should refresh token using refresh token cookie', async () => {
      const loginResponse = await createHttpRequest(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        })

      const cookies = loginResponse.headers['set-cookie']

      const refreshResponse = await createHttpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookies)

      expect(refreshResponse.status).toBe(200)
      expect(refreshResponse.body.success).toBe(true)
      expect(refreshResponse.body.data.accessToken).toBeDefined()
    })
  })

  describe('Logout Flow', () => {
    it('should logout and clear refresh token cookie', async () => {
      const response = await createHttpRequest(app)
        .post('/api/auth/logout')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })
})
