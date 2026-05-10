import { Rule, RuleType } from '@midwayjs/validate'

export class GetSoftwareListDTO {
  @Rule(RuleType.number().integer().min(1).default(1))
  page: number

  @Rule(RuleType.number().integer().min(1).max(100).default(10))
  pageSize: number

  @Rule(RuleType.string().empty('').default(''))
  keyword: string
}

export class CreateSoftwareDTO {
  @Rule(RuleType.string().required())
  name: string

  @Rule(RuleType.string().required())
  displayName: string

  @Rule(RuleType.string().required())
  identifier: string

  @Rule(RuleType.string().required())
  ext: string

  @Rule(RuleType.string().allow(null).optional())
  description: string
}

export class UpdateSoftwareDTO {
  @Rule(RuleType.string().allow(null).optional())
  description: string

  @Rule(RuleType.string().allow(null).optional())
  manual: string

  @Rule(RuleType.string().allow(null).optional())
  displayName: string
}

export class CreateVersionDTO {
  @Rule(RuleType.string().required())
  sequence: string

  @Rule(RuleType.string().required())
  key: string

  @Rule(RuleType.number().required())
  size: number

  @Rule(RuleType.boolean().optional())
  force: boolean

  @Rule(RuleType.string().required())
  changelog: string
}

export class UpdateVersionDTO {
  @Rule(RuleType.string().optional())
  sequence: string

  @Rule(RuleType.string().required())
  key: string

  @Rule(RuleType.number().allow(null).optional())
  size: number

  @Rule(RuleType.boolean().optional())
  force: boolean

  @Rule(RuleType.string().allow(null).optional())
  changelog: string
}

export class GetLogsDTO {
  @Rule(RuleType.number().integer().min(1).default(1))
  page: number

  @Rule(RuleType.number().integer().min(1).max(100).default(10))
  pageSize: number

  @Rule(RuleType.string().empty('').default(''))
  keyword: string

  @Rule(RuleType.string().empty('').optional())
  action: string
}

export class UpdateSettingDTO {
  @Rule(RuleType.string().required())
  key: string

  @Rule(RuleType.string().required())
  value: string
}
