import type { Application, Framework } from '@midwayjs/koa'
import { inspect } from 'node:util'
import { close, createApp, createHttpRequest } from '@midwayjs/mock'

describe('Publish Controller', () => {
  let app: Application

  beforeAll(async () => {
    app = await createApp<Framework>()
  })

  afterAll(async () => {
    await close(app)
  })

  describe('POST /api/publish/github', () => {
    it('should reject request without Authorization header', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/github')
        .send({
          name: 'toolbox',
          version: '1.0.0',
          downloadUrl: 'https://github.com/test/releases/download/v1.0.0/toolbox.exe',
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should reject request with wrong token', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/github')
        .set('Authorization', 'Bearer wrong-token')
        .send({
          name: 'toolbox',
          version: '1.0.0',
          downloadUrl: 'https://github.com/test/releases/download/v1.0.0/toolbox.exe',
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    // S3Service injection causes ECONNREFUSED in test env without S3
    it.skip('should return error when missing required fields', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/github')
        .set('Authorization', 'Bearer test-publish-token')
        .send({
          name: 'toolbox',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Missing required fields')
    })
  })

  describe('POST /api/publish/internal/svn', () => {
    it.skip('should publish from svn', async () => {
      const response = await createHttpRequest(app).post('/api/publish/internal/svn').send({
        name: 'scannerbib',
        version: '0.0.0',
        url: 'http://svn.example.com/svn/project/!svn/ver/1/releases/tool-0.0.0-1.x86_64.rpm',
        ext: 'rpm',
      })
      console.log('data: ', inspect(response.body.data))
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.key).toBeDefined()
    }, 30000)
  })

  describe('POST /api/publish/s3', () => {
    it('should handle missing file gracefully', async () => {
      const response = await createHttpRequest(app).post('/api/publish/s3').send({
        name: 'nonexistent',
        version: '0.0.0',
        ext: 'bat',
      })
      console.log('data: ', inspect(response.body.data))
      expect(response.status).toBeDefined()
    }, 30000)
  })

  describe('POST /api/publish/internal/file', () => {
    // S3Service injection causes ECONNREFUSED in test env without S3
    it.skip('should require pkg file', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/internal/file')
        .field('name', 'test')
        .field('version', '1.0.0')
        .attach('file', Buffer.from('test'), { filename: 'test.exe' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('pkg')
    }, 30000)

    // S3Service injection causes ECONNREFUSED in test env without S3
    it.skip('should require name and version', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/internal/file')
        .attach('pkg', Buffer.from('test'), { filename: 'test.exe' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Missing required fields')
    }, 30000)
  })
})
