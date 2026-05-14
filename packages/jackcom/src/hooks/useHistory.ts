import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useHistoryStore, type SessionRow } from '@/stores/history-store'

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

export function useHistory() {
  const store = useHistoryStore()

  const loadSessions = useCallback(async () => {
    try {
      const s = useHistoryStore.getState()
      s.setLoading(true)
      s.setError(null)
      const res = await invoke<{ sessions: SessionRow[] }>('list_recent_sessions', {
        request: { limit: 20 },
      })
      s.setSessions(res.sessions)
    } catch (e: unknown) {
      useHistoryStore.getState().setError(toErrorMessage(e))
    } finally {
      useHistoryStore.getState().setLoading(false)
    }
  }, [])

  const loadFrames = useCallback(async (sessionId: number) => {
    try {
      const s = useHistoryStore.getState()
      s.setLoading(true)
      s.setError(null)
      const { directionFilter, protocolFilter, page, pageSize } = s
      const res = await invoke<{ frames: any[]; total: number }>('query_history', {
        request: {
          session_id: sessionId,
          direction: directionFilter === 'all' ? undefined : directionFilter,
          protocol: protocolFilter,
          limit: pageSize,
          offset: page * pageSize,
        },
      })
      s.setFrames(res.frames, res.total)
    } catch (e: unknown) {
      useHistoryStore.getState().setError(toErrorMessage(e))
    } finally {
      useHistoryStore.getState().setLoading(false)
    }
  }, [])

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
