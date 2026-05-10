import type { MidwayConfig } from '@midwayjs/core'
import type { DataSourceOptions } from 'typeorm'

export default {
  koa: {
    port: null,
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
} as MidwayConfig
