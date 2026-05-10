import type { ILogger } from '@midwayjs/core'
import type { ISvnConfig } from '../interface'
import * as http from 'node:http'
import { PassThrough } from 'node:stream'
import { Config, Logger, Singleton } from '@midwayjs/core'

@Singleton()
export class SvnService {
  @Config('svn')
  svnConfig: ISvnConfig

  @Logger()
  logger: ILogger

  async downloadFile(fileUrl: string) {
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const request = http.request(
        fileUrl,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        },
        response => resolve(response),
      )

      request.on('error', (err) => {
        this.logger.error('下载请求出错：%s', err.message)
        reject(err)
      })

      request.end()
    })

    const contentLength = Number.parseInt(response.headers['content-length'], 10) || 0

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
