import type { Repository } from 'typeorm'
import type { ILogger } from '@midwayjs/core'
import { Config, Logger, Singleton } from '@midwayjs/core'
import { InjectEntityModel } from '@midwayjs/typeorm'
import { Role } from '../entity/role.entity'
import { User } from '../entity/user.entity'
import * as bcrypt from 'bcryptjs'

@Singleton()
export class RoleService {
  @InjectEntityModel(Role)
  roleModel: Repository<Role>

  @InjectEntityModel(User)
  userModel: Repository<User>

  @Logger()
  logger: ILogger

  @Config('admin.defaultPassword')
  adminDefaultPassword: string

  async findRoleByName(name: string): Promise<Role | null> {
    return this.roleModel.findOne({ where: { name } })
  }

  async findRoleById(id: number): Promise<Role | null> {
    return this.roleModel.findOne({ where: { id } })
  }

  async initDefaultRolesAndUsers(): Promise<void> {
    await this.initSuperRole()
    await this.initGuestRole()
    await this.initAdminUser()
    await this.initGuestUser()
  }

  private async initSuperRole(): Promise<void> {
    const existing = await this.roleModel.findOne({ where: { name: 'super' } })
    if (existing) {
      this.logger.info('Super role already exists')
      return
    }

    const role = this.roleModel.create({
      name: 'super',
      description: '超级管理员，拥有所有权限',
    })
    await this.roleModel.save(role)
    this.logger.info('Super role created')
  }

  private async initGuestRole(): Promise<void> {
    const existing = await this.roleModel.findOne({ where: { name: 'guest' } })
    if (existing) {
      this.logger.info('Guest role already exists')
      return
    }

    const role = this.roleModel.create({
      name: 'guest',
      description: '访客用户，只有有限权限',
    })
    await this.roleModel.save(role)
    this.logger.info('Guest role created')
  }

  private async initAdminUser(): Promise<void> {
    const superRole = await this.findRoleByName('super')
    if (!superRole) {
      this.logger.warn('Super role not found, cannot create/update admin user')
      return
    }

    const existingUser = await this.userModel.findOne({ where: { username: 'admin' } })
    if (existingUser) {
      if (existingUser.roleId !== superRole.id) {
        existingUser.roleId = superRole.id
        await this.userModel.save(existingUser)
        this.logger.info('Admin user linked to super role')
      } else {
        this.logger.info('Admin user already exists with super role')
      }
      return
    }

    const password = this.adminDefaultPassword || 'admin123'
    const passwordHash = await bcrypt.hash(password, 10)
    const user = this.userModel.create({
      username: 'admin',
      passwordHash,
      roleId: superRole.id,
    })
    await this.userModel.save(user)
    this.logger.info('Admin user created with super role')
  }

  private async initGuestUser(): Promise<void> {
    const guestRole = await this.findRoleByName('guest')
    if (!guestRole) {
      this.logger.warn('Guest role not found, cannot create/update guest user')
      return
    }

    const existingUser = await this.userModel.findOne({ where: { username: 'guest' } })
    if (existingUser) {
      if (existingUser.roleId !== guestRole.id) {
        existingUser.roleId = guestRole.id
        await this.userModel.save(existingUser)
        this.logger.info('Guest user linked to guest role')
      } else {
        this.logger.info('Guest user already exists with guest role')
      }
      return
    }

    const passwordHash = await bcrypt.hash('', 10)
    const user = this.userModel.create({
      username: 'guest',
      passwordHash,
      roleId: guestRole.id,
    })
    await this.userModel.save(user)
    this.logger.info('Guest user created with guest role')
  }
}
