import type { ILogger } from '@midwayjs/core'
import { Config, Logger, Singleton } from '@midwayjs/core'

export interface PermissionRule {
  path: string
  method: string
}

@Singleton()
export class PermissionService {
  @Config('permission')
  permissionConfig: Record<string, PermissionRule[]>

  @Logger()
  logger: ILogger

  matchPermission(path: string, method: string, rules: PermissionRule[]): boolean {
    for (const rule of rules) {
      if (this.matchPath(path, rule.path) && this.matchMethod(method, rule.method)) {
        return true
      }
    }
    return false
  }

  getPermissions(role: string): PermissionRule[] | undefined {
    return this.permissionConfig[role]
  }

  private matchPath(requestPath: string, rulePath: string): boolean {
    if (rulePath === '*') {
      return true
    }

    const queryIndex = requestPath.indexOf('?')
    const cleanPath = queryIndex === -1 ? requestPath : requestPath.substring(0, queryIndex)

    if (rulePath.endsWith('/*')) {
      const prefix = rulePath.slice(0, -2)
      return cleanPath.startsWith(prefix + '/')
    }

    return cleanPath === rulePath
  }

  private matchMethod(requestMethod: string, ruleMethod: string): boolean {
    if (ruleMethod === '*') {
      return true
    }
    return requestMethod.toUpperCase() === ruleMethod.toUpperCase()
  }
}
