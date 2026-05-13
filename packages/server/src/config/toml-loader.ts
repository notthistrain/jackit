import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as Toml from '@iarna/toml'

export interface TomlConfig {
  server?: { port?: number }
  database?: { path?: string }
  rustfs?: {
    endpoint?: string
    access_key_id?: string
    secret_access_key?: string
    bucket?: string
    sign_expire?: number
  }
  svn?: { username?: string; password?: string }
  jwt?: { secret?: string }
  admin?: { default_password?: string }
  cookie?: { secure?: boolean }
  publish?: { token?: string }
}

const CONFIG_FILENAME = 'config.toml'

function resolveConfigPath(): string {
  // 优先从项目根目录（cwd）查找
  const cwdPath = join(process.cwd(), CONFIG_FILENAME)
  if (existsSync(cwdPath)) return cwdPath

  // 回退到 src/config 上两级（项目根目录）
  const srcPath = join(__dirname, '../../', CONFIG_FILENAME)
  if (existsSync(srcPath)) return srcPath

  return ''
}

export function loadTomlConfig(): TomlConfig {
  const configPath = resolveConfigPath()
  if (!configPath) return {}

  try {
    const content = readFileSync(configPath, 'utf-8')
    return Toml.parse(content) as unknown as TomlConfig
  } catch (e) {
    console.warn(`[config] Failed to parse ${configPath}: ${(e as Error).message}`)
    return {}
  }
}
