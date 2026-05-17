import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast/ToastProvider'

export interface Project {
  id: number
  path: string
  name: string | null
  last_opened_at: string
  pinned: number
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const { error } = useToast()

  const refresh = useCallback(async () => {
    try {
      const list = await invoke<Project[]>('list_projects')
      setProjects(list)
    } catch (e) {
      error(String(e))
    }
  }, [error])

  const add = useCallback(async (path: string, name?: string) => {
    try {
      await invoke('add_project', { path, name })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const open = useCallback(async (path: string) => {
    try {
      await invoke('open_project', { path })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const remove = useCallback(async (id: number) => {
    try {
      await invoke('remove_project', { id })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  const pin = useCallback(async (id: number, pinned: boolean) => {
    try {
      await invoke('pin_project', { id, pinned })
      await refresh()
    } catch (e) {
      error(String(e))
      throw e
    }
  }, [refresh, error])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { projects, refresh, add, open, remove, pin }
}
