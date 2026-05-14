import { useT } from '@/i18n'
import type { SessionRow } from '@/stores/history-store'

interface SessionListProps {
  sessions: SessionRow[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function SessionList({ sessions, selectedId, onSelect }: SessionListProps) {
  const { t } = useT()

  if (sessions.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: '11px',
        padding: '20px',
        textAlign: 'center',
      }}>
        {t('history.noSessions')}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {sessions.map(session => {
        const isSelected = session.id === selectedId
        return (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            style={{
              padding: '6px 10px',
              background: isSelected ? 'var(--color-accent)' : 'transparent',
              cursor: 'pointer',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '11px' }}>
              {session.port_name} @ {session.baud_rate}
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>
              {new Date(session.created_at).toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}
