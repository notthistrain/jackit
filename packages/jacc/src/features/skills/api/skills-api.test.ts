import { invoke } from '@tauri-apps/api/core'
import { describe, expect, it, vi } from 'vitest'
import { skillsApi } from './skills-api'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('skillsApi', () => {
  it('list calls list_skills with projectPath', () => {
    skillsApi.list('/path')
    expect(invoke).toHaveBeenCalledWith('list_skills', { projectPath: '/path' })
  })

  it('toggle calls toggle_skill with args', () => {
    skillsApi.toggle('/path', 'foo', true)
    expect(invoke).toHaveBeenCalledWith('toggle_skill', { projectPath: '/path', name: 'foo', enabled: true })
  })

  it('import calls import_skill with sourcePath', () => {
    skillsApi.import('/path', '/source')
    expect(invoke).toHaveBeenCalledWith('import_skill', { projectPath: '/path', sourcePath: '/source' })
  })

  it('installFromGithub calls install_skill_from_github', () => {
    skillsApi.installFromGithub('/path', 'https://repo')
    expect(invoke).toHaveBeenCalledWith('install_skill_from_github', { projectPath: '/path', repoUrl: 'https://repo' })
  })

  it('confirmInstall calls confirm_install_skill with token and skillNames', () => {
    skillsApi.confirmInstall('/path', 'tok', ['a', 'b'])
    expect(invoke).toHaveBeenCalledWith('confirm_install_skill', { projectPath: '/path', token: 'tok', skillNames: ['a', 'b'] })
  })
})
