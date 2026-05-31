import { FolderOpen } from 'lucide-react'
import { useT } from '@/i18n'
import { emptyState } from './empty-state.variants'

export interface EmptyStateProps {
  onSelectProject: () => void
}

export function EmptyState({ onSelectProject }: EmptyStateProps) {
  const { t } = useT()
  const { root, icon, title, description, button } = emptyState()

  return (
    <div className={root()}>
      <FolderOpen size={48} className={icon()} />
      <p className={title()}>{t('empty.title')}</p>
      <p className={description()}>{t('empty.desc')}</p>
      <button onClick={onSelectProject} className={button()}>
        {t('empty.select')}
      </button>
    </div>
  )
}
