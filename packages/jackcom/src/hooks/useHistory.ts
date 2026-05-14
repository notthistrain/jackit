import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useHistoryStore, type SessionRow } from '@/stores/history-store'

export function useHistory() {
  const store = useHistoryStore()

  const loadSessions = useCallback(async () => {
    try {
      store.setLoading(true)
      store.setError(null)
      const res = await invoke<{ sessions: SessionRow[] }>('list_recent_sessions', {
        request: { limit: 20 },
      })
      store.setSessions(res.sessions)
    } catch (e: any) {
      store.setError(String(e))
    } finally {
      store.setLoading(false)
    }
  }, [store])

  const loadFrames = useCallback(async (sessionId: number) => {
    try {
      store.setLoading(true)
      store.setError(null)
      const { directionFilter, protocolFilter, page, pageSize } = useHistoryStore.getState()
      const res = await invoke<{ frames: any[]; total: number }>('query_history', {
        request: {
          session_id: sessionId,
          direction: directionFilter === 'all' ? undefined : directionFilter,
          protocol: protocolFilter,
          limit: pageSize,
          offset: page * pageSize,
        },
      })
      store.setFrames(res.frames, res.total)
    } catch (e: any) {
      store.setError(String(e))
    } finally {
      store.setLoading(false)
    }
  }, [store])

  const exportCsv = useCallback(async (sessionId: number) => {
    try {
      const res = await invoke<{ file_path: string }>('export_data', {
        request: { session_id: sessionId, format: 'csv', file_path: `jackcom-session-${sessionId}.csv` },
      })
      return res.file_path
    } catch {
      return null
    }
  }, [])

  return { store, loadSessions, loadFrames, exportCsv }
}
