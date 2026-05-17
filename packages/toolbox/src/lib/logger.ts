import { invoke } from '@tauri-apps/api/core'

export const logger = {
  debug: (module: string, message: string) => invoke('log_debug', { module, message }),
  info: (module: string, message: string) => invoke('log_info', { module, message }),
  warn: (module: string, message: string) => invoke('log_warn', { module, message }),
  error: (module: string, message: string) => invoke('log_error', { module, message }),
}
