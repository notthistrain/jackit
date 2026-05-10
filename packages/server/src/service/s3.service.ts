import type { Readable } from 'node:stream'
import type { IRustfsConfig } from '../interface'
import type { ILogger } from '@midwayjs/core'
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Config, Init, Logger, Singleton } from '@midwayjs/core'

@Singleton()
export class S3Service {
  @Config('rustfs')
  rustfsConfig: IRustfsConfig

  @Logger()
  logger: ILogger

  private s3Client: S3Client

  @Init()
  async init() {
    this.logger.info('初始化 S3 客户端, endpoint: %s', this.rustfsConfig.endpoint)
    this.s3Client = new S3Client({
      region: 'us-east-1',
      endpoint: this.rustfsConfig.endpoint,
      credentials: {
        accessKeyId: this.rustfsConfig.accessKeyId,
        secretAccessKey: this.rustfsConfig.secretAccessKey,
      },
      forcePathStyle: true,
      tls: this.rustfsConfig.useSSL,
    })

    await this.ensureBucket()
  }

  async ensureBucket() {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.rustfsConfig.bucket,
        }),
      )
      this.logger.info('Bucket 已存在: %s', this.rustfsConfig.bucket)
    }
    catch (error) {
      this.logger.info('创建 Bucket: %s', this.rustfsConfig.bucket)
      await this.s3Client.send(
        new CreateBucketCommand({
          Bucket: this.rustfsConfig.bucket,
        }),
      )
      this.logger.info('Bucket 创建成功: %s', this.rustfsConfig.bucket)
    }
  }

  async uploadFile(key: string, body: Buffer | Uint8Array | Readable, contentType?: string, contentLength?: number) {
    this.logger.info('上传文件到 S3: %s, size: %d', key, contentLength)
    const result = await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.rustfsConfig.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
    )
    this.logger.info('上传文件成功: %s', key)
    return result
  }

  async getSignedUrl(key: string, expiresIn: number = this.rustfsConfig.signExpire, filename?: string) {
    this.logger.info('生成签名 URL: %s, expiresIn: %d', key, expiresIn)
    const command = new GetObjectCommand({
      Bucket: this.rustfsConfig.bucket,
      Key: key,
      ResponseContentDisposition: filename
        ? `attachment; filename="${filename}"`
        : undefined,
    })
    return getSignedUrl(this.s3Client, command, { expiresIn })
  }

  async getFileSize(key: string) {
    this.logger.info('获取文件大小: %s', key)
    const response = await this.s3Client.send(
      new HeadObjectCommand({
        Bucket: this.rustfsConfig.bucket,
        Key: key,
      }),
    )
    const size = response.ContentLength || 0
    this.logger.info('文件大小: %s = %d bytes', key, size)
    return size
  }
}
