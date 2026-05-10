export class SoftwareVersionDTO {
  versionId: number
  sequence: string
  size: number
  force: boolean
  changelog: string
  createdAt: Date
}

export class SoftwareDetailDTO {
  id: number
  name: string
  displayName: string
  description: string
  ext: string
  versions: SoftwareVersionDTO[]
}

export class SoftwareListItemDTO {
  id: number
  name: string
  displayName: string
  identifier: string
  ext: string
  description: string
  versions: SoftwareVersionDTO[]
}

export class LatestVersionDTO {
  name: string
  displayName: string
  sequence: string
  url: string
  fileUrl: string
  ext: string
  size: number
  createdAt: Date
}

export class ResDTO<T = any> {
  success: boolean
  data?: T
  message?: string
  total?: number

  static ok<T>(data?: T): ResDTO<T> {
    const response: ResDTO<T> = {
      success: true,
    }
    if (arguments.length > 0) {
      response.data = data
    }
    if (Array.isArray(data)) {
      response.total = data.length
    }
    return response
  }

  static fail<T = any>(message: string): ResDTO<T> {
    return {
      success: false,
      message,
    }
  }
}
