import type {
  CreateSoftwareDTO,
  CreateVersionDTO,
  OperationLog,
  PaginatedResponse,
  PublishFromS3DTO,
  PublishFromSvnDTO,
  Software,
  SoftwareVersion,
  UpdateSoftwareDTO,
  UpdateVersionDTO,
} from '@/types'
import { toast } from 'vue-sonner'
import { useAuth } from './useAuth'

const API_BASE = '/api/admin'
const PUBLISH_BASE = '/publish'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { getAuthHeaders } = useAuth()
  const authHeaders = getAuthHeaders()

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('API Error:', response.status, errorText)

    if (response.status === 401) {
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    let errorMessage = `请求失败 (${response.status})`
    try {
      const errorData = JSON.parse(errorText)
      errorMessage = errorData.message || errorMessage
    }
    catch {
      // Use default error message
    }

    toast.error(errorMessage)
    throw new Error(errorMessage)
  }

  return response.json()
}

export function useApi() {
  return {
    software: {
      async getList(page = 1, pageSize = 10, keyword = '') {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          ...(keyword && { keyword }),
        })
        return request<PaginatedResponse<Software>>(`${API_BASE}/software?${params}`)
      },

      async getById(id: number) {
        return request<Software>(`${API_BASE}/software/${id}`)
      },

      async create(data: CreateSoftwareDTO) {
        return request<Software>(`${API_BASE}/software`, {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },

      async update(id: number, data: UpdateSoftwareDTO) {
        return request<Software>(`${API_BASE}/software/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      },

      async delete(id: number) {
        return request<Software>(`${API_BASE}/software/${id}`, {
          method: 'DELETE',
        })
      },

      async getVersions(id: number) {
        return request<SoftwareVersion[]>(`${API_BASE}/software/${id}/versions`)
      },

      async createVersion(softwareId: number, data: CreateVersionDTO) {
        return request<SoftwareVersion>(`${API_BASE}/software/${softwareId}/versions`, {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },
    },

    version: {
      async getById(id: number) {
        return request<SoftwareVersion>(`${API_BASE}/version/${id}`)
      },

      async update(id: number, data: UpdateVersionDTO) {
        return request<SoftwareVersion>(`${API_BASE}/version/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      },

      async delete(id: number) {
        return request<SoftwareVersion>(`${API_BASE}/version/${id}`, {
          method: 'DELETE',
        })
      },
    },

    logs: {
      async getList(page = 1, pageSize = 10, keyword = '', action = '') {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          ...(keyword && { keyword }),
          ...(action && { action }),
        })
        return request<PaginatedResponse<OperationLog>>(`${API_BASE}/logs?${params}`)
      },
    },

    publish: {
      async fromSvn(data: PublishFromSvnDTO) {
        return request(`${PUBLISH_BASE}/svn`, {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },

      async fromS3(data: PublishFromS3DTO) {
        return request(`${PUBLISH_BASE}/s3`, {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },
    },
  }
}
