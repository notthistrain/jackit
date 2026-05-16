import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface Project {
  id: number
  path: string
  name: string | null
  last_opened_at: string
  pinned: number
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])

  const refresh = useCallback(async () => {
    const list = await invoke<Project[]>('list_projects')
    setProjects(list)
  }, [])

  const add = useCallback(async (path: string, name?: string) => {
    await invoke('add_project', { path, name })
    await refresh()
  }, [refresh])

  const open = useCallback(async (path: string) => {
    await invoke('open_project', { path })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await invoke('remove_project', { id })
    await refresh()
  }, [refresh])

  const pin = useCallback(async (id: number, pinned: boolean) => {
    await invoke('pin_project', { id, pinned })
    await refresh()
  }, [refresh])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { projects, refresh, add, open, remove, pin }
}
