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
