import type { ILogger } from '@midwayjs/core'
import type { ISvnConfig } from '../interface'
import * as http from 'node:http'
import * as https from 'node:https'
import { PassThrough } from 'node:stream'
import { Config, Logger, Singleton } from '@midwayjs/core'

@Singleton()
export class SvnService {
  @Config('svn')
  svnConfig: ISvnConfig

  @Logger()
  logger: ILogger

  async downloadFile(fileUrl: string) {
    const client = fileUrl.startsWith('https') ? https : http

    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const request = client.request(
        fileUrl,
        {
          timeout: 30000,
          headers: {
            Authorization: this.getAuthHeader(),
          },
        },
        response => resolve(response),
      )

      request.on('timeout', () => {
        this.logger.error('下载请求超时：%s', fileUrl)
        request.destroy(new Error('Request timeout'))
      })

      request.on('error', (err) => {
        this.logger.error('下载请求出错：%s', err.message)
        reject(err)
      })

      request.end()
    })

    const contentLength = Number.parseInt(response.headers['content-length'] ?? '0', 10) || 0

    const uploadStream = new PassThrough()
    response.pipe(uploadStream)

    return {
      stream: uploadStream,
      contentLength,
    }
  }

  getAuthHeader(): string {
    const credentials = Buffer.from(`${this.svnConfig.username}:${this.svnConfig.password}`).toString('base64')
    return `Basic ${credentials}`
  }
}
