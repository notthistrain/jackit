import { invoke } from '@tauri-apps/api/core'
import { useCallback } from 'react'

export function usePreferences() {
  const get = useCallback(async (key: string): Promise<string | null> => {
    return invoke<string | null>('get_preference', { key })
  }, [])

  const set = useCallback(async (key: string, value: string): Promise<void> => {
    return invoke('set_preference', { key, value })
  }, [])

  return { get, set }
}
