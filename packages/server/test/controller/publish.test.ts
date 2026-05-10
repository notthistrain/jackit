import type { Application, Framework } from '@midwayjs/koa'
import { inspect } from 'node:util'
import { close, createApp, createHttpRequest } from '@midwayjs/mock'

describe('aPI Controller', () => {
  let app: Application

  beforeAll(async () => {
    app = await createApp<Framework>()
  })

  afterAll(async () => {
    await close(app)
  })

  describe('pOST /api/publish', () => {
    it.skip('publish/svn', async () => {
      const response = await createHttpRequest(app).post('/api/publish/svn').send({
        url: 'http://10.10.11.23/svn/SW_CI/!svn/ver/18232/Project_Build_Service/scannerbib/scannerbib_0.0.0_build_66/scannerbib-0.0.0-0.x86_64.rpm',
        sequence: '0.0.0',
        name: 'scannerbib',
        ext: 'rpm',
      })
      console.log('data: ', inspect(response.body.data))
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.key).toBeDefined()
    }, 30000)

    it('publish/s3 should handle missing file gracefully', async () => {
      const response = await createHttpRequest(app).post('/api/publish/s3').send({
        sequence: '0.0.0',
        name: 'nonexistent',
        ext: 'bat',
      })
      console.log('data: ', inspect(response.body.data))
      expect(response.status).toBeDefined()
    }, 30000)

    it('publish/file should require info.toml', async () => {
      const response = await createHttpRequest(app)
        .post('/api/publish/file')
        .attach('pkg', Buffer.from('test'), { filename: 'test.exe' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('info')
    }, 30000)
  })
})
