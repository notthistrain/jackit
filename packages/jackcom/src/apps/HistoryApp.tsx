import { useEffect } from 'react'
import { useT } from '@/i18n'
import { useHistory } from '@/hooks/useHistory'
import { SessionList } from '@/components/history/SessionList'
import { FilterBar } from '@/components/history/FilterBar'
import { FrameTable } from '@/components/history/FrameTable'

export default function HistoryApp() {
  const { t } = useT()
  const { store, loadSessions, loadFrames, exportCsv } = useHistory()
  const {
    sessions, selectedSessionId, frames, totalFrames,
    page, pageSize, directionFilter, protocolFilter, expandedFrameId, loading,
  } = store

  // 挂载时加载会话列表
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // 选择会话 / 过滤 / 分页变化时加载帧数据
  useEffect(() => {
    if (selectedSessionId !== null) {
      loadFrames(selectedSessionId)
    }
  }, [selectedSessionId, directionFilter, protocolFilter, page, loadFrames])

  const handleExport = async () => {
    if (selectedSessionId === null) return
    await exportCsv(selectedSessionId)
  }

  const startIdx = page * pageSize + 1
  const endIdx = Math.min((page + 1) * pageSize, totalFrames)

  return (
    <div style={{
      height: '100vh',
      background: 'var(--color-editor-bg)',
      color: 'var(--color-text)',
      display: 'flex',
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
    }}>
      {/* 左侧会话列表 */}
      <div style={{
        width: '200px',
        background: 'var(--color-sidebar-bg)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '6px 10px',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.5px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          {t('history.sessions')}
        </div>
        <SessionList
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={store.selectSession}
        />
      </div>

      {/* 右侧帧列表 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <FilterBar
          direction={directionFilter}
          protocol={protocolFilter}
          onDirectionChange={store.setDirectionFilter}
          onProtocolChange={store.setProtocolFilter}
        />
        <FrameTable
          frames={frames}
          expandedFrameId={expandedFrameId}
          onToggleExpand={store.toggleFrameExpand}
        />
        {/* 底部状态栏 */}
        <div style={{
          padding: '3px 10px',
          background: 'var(--color-sidebar-bg)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          gap: '12px',
          color: 'var(--color-text-secondary)',
          fontSize: '10px',
          alignItems: 'center',
        }}>
          <span>{totalFrames.toLocaleString()} {t('history.frames')}</span>
          {totalFrames > 0 && <>
            <span>|</span>
            <span>{t('history.showing')} {startIdx}-{endIdx}</span>
          </>}
          {selectedSessionId !== null && <>
            <span>|</span>
            <button
              onClick={handleExport}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                fontSize: '10px',
                padding: 0,
              }}
            >
              {t('history.export')}
            </button>
          </>}
          {loading && <span style={{ color: 'var(--color-accent)' }}>{t('history.loading')}</span>}
        </div>
      </div>
    </div>
  )
}
