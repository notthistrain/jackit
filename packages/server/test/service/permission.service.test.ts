import type { Application, Framework } from '@midwayjs/koa'
import { close, createApp } from '@midwayjs/mock'
import { PermissionService, PermissionRule } from '../../src/service/permission.service'

describe('PermissionService', () => {
  let app: Application
  let permissionService: PermissionService

  beforeAll(async () => {
    app = await createApp<Framework>()
    permissionService = await app.getApplicationContext().getAsync(PermissionService)
  })

  afterAll(async () => {
    await close(app)
  })

  describe('getPermissions', () => {
    it('should get super permissions', () => {
      const permissions = permissionService.getPermissions('super')

      expect(permissions).toBeDefined()
      expect(permissions!.length).toBe(1)
      expect(permissions![0].path).toBe('*')
      expect(permissions![0].method).toBe('*')
    })

    it('should get guest permissions', () => {
      const permissions = permissionService.getPermissions('guest')

      expect(permissions).toBeDefined()
      expect(permissions!.length).toBeGreaterThan(0)
    })

    it('should return undefined for non-existent role', () => {
      const permissions = permissionService.getPermissions('nonexistent')

      expect(permissions).toBeUndefined()
    })
  })

  describe('matchPermission', () => {
    describe('super role', () => {
      const superPermissions = [{ path: '*', method: '*' }]

      it('should match any path with *', () => {
        expect(permissionService.matchPermission('/api/admin/software', 'GET', superPermissions)).toBe(true)
        expect(permissionService.matchPermission('/api/admin/software', 'POST', superPermissions)).toBe(true)
        expect(permissionService.matchPermission('/any/path', 'DELETE', superPermissions)).toBe(true)
      })
    })

    describe('guest role', () => {
      const guestPermissions: PermissionRule[] = [
        { path: '/login', method: 'GET' },
        { path: '/manual', method: 'GET' },
        { path: '/manual/*', method: 'GET' },
        { path: '/api/auth/login', method: 'POST' },
        { path: '/api/admin/software/*', method: 'GET' },
      ]

      it('should allow GET /login', () => {
        expect(permissionService.matchPermission('/login', 'GET', guestPermissions)).toBe(true)
      })

      it('should allow GET /manual', () => {
        expect(permissionService.matchPermission('/manual', 'GET', guestPermissions)).toBe(true)
      })

      it('should allow GET /manual/*', () => {
        expect(permissionService.matchPermission('/manual/index.html', 'GET', guestPermissions)).toBe(true)
        expect(permissionService.matchPermission('/manual/assets/app.js', 'GET', guestPermissions)).toBe(true)
      })

      it('should allow POST /api/auth/login', () => {
        expect(permissionService.matchPermission('/api/auth/login', 'POST', guestPermissions)).toBe(true)
      })

      it('should deny GET /api/admin/software (list)', () => {
        expect(permissionService.matchPermission('/api/admin/software', 'GET', guestPermissions)).toBe(false)
      })

      it('should allow GET /api/admin/software/*', () => {
        expect(permissionService.matchPermission('/api/admin/software/1', 'GET', guestPermissions)).toBe(true)
        expect(permissionService.matchPermission('/api/admin/software/abc', 'GET', guestPermissions)).toBe(true)
      })

      it('should deny POST /api/admin/software', () => {
        expect(permissionService.matchPermission('/api/admin/software', 'POST', guestPermissions)).toBe(false)
      })

      it('should deny DELETE /api/admin/software/1', () => {
        expect(permissionService.matchPermission('/api/admin/software/1', 'DELETE', guestPermissions)).toBe(false)
      })

      it('should deny other paths', () => {
        expect(permissionService.matchPermission('/api/admin/users', 'GET', guestPermissions)).toBe(false)
        expect(permissionService.matchPermission('/api/admin/settings', 'GET', guestPermissions)).toBe(false)
      })
    })
  })

  describe('matchPath', () => {
    const testMatchPath = (requestPath: string, rulePath: string): boolean => {
      const rules: PermissionRule[] = [{ path: rulePath, method: '*' }]
      return permissionService.matchPermission(requestPath, 'GET', rules)
    }

    it('should match exact path', () => {
      expect(testMatchPath('/api/auth/login', '/api/auth/login')).toBe(true)
    })

    it('should not match different path', () => {
      expect(testMatchPath('/api/auth/login', '/api/auth/logout')).toBe(false)
    })

    it('should match wildcard *', () => {
      expect(testMatchPath('/any/path', '*')).toBe(true)
    })

    it('should match path with /* suffix', () => {
      expect(testMatchPath('/manual', '/manual/*')).toBe(false)
      expect(testMatchPath('/manual/', '/manual/*')).toBe(true)
      expect(testMatchPath('/manual/index.html', '/manual/*')).toBe(true)
      expect(testMatchPath('/manual/assets/app.js', '/manual/*')).toBe(true)
      expect(testMatchPath('/manualother', '/manual/*')).toBe(false)
    })

    it('should ignore query string', () => {
      expect(testMatchPath('/api/admin/software?page=1', '/api/admin/software')).toBe(true)
      expect(testMatchPath('/manual?test=1', '/manual')).toBe(true)
    })
  })

  describe('matchMethod', () => {
    const testMatchMethod = (requestMethod: string, ruleMethod: string): boolean => {
      const rules: PermissionRule[] = [{ path: '*', method: ruleMethod }]
      return permissionService.matchPermission('/any', requestMethod, rules)
    }

    it('should match exact method', () => {
      expect(testMatchMethod('GET', 'GET')).toBe(true)
      expect(testMatchMethod('POST', 'POST')).toBe(true)
    })

    it('should match wildcard *', () => {
      expect(testMatchMethod('GET', '*')).toBe(true)
      expect(testMatchMethod('POST', '*')).toBe(true)
      expect(testMatchMethod('DELETE', '*')).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(testMatchMethod('get', 'GET')).toBe(true)
      expect(testMatchMethod('GET', 'get')).toBe(true)
    })

    it('should not match different method', () => {
      expect(testMatchMethod('GET', 'POST')).toBe(false)
      expect(testMatchMethod('POST', 'GET')).toBe(false)
    })
  })
})
