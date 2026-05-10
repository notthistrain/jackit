import type { MidwayConfig } from '@midwayjs/core'
import type { IMidwayKoaConfigurationOptions } from '@midwayjs/koa'
import type { DataSourceOptions } from 'typeorm'
import { loadTomlConfig } from './toml-loader'

const toml = loadTomlConfig()

export default {
  keys: 'upgrade-component_1772413730146',
  koa: {
    port: toml.server?.port || 7001,
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
      files: 5,
    },
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
        database: toml.database?.path || process.env.DB_PATH || './data/upgrade-component.db',
        entities: ['**/entity/*.entity.*'],
        synchronize: true,
        logging: false,
      } as DataSourceOptions,
    },
  },
  rustfs: {
    endpoint: toml.rustfs?.endpoint || process.env.RUSTFS_ENDPOINT || 'http://127.0.0.1:9090',
    accessKeyId: toml.rustfs?.access_key_id || process.env.RUSTFS_ACCESS_KEY_ID || '',
    secretAccessKey: toml.rustfs?.secret_access_key || process.env.RUSTFS_SECRET_ACCESS_KEY || '',
    bucket: toml.rustfs?.bucket || process.env.RUSTFS_BUCKET || 'upgrade-component',
    useSSL: false,
    signExpire: toml.rustfs?.sign_expire || Number(process.env.SIGN_EXPIRE) || 30000,
  },
  upgradelink: {
    endpoint: toml.upgradelink?.endpoint || process.env.UPGRADELINK_ENDPOINT || 'http://upgradelink-api:8080',
  },
  svn: {
    username: toml.svn?.username ?? process.env.SVN_USERNAME ?? '',
    password: toml.svn?.password ?? process.env.SVN_PASSWORD ?? '',
  },
  jwt: {
    secret: toml.jwt?.secret ?? process.env.JWT_SECRET ?? 'dev_jwt_secret_change_in_production',
  },
  admin: {
    defaultPassword: toml.admin?.default_password ?? process.env.ADMIN_DEFAULT_PASSWORD ?? '',
  },
  cookie: {
    secure: toml.cookie?.secure ?? (process.env.COOKIE_SECURE === 'true' || false),
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
