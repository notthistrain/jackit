import { open } from '@tauri-apps/plugin-dialog'
import { useCallback } from 'react'
import { useProjects } from '@/shared/hooks/useProjects'
import { useAppStore } from '@/stores/useAppStore'

/** 弹目录选择 → add + open + setProject。Layout / ProjectSwitcher / 四页守卫共用。 */
export function useSelectProject() {
  const { add, open: openProject } = useProjects()
  const { setProject } = useAppStore()
  return useCallback(async () => {
    const selected = await open({ directory: true })
    if (typeof selected === 'string') {
      await add(selected)
      await openProject(selected)
      setProject(selected)
    }
  }, [add, openProject, setProject])
}
