import { create } from 'zustand'
import type { DisplayFrame } from '@/lib/tauri-events'

export interface SessionRow {
  id: number
  port_name: string
  baud_rate: number
  created_at: string
}

interface HistoryStore {
  sessions: SessionRow[]
  selectedSessionId: number | null
  frames: DisplayFrame[]
  totalFrames: number
  page: number
  pageSize: number
  directionFilter: 'all' | 'rx' | 'tx'
  protocolFilter: string | null
  expandedFrameId: number | null
  loading: boolean
  error: string | null

  setSessions: (sessions: SessionRow[]) => void
  selectSession: (id: number) => void
  setFrames: (frames: DisplayFrame[], total: number) => void
  setPage: (page: number) => void
  setDirectionFilter: (dir: 'all' | 'rx' | 'tx') => void
  setProtocolFilter: (proto: string | null) => void
  toggleFrameExpand: (id: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  sessions: [],
  selectedSessionId: null,
  frames: [],
  totalFrames: 0,
  page: 0,
  pageSize: 50,
  directionFilter: 'all',
  protocolFilter: null,
  expandedFrameId: null,
  loading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),
  selectSession: (id) => set({ selectedSessionId: id, page: 0, expandedFrameId: null }),
  setFrames: (frames, total) => set({ frames, totalFrames: total }),
  setPage: (page) => set({ page }),
  setDirectionFilter: (directionFilter) => set({ directionFilter, page: 0 }),
  setProtocolFilter: (protocolFilter) => set({ protocolFilter, page: 0 }),
  toggleFrameExpand: (id) =>
    set(s => ({ expandedFrameId: s.expandedFrameId === id ? null : id })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
