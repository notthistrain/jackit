export interface Tool {
  id: number
  name: string
  identifier: string
  display_name: string
  version: string
  icon: string
  description: string
  ext: string
  file_path: string
  installed_at: string
  remote_updated_at: string
  local_updated_at: string
  versions: ToolVersion[]
}

export interface ToolVersion {
  id: number
  tool_id: number
  version_id: number
  sequence: string
  size: number
  force: boolean
  changelog: string
  downloaded: boolean
  deleted: boolean
  created_at: string
}

export interface InstallProgress {
  toolId: number
  toolName: string
  status: string
  progress: number
  message: string
}

export interface UpdateInfo {
  version: string
  version_id: number
  size: number
  release_note: string
}

export interface UpdateProgress {
  status: string
  progress: number
  message: string
  version?: string
}

export interface SyncResult {
  success: boolean
  count: number
  message: string
  timestamp: string
}
