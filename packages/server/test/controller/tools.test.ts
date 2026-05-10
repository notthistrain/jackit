import type { Application, Framework } from '@midwayjs/koa'
import { inspect } from 'node:util'
import { close, createApp, createHttpRequest } from '@midwayjs/mock'

describe('tools Controller', () => {
  let app: Application
  let accessToken: string

  beforeAll(async () => {
    app = await createApp<Framework>()

    const loginResponse = await createHttpRequest(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
    expect(loginResponse.status).toBe(200)
    expect(loginResponse.body.success).toBe(true)
    accessToken = loginResponse.body.data.accessToken
  })

  afterAll(async () => {
    await close(app)
  })

  describe('gET /api/tools/', () => {
    it('all software version', async () => {
      const response = await createHttpRequest(app)
        .get('/api/tools/')
        .set('Authorization', `Bearer ${accessToken}`)
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.total).toBeDefined()
      console.log('body: ', inspect(response.body.data, { depth: null, colors: true }))
    })

    it('should return signed url for existing version', async () => {
      const listResponse = await createHttpRequest(app)
        .get('/api/tools/')
        .set('Authorization', `Bearer ${accessToken}`)
      const software = listResponse.body.data?.[0]
      const versionId = software?.versions?.[0]?.versionId

      if (!versionId) {
        console.log('No versions found, skipping signed URL test')
        return
      }

      const response = await createHttpRequest(app)
        .get(`/api/tools/download/${versionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      console.log('body: ', inspect(response.body, { depth: null, colors: true }))
    })
  })
})
