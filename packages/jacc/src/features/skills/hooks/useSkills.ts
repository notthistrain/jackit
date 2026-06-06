import type { GithubInstallResult, SkillInfo } from '../api/skills-api'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/providers/ToastProvider'
import { useAppStore } from '@/stores/useAppStore'
import { skillsApi } from '../api/skills-api'

export type { GithubInstallResult, SkillInfo }

export function useSkills() {
  const { currentProject } = useAppStore()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  const refresh = useCallback(async () => {
    if (!currentProject)
      return
    setLoading(true)
    try {
      setSkills(await skillsApi.list(currentProject))
    }
    catch (e) {
      error(String(e))
    }
    finally {
      setLoading(false)
    }
  }, [currentProject, error])

  const toggle = useCallback(async (name: string, enabled: boolean) => {
    if (!currentProject)
      return
    // 乐观更新
    setSkills(prev => prev.map(s => (s.name === name ? { ...s, enabled } : s)))
    try {
      await skillsApi.toggle(currentProject, name, enabled)
    }
    catch (e) {
      // 失败回滚
      setSkills(prev => prev.map(s => (s.name === name ? { ...s, enabled: !enabled } : s)))
      error(String(e))
    }
  }, [currentProject, error])

  const importSkill = useCallback(async (sourcePath: string) => {
    if (!currentProject)
      return
    try {
      await skillsApi.import(currentProject, sourcePath)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [currentProject, refresh, error])

  const installFromGithub = useCallback(async (repoUrl: string): Promise<GithubInstallResult> => {
    if (!currentProject)
      return { token: '', temp_dir: '', skills: [] }
    try {
      return await skillsApi.installFromGithub(currentProject, repoUrl)
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [currentProject, error])

  const confirmInstall = useCallback(async (token: string, skillNames: string[]) => {
    if (!currentProject)
      return
    try {
      await skillsApi.confirmInstall(currentProject, token, skillNames)
      await refresh()
    }
    catch (e) {
      error(String(e))
      throw e
    }
  }, [currentProject, refresh, error])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { skills, loading, refresh, toggle, importSkill, installFromGithub, confirmInstall }
}
