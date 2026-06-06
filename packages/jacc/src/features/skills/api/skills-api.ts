import { invoke } from '@tauri-apps/api/core'

export interface SkillInfo {
  name: string
  description: string
  enabled: boolean
  source: string
}

export interface GithubInstallResult {
  token: string
  skills: SkillInfo[]
  temp_dir?: string
}

export const skillsApi = {
  list: (projectPath: string) =>
    invoke<SkillInfo[]>('list_skills', { projectPath }),

  toggle: (projectPath: string, name: string, enabled: boolean) =>
    invoke<void>('toggle_skill', { projectPath, name, enabled }),

  import: (projectPath: string, sourcePath: string) =>
    invoke<void>('import_skill', { projectPath, sourcePath }),

  installFromGithub: (projectPath: string, repoUrl: string) =>
    invoke<GithubInstallResult>('install_skill_from_github', { projectPath, repoUrl }),

  confirmInstall: (projectPath: string, token: string, skillNames: string[]) =>
    invoke<void>('confirm_install_skill', { projectPath, token, skillNames }),
}
