import type { Application, Framework } from '@midwayjs/koa'
import { close, createApp } from '@midwayjs/mock'
import { RoleService } from '../../src/service/role.service'

describe('RoleService', () => {
  let app: Application
  let roleService: RoleService

  beforeAll(async () => {
    app = await createApp<Framework>()
    roleService = await app.getApplicationContext().getAsync(RoleService)
  })

  afterAll(async () => {
    await close(app)
  })

  describe('findRoleByName', () => {
    it('should find super role', async () => {
      const role = await roleService.findRoleByName('super')

      expect(role).not.toBeNull()
      expect(role!.name).toBe('super')
      expect(role!.description).toBe('超级管理员，拥有所有权限')
    })

    it('should find guest role', async () => {
      const role = await roleService.findRoleByName('guest')

      expect(role).not.toBeNull()
      expect(role!.name).toBe('guest')
      expect(role!.description).toBe('访客用户，只有有限权限')
    })

    it('should return null for non-existent role', async () => {
      const role = await roleService.findRoleByName('nonexistent')

      expect(role).toBeNull()
    })
  })

  describe('findRoleById', () => {
    it('should find role by id', async () => {
      const superRole = await roleService.findRoleByName('super')
      expect(superRole).not.toBeNull()

      const role = await roleService.findRoleById(superRole!.id)

      expect(role).not.toBeNull()
      expect(role!.name).toBe('super')
    })

    it('should return null for non-existent id', async () => {
      const role = await roleService.findRoleById(99999)

      expect(role).toBeNull()
    })
  })

  describe('initDefaultRolesAndUsers', () => {
    it('should not throw error when called multiple times', async () => {
      await expect(roleService.initDefaultRolesAndUsers()).resolves.not.toThrow()
      await expect(roleService.initDefaultRolesAndUsers()).resolves.not.toThrow()
    })
  })
})
