import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'

export interface SkillInfo {
  name: string
  description: string
  enabled: boolean
  source: string
}

interface GithubInstallResult {
  temp_dir: string
  skills: SkillInfo[]
}

export function useSkills() {
  const { currentProject } = useAppStore()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!currentProject) return
    setLoading(true)
    try {
      const list = await invoke<SkillInfo[]>('list_skills', { projectPath: currentProject })
      setSkills(list)
    } finally {
      setLoading(false)
    }
  }, [currentProject])

  const toggle = useCallback(
    async (name: string, enabled: boolean) => {
      if (!currentProject) return
      await invoke('toggle_skill', { projectPath: currentProject, name, enabled })
      await refresh()
    },
    [currentProject, refresh],
  )

  const importSkill = useCallback(
    async (sourcePath: string) => {
      if (!currentProject) return
      await invoke('import_skill', { projectPath: currentProject, sourcePath })
      await refresh()
    },
    [currentProject, refresh],
  )

  const installFromGithub = useCallback(
    async (repoUrl: string): Promise<GithubInstallResult> => {
      if (!currentProject) return { temp_dir: '', skills: [] }
      return invoke<GithubInstallResult>('install_skill_from_github', {
        projectPath: currentProject,
        repoUrl,
      })
    },
    [currentProject],
  )

  const confirmInstall = useCallback(
    async (tempDir: string, skillNames: string[]) => {
      if (!currentProject) return
      await invoke('confirm_install_skill', {
        projectPath: currentProject,
        tempDir,
        skillNames,
      })
      await refresh()
    },
    [currentProject, refresh],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { skills, loading, refresh, toggle, importSkill, installFromGithub, confirmInstall }
}
