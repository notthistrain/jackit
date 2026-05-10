export interface Software {
  id: number
  name: string
  displayName: string | null
  description: string | null
  identifier: string | null
  ext: string | null
  manual: string | null
  versions: SoftwareVersion[]
  createdAt: string
  updatedAt: string
}

export interface SoftwareVersion {
  id: number
  sequence: string
  key: string | null
  size: number | null
  force: boolean
  changelog: string | null
  softwareId: number
  createdAt: string
}

export interface OperationLog {
  id: number
  action: string
  target: string
  detail: string
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface CreateSoftwareDTO {
  name: string
  displayName?: string
  identifier?: string
  description?: string
}

export interface UpdateSoftwareDTO {
  displayName?: string
  description?: string
  identifier?: string
  manual?: string
}

export interface CreateVersionDTO {
  sequence: string
  key?: string
  size?: number
  force?: boolean
  changelog?: string
}

export interface UpdateVersionDTO {
  sequence?: string
  key?: string
  size?: number
  force?: boolean
  changelog?: string
}

export interface PublishFromSvnDTO {
  sequence: string
  name: string
  ext: string
  url: string
}

export interface PublishFromS3DTO {
  sequence: string
  name: string
  ext: string
}
