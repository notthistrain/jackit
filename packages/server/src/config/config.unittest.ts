import type { MidwayConfig } from '@midwayjs/core'
import type { DataSourceOptions } from 'typeorm'

export default {
  koa: {
    port: undefined,
  },
  logger: {
    consoleLevel: 'info',
    fileLogName: '',
  },
  validate: {
    errorStatus: 400,
  },
  typeorm: {
    dataSource: {
      default: {
        database: './data/test.db',
      } as DataSourceOptions,
    },
  },
  publish: {
    token: 'test-publish-token',
  },
} as MidwayConfig
