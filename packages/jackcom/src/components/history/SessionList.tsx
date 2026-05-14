import { useT } from '@/i18n'
import type { SessionRow } from '@/stores/history-store'
import { sessionList } from './session-list.variants'

interface SessionListProps {
  sessions: SessionRow[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function SessionList({ sessions, selectedId, onSelect }: SessionListProps) {
  const { t } = useT()
  const { empty, root, item, portInfo, time } = sessionList()

  if (sessions.length === 0) {
    return (
      <div className={empty()}>
        {t('history.noSessions')}
      </div>
    )
  }

  return (
    <div className={root()}>
      {sessions.map(session => {
        const isSelected = session.id === selectedId
        return (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            data-selected={isSelected}
            className={item()}
          >
            <div className={portInfo()}>
              {session.port_name} @ {session.baud_rate}
            </div>
            <div className={time()}>
              {new Date(session.created_at).toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}
