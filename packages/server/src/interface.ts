import type { Readable } from 'node:stream'

/**
 * @description User-Service parameters
 */
export interface IUserOptions {
  uid: number
}

export interface IRustfsConfig {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  useSSL: boolean
  signExpire: number
}

export interface IStreamable {
  stream: Readable
  filename: string
}

export interface ISvnConfig {
  username: string
  password: string
}

export interface IPublishConfig {
  token: string
}

/** 所有发布接口的公共 body 字段 */
export interface PublishBaseDTO {
  name: string
  version: string
  display?: string
  identifier?: string
  description?: string
  changelog?: string
  force?: boolean
}
