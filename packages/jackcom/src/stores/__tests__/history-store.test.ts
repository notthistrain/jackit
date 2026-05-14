import { describe, it, expect, beforeEach } from 'vitest'
import { useHistoryStore } from '../history-store'

describe('useHistoryStore', () => {
  beforeEach(() => {
    useHistoryStore.setState({
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
    })
  })

  it('sets sessions', () => {
    const sessions = [{ id: 1, port_name: 'COM3', baud_rate: 115200, created_at: '2026-05-14T10:00:00Z' }]
    useHistoryStore.getState().setSessions(sessions as any)
    expect(useHistoryStore.getState().sessions).toEqual(sessions)
  })

  it('selects session', () => {
    useHistoryStore.getState().selectSession(42)
    expect(useHistoryStore.getState().selectedSessionId).toBe(42)
  })

  it('sets frames with total', () => {
    useHistoryStore.getState().setFrames([{ id: 1 } as any], 100)
    expect(useHistoryStore.getState().frames).toHaveLength(1)
    expect(useHistoryStore.getState().totalFrames).toBe(100)
  })

  it('sets page', () => {
    useHistoryStore.getState().setPage(3)
    expect(useHistoryStore.getState().page).toBe(3)
  })

  it('sets direction filter', () => {
    useHistoryStore.getState().setDirectionFilter('rx')
    expect(useHistoryStore.getState().directionFilter).toBe('rx')
  })

  it('sets protocol filter', () => {
    useHistoryStore.getState().setProtocolFilter('modbus')
    expect(useHistoryStore.getState().protocolFilter).toBe('modbus')
  })

  it('toggles frame expand', () => {
    useHistoryStore.getState().toggleFrameExpand(5)
    expect(useHistoryStore.getState().expandedFrameId).toBe(5)
    useHistoryStore.getState().toggleFrameExpand(5)
    expect(useHistoryStore.getState().expandedFrameId).toBeNull()
  })

  it('sets loading and error', () => {
    useHistoryStore.getState().setLoading(true)
    expect(useHistoryStore.getState().loading).toBe(true)
    useHistoryStore.getState().setError('test error')
    expect(useHistoryStore.getState().error).toBe('test error')
  })
})
