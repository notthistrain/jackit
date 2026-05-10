import type { MidwayConfig } from '@midwayjs/core'
import type { IMidwayKoaConfigurationOptions } from '@midwayjs/koa'
import type { DataSourceOptions } from 'typeorm'

export default {
  keys: 'svnlink_1772413730146',
  koa: {
    port: 7001,
    globalPrefix: '/api',
  } as IMidwayKoaConfigurationOptions,
  staticFile: {
    dirs: {
      default: {
        prefix: '/',
        dir: 'admin',
      },
    },
  },
  busboy: {
    mode: 'file',
    whitelist: null,
    limits: {
      files: 5
    }
  },
  midwayLogger: {
    default: {
      level: 'info',
      transports: {
        console: {
          level: 'info',
        },
        file: {
          level: 'info',
          dir: './logs',
        },
        error: {
          level: 'error',
          dir: './logs',
        },
      },
    },
    clients: {
      coreLogger: {
        level: 'info',
        transports: {
          console: {
            level: 'info',
          },
          file: {
            level: 'info',
            dir: './logs',
          },
        },
      },
      appLogger: {
        level: 'info',
        transports: {
          console: {
            level: 'info',
          },
          file: {
            level: 'info',
            dir: './logs',
          },
        },
      },
    },
  },
  typeorm: {
    dataSource: {
      default: {
        type: 'better-sqlite3',
        database: process.env.DB_PATH || './data/svnlink.db',
        entities: ['**/entity/*.entity.*'],
        synchronize: true,
        logging: false,
      } as DataSourceOptions,
    },
  },
  rustfs: {
    endpoint: process.env.RUSTFS_ENDPOINT || 'http://127.0.0.1:9090',
    accessKeyId: process.env.RUSTFS_ACCESS_KEY_ID || 'rustfsadmin',
    secretAccessKey: process.env.RUSTFS_SECRET_ACCESS_KEY || 'rustfsadmin',
    bucket: process.env.RUSTFS_BUCKET || 'svnlink',
    useSSL: false,
    signExpire: process.env.SIGN_EXPIRE || 30000,
  },
  upgradelink: {
    endpoint: process.env.UPGRADELINK_ENDPOINT || 'http://upgradelink-api:8080',
  },
  svn: {
    username: process.env.SVN_USERNAME || 'guojiuhai',
    password: process.env.SVN_PASSWORD || 'Password582',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'svnlink_jwt_secret_key_2026',
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true' || false,
  },
  permission: {
    super: [
      { path: '*', method: '*' },
    ],
    guest: [
      { path: '/login', method: 'GET' },
      { path: '/manual', method: 'GET' },
      { path: '/manual/*', method: 'GET' },
      { path: '/api/auth/login', method: 'POST' },
      { path: '/api/auth/refresh', method: 'POST' },
      { path: '/api/auth/logout', method: 'POST' },
      { path: '/api/admin/software/*', method: 'GET' },
    ],
  },
} as MidwayConfig
