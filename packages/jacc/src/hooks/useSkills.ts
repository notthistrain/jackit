import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useToast } from '@/components/toast/ToastProvider'

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
  const { error } = useToast()

  const refresh = useCallback(async () => {
    if (!currentProject) return
    setLoading(true)
    try {
      const list = await invoke<SkillInfo[]>('list_skills', { projectPath: currentProject })
      setSkills(list)
    } catch (e) {
      error(String(e))
    } finally {
      setLoading(false)
    }
  }, [currentProject, error])

  const toggle = useCallback(
    async (name: string, enabled: boolean) => {
      if (!currentProject) return

      // 乐观更新：立即修改本地状态
      setSkills((prev) =>
        prev.map((s) => (s.name === name ? { ...s, enabled } : s)),
      )

      try {
        await invoke('toggle_skill', { projectPath: currentProject, name, enabled })
      } catch (e) {
        // 失败回滚
        setSkills((prev) =>
          prev.map((s) => (s.name === name ? { ...s, enabled: !enabled } : s)),
        )
        error(String(e))
      }
    },
    [currentProject, error],
  )

  const importSkill = useCallback(
    async (sourcePath: string) => {
      if (!currentProject) return
      try {
        await invoke('import_skill', { projectPath: currentProject, sourcePath })
        await refresh()
      } catch (e) {
        error(String(e))
        throw e
      }
    },
    [currentProject, refresh, error],
  )

  const installFromGithub = useCallback(
    async (repoUrl: string): Promise<GithubInstallResult> => {
      if (!currentProject) return { temp_dir: '', skills: [] }
      try {
        return await invoke<GithubInstallResult>('install_skill_from_github', {
          projectPath: currentProject,
          repoUrl,
        })
      } catch (e) {
        error(String(e))
        throw e
      }
    },
    [currentProject, error],
  )

  const confirmInstall = useCallback(
    async (tempDir: string, skillNames: string[]) => {
      if (!currentProject) return
      try {
        await invoke('confirm_install_skill', {
          projectPath: currentProject,
          tempDir,
          skillNames,
        })
        await refresh()
      } catch (e) {
        error(String(e))
        throw e
      }
    },
    [currentProject, refresh, error],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { skills, loading, refresh, toggle, importSkill, installFromGithub, confirmInstall }
}
